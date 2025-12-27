// routes/customers.js
const express = require('express');
const { Op, ValidationError } = require('sequelize');
const { sequelize } = require('../config/database');
const User = require('../models/User');
const Order = require('../models/Order');
const auth = require('../middleware/auth');
const { publish } = require('../services/realtimeHub');

const router = express.Router();

// ===== Helpers cho thống kê khách hàng theo period (this_week / this_month / this_year) =====
function startOfDay(d) {
    const dt = new Date(d);
    dt.setHours(0, 0, 0, 0);
    return dt;
}

function endOfDay(d) {
    const dt = new Date(d);
    dt.setHours(23, 59, 59, 999);
    return dt;
}

function getPeriodRange(rawPeriod) {
    const now = new Date();
    const p = String(rawPeriod || 'this_week').toLowerCase();

    if (p === 'this_month') {
        const from = startOfDay(new Date(now.getFullYear(), now.getMonth(), 1));
        const to = endOfDay(new Date(now.getFullYear(), now.getMonth() + 1, 0));
        return { period: 'this_month', from, to };
    }

    if (p === 'this_year') {
        const from = startOfDay(new Date(now.getFullYear(), 0, 1));
        const to = endOfDay(new Date(now.getFullYear(), 11, 31));
        return { period: 'this_year', from, to };
    }

    // Mặc định: this_week (Thứ 2 đến Chủ nhật)
    const d = new Date(now);
    const day = d.getDay() || 7; // Mon=1..Sun=7
    d.setDate(d.getDate() - day + 1); // về thứ 2
    const from = startOfDay(d);
    const to = endOfDay(new Date(from.getFullYear(), from.getMonth(), from.getDate() + 6));
    return { period: 'this_week', from, to };
}

// Đếm thống kê khách hàng / đơn hàng trong khoảng [from, to]
async function countCustomerStatsBetween(from, to) {
    // Khách hàng mới tạo trong period
    const baseUserWhere = {
        createdAt: {
            [Op.between]: [from, to]
        }
    };

    const all = await User.count({ where: baseUserWhere });
    const active = await User.count({
        where: {
            ...baseUserWhere,
            isActive: 1
        }
    });
    const inactive = await User.count({
        where: {
            ...baseUserWhere,
            isActive: 0
        }
    });

    // Số khách hàng (distinct) có ít nhất 1 đơn trong period (không tính đơn cancel)
    const purchasing = await Order.count({
        where: {
            createdAt: {
                [Op.between]: [from, to]
            },
            status: {
                [Op.notLike]: 'cancel%'
            }
        },
        distinct: true,
        col: 'customerId'
    });

    // Đơn "bị bỏ" trong period: NEW/pending đến hiện tại vẫn chưa hoàn tất
    const abandonedCarts = await Order.count({
        where: {
            createdAt: {
                [Op.between]: [from, to]
            },
            status: {
                [Op.in]: ['NEW', 'pending']
            }
        }
    });

    return {
        customers: {
            all,
            active,
            inactive
        },
        funnel: {
            // Định nghĩa: khách mới trong period = all
            newCustomers: all,
            purchasing,
            abandonedCarts
        }
    };
}

// POST /api/customers - Tạo khách hàng mới (staff/admin)
router.post('/', auth, async (req, res) => {
    try {
        const { fullName, email, phone, password, role } = req.body || {};

        if (!fullName || !email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Vui lòng nhập đầy đủ họ tên, email và mật khẩu'
            });
        }

        // Validate fullName: tối đa 50 ký tự
        if (fullName.length > 50) {
            return res.status(400).json({
                success: false,
                message: 'Tên đăng nhập không được vượt quá 50 ký tự'
            });
        }

        // Validate email: tối đa 50 ký tự
        if (email.length > 50) {
            return res.status(400).json({
                success: false,
                message: 'Email không được vượt quá 50 ký tự'
            });
        }

        // Validate password: tối thiểu 8 ký tự, có chữ in hoa, ký tự đặc biệt, chữ thường và số
        if (password.length < 8) {
            return res.status(400).json({
                success: false,
                message: 'Mật khẩu phải có ít nhất 8 ký tự'
            });
        }
        const passwordRegex = /^(?=.*[A-Z])(?=.*[a-z])(?=.*[0-9])(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?])/;
        if (!passwordRegex.test(password)) {
            return res.status(400).json({
                success: false,
                message: 'Mật khẩu phải có ít nhất 1 chữ in hoa, 1 chữ thường, 1 số và 1 ký tự đặc biệt'
            });
        }

        // Chuẩn hóa & validate số điện thoại ngay tại BE
        let normalizedPhone = null;
        if (phone) {
            // Lấy chỉ chữ số: bỏ dấu +, khoảng trắng, dấu gạch, ...
            const digits = String(phone).replace(/\D/g, '');
            if (digits) {
                // Yêu cầu đúng 10 chữ số
                if (digits.length !== 10) {
                    return res.status(400).json({
                        success: false,
                        message: 'Số điện thoại phải có đúng 10 chữ số'
                    });
                }
                normalizedPhone = digits;
            }
        }

        // Kiểm tra trùng email
        const existed = await User.findOne({ where: { email } });
        if (existed) {
            return res.status(400).json({
                success: false,
                message: 'Email đã tồn tại'
            });
        }

        // Validate role nếu có
        const validRoles = ['customer', 'staff', 'admin', 'owner'];
        const userRole = role && validRoles.includes(role.toLowerCase()) 
            ? role.toLowerCase() 
            : 'customer';

        // Tạo user mới - dùng trường passwordHash để kích hoạt hook hash
        const newUser = await User.create({
            fullName,
            email,
            phone: normalizedPhone,
            passwordHash: password,
            role: userRole,
            isActive: 1,
            emailVerified: 1
        });
        // Phát sự kiện realtime để các tab/dashboard khác biết có khách hàng mới
        try {
            publish({
                type: 'customers.changed',
                data: {
                    reason: 'created',
                    byUserId: req.user ? req.user.id : null,
                    customer: {
                        id: newUser.id,
                        fullName: newUser.fullName,
                        email: newUser.email,
                        phone: newUser.phone || null,
                        isActive: newUser.isActive,
                        createdAt: newUser.createdAt
                    }
                }
            });
        } catch (e) {
            console.warn('Realtime publish error (customers.created):', e);
        }

        res.status(201).json({
            success: true,
            message: 'Tạo khách hàng thành công',
            data: {
                id: newUser.id,
                fullName: newUser.fullName,
                email: newUser.email,
                phone: newUser.phone
            }
        });
    } catch (error) {
        console.error('Lỗi tạo khách hàng:', error);
        // Nếu là lỗi validate từ Sequelize (ví dụ regex phone)
        if (error instanceof ValidationError) {
            const first = error.errors && error.errors[0];
            return res.status(400).json({
                success: false,
                message: first?.message || 'Dữ liệu không hợp lệ',
                errors: (error.errors || []).map(e => ({
                    field: e.path,
                    message: e.message
                }))
            });
        }

        return res.status(500).json({
            success: false,
            message: 'Lỗi server khi tạo khách hàng',
            error: error.message
        });
    }
});

// GET /api/customers - Lấy danh sách khách hàng (chỉ staff/admin)
router.get('/', auth, async (req, res) => {
    try {
        // Kiểm tra quyền: chỉ staff và admin mới được xem
        // Note: Nếu User model không có role field, có thể bỏ qua check này
        // const userRole = req.user.role;
        // if (userRole !== 'staff' && userRole !== 'admin') {
        //     return res.status(403).json({
        //         success: false,
        //         message: 'Bạn không có quyền truy cập'
        //     });
        // }

        const {
            page = 1,
            limit = 10,
            search = '',
            status = '',
            fromDate = '',
            toDate = '',
            minAmount = '',
            maxAmount = ''
        } = req.query;

        // Điều kiện tìm kiếm
        const whereClause = {};

        // Chuẩn hoá search: trim và chỉ dùng nếu >= 2 ký tự
        const searchTerm = String(search || '').trim();
        const normalizedSearch = searchTerm.length >= 2 ? searchTerm : '';

        if (normalizedSearch) {
            const likeSearch = `%${normalizedSearch}%`;
            // Tìm theo tên, email hoặc số điện thoại
            whereClause[Op.or] = [
                { fullName: { [Op.like]: likeSearch } },
                { email: { [Op.like]: likeSearch } },
                { phone: { [Op.like]: likeSearch } },
            ];
        }

        if (status === 'active') {
            whereClause.isActive = 1;
        } else if (status === 'inactive') {
            whereClause.isActive = 0;
        }

        // Lọc theo ngày tạo tài khoản
        if (fromDate || toDate) {
            whereClause.createdAt = {};
            if (fromDate) {
                whereClause.createdAt[Op.gte] = new Date(fromDate);
            }
            if (toDate) {
                // set to end of day
                const end = new Date(toDate);
                end.setHours(23, 59, 59, 999);
                whereClause.createdAt[Op.lte] = end;
            }
        }

        // Lấy danh sách khách hàng
        const allCustomers = await User.findAll({
            where: whereClause,
            attributes: ['id', 'fullName', 'email', 'phone', 'isActive', 'createdAt'],
            order: [['createdAt', 'DESC']],
        });

        const customerIds = allCustomers.map(c => c.id);

        // Tổng hợp đơn hàng cho tất cả khách hàng trong danh sách để giảm số lượng query
        const aggregates = customerIds.length
            ? await Order.findAll({
                where: { customerId: { [Op.in]: customerIds } },
                attributes: [
                    'customerId',
                    [sequelize.fn('COUNT', sequelize.col('id')), 'orderCount'],
                    [sequelize.fn('SUM', sequelize.col('totalAmount')), 'totalSpent'],
                ],
                group: ['customerId'],
                raw: true,
            })
            : [];

        const customerIdToAgg = {};
        for (const row of aggregates) {
            const cid = row.customerId;
            customerIdToAgg[cid] = {
                orderCount: parseInt(row.orderCount || 0),
                totalSpent: parseFloat(row.totalSpent || 0),
            };
        }

        // Lấy thống kê đơn hàng cho từng khách hàng
        const formattedCustomers = allCustomers.map((customer) => {
            const c = customer.toJSON();
            const agg = customerIdToAgg[c.id] || { orderCount: 0, totalSpent: 0 };
            return {
                id: c.id,
                name: c.fullName,
                email: c.email,
                phone: c.phone || '',
                orderCount: agg.orderCount || 0,
                totalSpent: agg.totalSpent || 0,
                joinedDate: c.createdAt,
                status: c.isActive ? 'Active' : 'Inactive'
            };
        });

        // Lọc theo tổng chi tiêu (Amount)
        let filtered = formattedCustomers;
        // Chuẩn hóa min/max amount, chấp nhận chuỗi số; bỏ qua nếu không hợp lệ
        let minA = (minAmount !== '' && !isNaN(parseFloat(minAmount))) ? parseFloat(minAmount) : null;
        let maxA = (maxAmount !== '' && !isNaN(parseFloat(maxAmount))) ? parseFloat(maxAmount) : null;
        if (minA !== null && minA < 0) minA = 0;
        if (maxA !== null && maxA < 0) maxA = 0;
        // Nếu người dùng nhập ngược (min > max) thì hoán đổi
        if (minA !== null && maxA !== null && minA > maxA) {
            const tmp = minA; minA = maxA; maxA = tmp;
        }
        if (minA !== null || maxA !== null) {
            filtered = filtered.filter(c => {
                const v = parseFloat(c.totalSpent || 0);
                if (minA !== null && v < minA) return false;
                if (maxA !== null && v > maxA) return false;
                return true;
            });
        }

        // Phân trang thủ công sau khi lọc
        // Chuẩn hoá phân trang để tránh NaN / 0 / âm
        const pageNum = Math.max(1, parseInt(page, 10) || 1);
        const limitNum = Math.max(1, Math.min(parseInt(limit, 10) || 10, 100));
        const totalAfterFilter = filtered.length;
        const start = (pageNum - 1) * limitNum;
        const end = start + limitNum;
        const paged = filtered.slice(start, end);

        res.json({
            success: true,
            data: paged,
            pagination: {
                page: pageNum,
                limit: limitNum,
                total: totalAfterFilter,
                totalPages: Math.ceil(totalAfterFilter / limitNum)
            }
        });
    } catch (error) {
        console.error('Lỗi lấy danh sách khách hàng:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi server khi lấy danh sách khách hàng',
            error: error.message
        });
    }
});

// GET /api/customers/stats - Lấy thống kê tổng quan theo period
// ?period=this_week|this_month|this_year (default: this_week)
router.get('/stats', auth, async (req, res) => {
    try {
        const rawPeriod = req.query.period || 'this_week';
        const { period, from, to } = getPeriodRange(rawPeriod);

        const { customers, funnel } = await countCustomerStatsBetween(from, to);

        // Trả về dạng mới  giữ lại field cũ để FE hiện tại không vỡ
        res.json({
            success: true,
            data: {
                period,
                range: {
                    from: from.toISOString(),
                    to: to.toISOString()
                },
                customers,
                funnel,
                // Legacy fields (đang dùng ở FE)
                allCustomers: customers.all,
                active: customers.active,
                inactive: customers.inactive,
                newCustomers: funnel.newCustomers,
                purchasing: funnel.purchasing,
                abandonedCarts: funnel.abandonedCarts
            }
        });
    } catch (error) {
        console.error('Lỗi lấy thống kê khách hàng:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi server khi lấy thống kê',
            error: error.message
        });
    }
});

// PATCH /api/customers/bulk-status - Cập nhật trạng thái nhiều khách hàng
router.patch('/bulk-status', auth, async (req, res) => {
    try {
        let { ids, status } = req.body || {};

        if (!Array.isArray(ids) || !ids.length) {
            return res.status(400).json({
                success: false,
                message: 'Danh sách khách hàng trống'
            });
        }

        if (status !== 'active' && status !== 'inactive') {
            return res.status(400).json({
                success: false,
                message: 'Trạng thái không hợp lệ'
            });
        }

        // Chuẩn hoá danh sách id -> số
        ids = ids.map(id => Number(id)).filter(id => !Number.isNaN(id));
        if (!ids.length) {
            return res.status(400).json({
                success: false,
                message: 'Danh sách khách hàng không hợp lệ'
            });
        }

        const isActive = status === 'active' ? 1 : 0;
        const [affectedRows] = await User.update(
            { isActive },
            { where: { id: { [Op.in]: ids } } }
        );
        // Nếu có bản ghi được cập nhật thì phát sự kiện realtime
        if (affectedRows > 0) {
            try {
                publish({
                    type: 'customers.changed',
                    data: {
                        reason: 'bulk-status',
                        byUserId: req.user ? req.user.id : null,
                        status,     // 'active' | 'inactive'
                        ids         // danh sách id khách hàng bị ảnh hưởng
                    }
                });
            } catch (e) {
                console.warn('Realtime publish error (customers.bulk-status):', e);
            }
        }

        return res.json({
            success: true,
            message: `Đã cập nhật trạng thái cho ${affectedRows} khách hàng`,
            data: { affectedRows }
        });
    } catch (error) {
        console.error('Lỗi bulk status khách hàng:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi server khi cập nhật trạng thái khách hàng',
            error: error.message
        });
    }
});

// GET /api/customers/:customerId - Lấy chi tiết khách hàng
router.get('/:customerId', auth, async (req, res) => {
    try {
        const { customerId } = req.params;
        console.log('📋 Lấy chi tiết khách hàng ID:', customerId);

        // Lấy thông tin khách hàng
        // Lưu ý: address không có trong model nhưng có trong DB, Sequelize sẽ tự map
        const customer = await User.findByPk(customerId, {
            attributes: ['id', 'fullName', 'email', 'phone', 'isActive', 'createdAt', 'avatarUrl']
        });

        if (!customer) {
            console.log('❌ Không tìm thấy khách hàng ID:', customerId);
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy khách hàng'
            });
        }

        console.log('✅ Tìm thấy khách hàng:', customer.fullName);

        // Convert customer sang plain object để tránh lỗi với Sequelize instance
        const customerData = customer.toJSON ? customer.toJSON() : {
            id: customer.id,
            fullName: customer.fullName,
            email: customer.email,
            phone: customer.phone,
            address: customer.address || null, // address có thể không có trong model
            isActive: customer.isActive,
            createdAt: customer.createdAt,
            avatarUrl: customer.avatarUrl
        };

        // Lấy address từ database bằng raw query nếu cần
        if (!customerData.address) {
            try {
                const addressResult = await sequelize.query(`
                    SELECT address FROM users WHERE id = :customerId
                `, {
                    replacements: { customerId: parseInt(customerId) },
                    type: sequelize.QueryTypes.SELECT
                });
                if (addressResult && addressResult.length > 0) {
                    customerData.address = addressResult[0].address || null;
                }
            } catch (error) {
                console.error('Lỗi khi lấy address:', error);
                customerData.address = null;
            }
        }

        // Lấy thống kê đơn hàng bằng raw SQL để tránh lỗi
        let stats = { orderCount: 0, totalSpent: 0 };
        try {
            const orderStatsResult = await sequelize.query(`
                SELECT 
                    COUNT(id) as orderCount,
                    COALESCE(SUM(totalAmount), 0) as totalSpent
                FROM orders
                WHERE customerId = :customerId
            `, {
                replacements: { customerId: parseInt(customerId) },
                type: sequelize.QueryTypes.SELECT
            });

            if (orderStatsResult && orderStatsResult.length > 0) {
                stats = {
                    orderCount: parseInt(orderStatsResult[0].orderCount || 0),
                    totalSpent: parseFloat(orderStatsResult[0].totalSpent || 0)
                };
            }
        } catch (error) {
            console.error('Lỗi khi lấy thống kê đơn hàng:', error);
            stats = { orderCount: 0, totalSpent: 0 };
        }

        // Lấy tất cả đơn hàng (Order model không có createdAt vì timestamps: false)
        // Sắp xếp theo ID DESC (đơn hàng mới nhất có ID lớn nhất)
        let allOrders = [];
        try {
            allOrders = await Order.findAll({
                where: { customerId: customerId },
                attributes: ['id', 'status', 'totalAmount', 'completedAt'],
                order: [['id', 'DESC']],
                limit: 100,
                raw: true // Dùng raw để tránh lỗi với Sequelize instance
            });
        } catch (error) {
            console.error('Lỗi khi lấy danh sách đơn hàng:', error);
            allOrders = [];
        }

        // Tìm đơn hàng gần nhất (ưu tiên completedAt, nếu không có thì dùng id để ước tính)
        let lastOrder = null;
        if (allOrders.length > 0) {
            // Sắp xếp lại theo completedAt (nếu có), nếu không thì dùng id
            const sortedOrders = [...allOrders].sort((a, b) => {
                const dateA = a.completedAt ? new Date(a.completedAt) : null;
                const dateB = b.completedAt ? new Date(b.completedAt) : null;

                if (dateA && dateB) {
                    return dateB - dateA;
                }
                if (dateA) return -1;
                if (dateB) return 1;
                // Nếu cả hai đều không có completedAt, sắp xếp theo id
                return (b.id || 0) - (a.id || 0);
            });
            lastOrder = sortedOrders[0];
        }

        // Sắp xếp lại orders theo completedAt (nếu có), nếu không thì theo id
        const orders = allOrders.sort((a, b) => {
            const dateA = a.completedAt ? new Date(a.completedAt) : null;
            const dateB = b.completedAt ? new Date(b.completedAt) : null;

            if (dateA && dateB) {
                return dateB - dateA;
            }
            if (dateA) return -1;
            if (dateB) return 1;
            // Nếu cả hai đều không có completedAt, sắp xếp theo id
            return (b.id || 0) - (a.id || 0);
        });

        res.json({
            success: true,
            data: {
                customer: {
                    id: customerData.id,
                    name: customerData.fullName,
                    email: customerData.email,
                    phone: customerData.phone || '',
                    address: customerData.address || '',
                    status: customerData.isActive ? 'Active' : 'Inactive',
                    joinedDate: customerData.createdAt,
                    avatar: customerData.avatarUrl || ''
                },
                stats: {
                    orderCount: stats.orderCount,
                    totalSpent: stats.totalSpent,
                    lastOrderDate: lastOrder?.completedAt || null
                },
                orders: orders.map(order => {
                    try {
                        return {
                            id: order.id || null,
                            status: order.status || 'NEW',
                            totalAmount: parseFloat(order.totalAmount || 0),
                            orderDate: order.completedAt || null, // Order không có createdAt
                            completedAt: order.completedAt || null
                        };
                    } catch (error) {
                        console.error('Lỗi khi map order:', error, order);
                        return {
                            id: order.id || null,
                            status: 'NEW',
                            totalAmount: 0,
                            orderDate: null,
                            completedAt: null
                        };
                    }
                })
            }
        });
    } catch (error) {
        console.error('Lỗi lấy chi tiết khách hàng:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi server khi lấy chi tiết khách hàng',
            error: error.message
        });
    }
});

// DELETE /api/customers/:customerId - Xóa khách hàng
router.delete('/:customerId', auth, async (req, res) => {
    try {
        const { customerId } = req.params;
        console.log('🗑️ Xóa khách hàng ID:', customerId);

        // Kiểm tra khách hàng có tồn tại không
        const customer = await User.findByPk(customerId);
        if (!customer) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy khách hàng'
            });
        }

        // Kiểm tra xem khách hàng có đơn hàng không (tùy chọn: có thể không cho xóa nếu có đơn hàng)
        const orderCount = await Order.count({
            where: { customerId: customerId }
        });

        if (orderCount > 0) {
            // Có thể xóa luôn hoặc chỉ đánh dấu inactive
            // Ở đây tôi sẽ xóa luôn, nhưng có thể thay đổi thành set isActive = 0
            console.log(`⚠️ Khách hàng có ${orderCount} đơn hàng, vẫn tiếp tục xóa`);
        }

        // Xóa khách hàng
        await customer.destroy();

        console.log('✅ Đã xóa khách hàng:', customer.fullName);

        res.json({
            success: true,
            message: 'Xóa khách hàng thành công'
        });
    } catch (error) {
        console.error('Lỗi xóa khách hàng:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi server khi xóa khách hàng',
            error: error.message
        });
    }
});

module.exports = router;