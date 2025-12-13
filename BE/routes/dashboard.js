// cap1/routes/dashboard.js
const express = require('express');
const { Op } = require('sequelize');
const { sequelize } = require('../config/database');
const Order = require('../models/Order');
const User = require('../models/User');
const PriceRule = require('../models/PriceRule');
const auth = require('../middleware/auth');

const router = express.Router();

// Helper function để tính khoảng thời gian
function getDateRange(timeRange) {
    const now = new Date();
    let startDate, endDate, previousStartDate, previousEndDate;

    switch (timeRange) {
        case 'today':
            // Hôm nay: 00:00:00 đến 23:59:59
            startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
            endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
            // Kỳ trước: Hôm qua
            previousStartDate = new Date(startDate);
            previousStartDate.setDate(previousStartDate.getDate() - 1);
            previousEndDate = new Date(endDate);
            previousEndDate.setDate(previousEndDate.getDate() - 1);
            break;

        case 'week':
            // Tuần này: Thứ 2 đến Chủ nhật
            const dayOfWeek = now.getDay();
            const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // Nếu CN thì lùi 6 ngày, nếu không thì tính về T2
            startDate = new Date(now);
            startDate.setDate(now.getDate() + diffToMonday);
            startDate.setHours(0, 0, 0, 0);
            endDate = new Date(startDate);
            endDate.setDate(startDate.getDate() + 6);
            endDate.setHours(23, 59, 59, 999);
            // Kỳ trước: Tuần trước
            previousStartDate = new Date(startDate);
            previousStartDate.setDate(previousStartDate.getDate() - 7);
            previousEndDate = new Date(endDate);
            previousEndDate.setDate(previousEndDate.getDate() - 7);
            break;

        case 'month':
            // Tháng này: Ngày 1 đến cuối tháng
            startDate = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
            endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
            // Kỳ trước: Tháng trước
            previousStartDate = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0);
            previousEndDate = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
            break;

        default:
            // Mặc định: Tuần này
            return getDateRange('week');
    }

    return { startDate, endDate, previousStartDate, previousEndDate };
}

// GET /api/dashboard/sales - Lấy thống kê doanh số
router.get('/sales', auth, async (req, res) => {
    try {
        const { timeRange = 'week' } = req.query; // today, week, month

        const { startDate, endDate, previousStartDate, previousEndDate } = getDateRange(timeRange);

        // Kiểm tra xem bảng có created_at column không
        let dateColumn = 'completedAt'; // Mặc định dùng completedAt
        try {
            const columns = await sequelize.query(`
                SELECT COLUMN_NAME 
                FROM INFORMATION_SCHEMA.COLUMNS 
                WHERE TABLE_SCHEMA = DATABASE() 
                AND TABLE_NAME = 'orders' 
                AND COLUMN_NAME IN ('created_at', 'createdAt')
                LIMIT 1
            `, { type: sequelize.QueryTypes.SELECT });

            if (columns && columns.length > 0 && columns[0].COLUMN_NAME) {
                dateColumn = columns[0].COLUMN_NAME;
            }
        } catch (error) {
            console.log('Không thể kiểm tra created_at, dùng completedAt');
        }

        console.log('📊 Dashboard Sales API - timeRange:', timeRange);
        console.log('📅 Date range:', { startDate, endDate });
        console.log('📅 Previous range:', { previousStartDate, previousEndDate });
        console.log('📅 Date column:', dateColumn);

        // Query doanh thu và số đơn trong kỳ hiện tại
        let currentPeriodQuery;
        if (dateColumn === 'completedAt') {
            // Doanh thu theo ngày hoàn thành đơn (chỉ tính đơn đã completed)
            currentPeriodQuery = `
                SELECT 
                    COALESCE(SUM(totalAmount), 0) as totalRevenue,
                    COUNT(id) as orderCount
                FROM orders
                WHERE status = 'completed'
                AND completedAt BETWEEN :startDate AND :endDate
            `;
        } else {
            // Nếu có createdAt/created_at: doanh thu theo ngày tạo đơn (không tính cancelled)
            currentPeriodQuery = `
                SELECT 
                    COALESCE(SUM(totalAmount), 0) as totalRevenue,
                    COUNT(id) as orderCount
                FROM orders
                WHERE status NOT IN ('cancelled')
                AND ${dateColumn} BETWEEN :startDate AND :endDate
            `;
        }

        // Query doanh thu và số đơn trong kỳ trước
        let previousPeriodQuery;
        if (dateColumn === 'completedAt') {
            previousPeriodQuery = `
                SELECT 
                    COALESCE(SUM(totalAmount), 0) as totalRevenue,
                    COUNT(id) as orderCount
                FROM orders
                WHERE status = 'completed'
                AND completedAt BETWEEN :prevStartDate AND :prevEndDate
            `;
        } else {
            previousPeriodQuery = `
                SELECT 
                    COALESCE(SUM(totalAmount), 0) as totalRevenue,
                    COUNT(id) as orderCount
                FROM orders
                WHERE status NOT IN ('cancelled')
                AND ${dateColumn} BETWEEN :prevStartDate AND :prevEndDate
            `;
        }

        const [currentPeriodData] = await sequelize.query(currentPeriodQuery, {
            replacements: {
                startDate: startDate,
                endDate: endDate
            },
            type: sequelize.QueryTypes.SELECT
        });

        const [previousPeriodData] = await sequelize.query(previousPeriodQuery, {
            replacements: {
                prevStartDate: previousStartDate,
                prevEndDate: previousEndDate
            },
            type: sequelize.QueryTypes.SELECT
        });

        console.log('📊 Current period data:', currentPeriodData);
        console.log('📊 Previous period data:', previousPeriodData);

        let currentRevenue = parseFloat(currentPeriodData?.totalRevenue || 0);
        let currentVolume = parseInt(currentPeriodData?.orderCount || 0);
        let previousRevenue = parseFloat(previousPeriodData?.totalRevenue || 0);
        let previousVolume = parseInt(previousPeriodData?.orderCount || 0);

        // Tính tỷ lệ tăng trưởng
        let growthRate = 0;
        if (previousRevenue > 0) {
            growthRate = ((currentRevenue - previousRevenue) / previousRevenue) * 100;
        } else if (currentRevenue > 0) {
            growthRate = 100; // Tăng 100% nếu kỳ trước = 0
        }

        res.json({
            success: true,
            data: {
                revenue: currentRevenue,
                volume: currentVolume,
                growthRate: growthRate.toFixed(2),
                timeRange: timeRange,
                period: {
                    start: startDate.toISOString(),
                    end: endDate.toISOString()
                }
            }
        });
    } catch (error) {
        console.error('Lỗi lấy thống kê doanh số:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi server khi lấy thống kê doanh số',
            error: error.message
        });
    }
});

// GET /api/dashboard/customers - Lấy thống kê khách hàng
router.get('/customers', auth, async (req, res) => {
    try {
        const { timeRange = 'week' } = req.query; // today, week, month

        const { startDate, endDate, previousStartDate, previousEndDate } = getDateRange(timeRange);

        console.log('👥 Dashboard Customers API - timeRange:', timeRange);
        console.log('📅 Date range:', { startDate, endDate });
        console.log('📅 Previous range:', { previousStartDate, previousEndDate });

        // Kiểm tra xem bảng orders có created_at column không
        let orderDateColumn = 'completedAt';
        try {
            const columns = await sequelize.query(`
                SELECT COLUMN_NAME 
                FROM INFORMATION_SCHEMA.COLUMNS 
                WHERE TABLE_SCHEMA = DATABASE() 
                AND TABLE_NAME = 'orders' 
                AND COLUMN_NAME IN ('created_at', 'createdAt')
                LIMIT 1
            `, { type: sequelize.QueryTypes.SELECT });

            if (columns && columns.length > 0 && columns[0].COLUMN_NAME) {
                orderDateColumn = columns[0].COLUMN_NAME;
            }
        } catch (error) {
            console.log('Không thể kiểm tra created_at của orders, dùng completedAt');
        }

        // 1. Tổng số khách hàng đã mua hàng trong kỳ hiện tại (distinct customerId từ orders)
        let customersWithOrdersQuery;
        if (orderDateColumn === 'completedAt') {
            customersWithOrdersQuery = `
                SELECT COUNT(DISTINCT customerId) as customerCount
                FROM orders
                WHERE status NOT IN ('cancelled')
                AND (
                    completedAt BETWEEN :startDate AND :endDate
                    OR (completedAt IS NULL)
                )
            `;
        } else {
            customersWithOrdersQuery = `
                SELECT COUNT(DISTINCT customerId) as customerCount
                FROM orders
                WHERE status NOT IN ('cancelled')
                AND ${orderDateColumn} BETWEEN :startDate AND :endDate
            `;
        }

        // 2. Số khách hàng đang hoạt động trong kỳ hiện tại (is_active = 1 và có đơn trong kỳ)
        let activeCustomersQuery;
        if (orderDateColumn === 'completedAt') {
            activeCustomersQuery = `
                SELECT COUNT(DISTINCT o.customerId) as activeCount
                FROM orders o
                INNER JOIN users u ON o.customerId = u.id
                WHERE o.status NOT IN ('cancelled')
                AND u.is_active = 1
                AND (
                    o.completedAt BETWEEN :startDate AND :endDate
                    OR (o.completedAt IS NULL)
                )
            `;
        } else {
            activeCustomersQuery = `
                SELECT COUNT(DISTINCT o.customerId) as activeCount
                FROM orders o
                INNER JOIN users u ON o.customerId = u.id
                WHERE o.status NOT IN ('cancelled')
                AND u.is_active = 1
                AND o.${orderDateColumn} BETWEEN :startDate AND :endDate
            `;
        }

        // 3. Số khách hàng mới trong kỳ hiện tại (dựa vào createdAt của users)
        const newCustomersQuery = `
            SELECT COUNT(id) as newCustomerCount
            FROM users
            WHERE createdAt BETWEEN :startDate AND :endDate
        `;

        // Query cho kỳ trước
        let previousCustomersWithOrdersQuery;
        if (orderDateColumn === 'completedAt') {
            previousCustomersWithOrdersQuery = `
                SELECT COUNT(DISTINCT customerId) as customerCount
                FROM orders
                WHERE status NOT IN ('cancelled')
                AND (
                    completedAt BETWEEN :prevStartDate AND :prevEndDate
                    OR (completedAt IS NULL)
                )
            `;
        } else {
            previousCustomersWithOrdersQuery = `
                SELECT COUNT(DISTINCT customerId) as customerCount
                FROM orders
                WHERE status NOT IN ('cancelled')
                AND ${orderDateColumn} BETWEEN :prevStartDate AND :prevEndDate
            `;
        }

        const previousNewCustomersQuery = `
            SELECT COUNT(id) as newCustomerCount
            FROM users
            WHERE createdAt BETWEEN :prevStartDate AND :prevEndDate
        `;

        // Thực thi queries
        const [currentCustomersData] = await sequelize.query(customersWithOrdersQuery, {
            replacements: { startDate, endDate },
            type: sequelize.QueryTypes.SELECT
        });

        const [currentActiveData] = await sequelize.query(activeCustomersQuery, {
            replacements: { startDate, endDate },
            type: sequelize.QueryTypes.SELECT
        });

        const [currentNewCustomersData] = await sequelize.query(newCustomersQuery, {
            replacements: { startDate, endDate },
            type: sequelize.QueryTypes.SELECT
        });

        const [previousCustomersData] = await sequelize.query(previousCustomersWithOrdersQuery, {
            replacements: { prevStartDate: previousStartDate, prevEndDate: previousEndDate },
            type: sequelize.QueryTypes.SELECT
        });

        const [previousNewCustomersData] = await sequelize.query(previousNewCustomersQuery, {
            replacements: { prevStartDate: previousStartDate, prevEndDate: previousEndDate },
            type: sequelize.QueryTypes.SELECT
        });

        const customersWithOrders = parseInt(currentCustomersData?.customerCount || 0);
        const activeCustomers = parseInt(currentActiveData?.activeCount || 0);
        const newCustomers = parseInt(currentNewCustomersData?.newCustomerCount || 0);
        const previousCustomersWithOrders = parseInt(previousCustomersData?.customerCount || 0);
        const previousNewCustomers = parseInt(previousNewCustomersData?.newCustomerCount || 0);

        // Tính tỷ lệ tăng trưởng số khách hàng đã mua hàng (so với kỳ trước)
        let customersGrowthRate = 0;
        if (previousCustomersWithOrders > 0) {
            customersGrowthRate = ((customersWithOrders - previousCustomersWithOrders) / previousCustomersWithOrders) * 100;
        } else if (customersWithOrders > 0) {
            customersGrowthRate = 100; // Tăng 100% nếu kỳ trước = 0
        }

        // Tính tỷ lệ tăng trưởng khách hàng mới (để hiển thị thêm nếu cần)
        let newCustomersGrowthRate = 0;
        if (previousNewCustomers > 0) {
            newCustomersGrowthRate = ((newCustomers - previousNewCustomers) / previousNewCustomers) * 100;
        } else if (newCustomers > 0) {
            newCustomersGrowthRate = 100; // Tăng 100% nếu kỳ trước = 0
        }

        console.log('👥 Customers data:', {
            customersWithOrders,
            activeCustomers,
            newCustomers,
            customersGrowthRate,
            newCustomersGrowthRate
        });

        res.json({
            success: true,
            data: {
                customersWithOrders: customersWithOrders,
                activeCustomers: activeCustomers,
                newCustomers: newCustomers,
                customersGrowthRate: customersGrowthRate.toFixed(2), // Tỷ lệ tăng trưởng số khách hàng đã mua hàng
                newCustomersGrowthRate: newCustomersGrowthRate.toFixed(2), // Tỷ lệ tăng trưởng khách hàng mới
                timeRange: timeRange,
                period: {
                    start: startDate.toISOString(),
                    end: endDate.toISOString()
                }
            }
        });
    } catch (error) {
        console.error('Lỗi lấy thống kê khách hàng:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi server khi lấy thống kê khách hàng',
            error: error.message
        });
    }
});

// GET /api/dashboard/orders - Lấy thống kê đơn hàng
router.get('/orders', auth, async (req, res) => {
    try {
        const { timeRange = 'week' } = req.query; // today, week, month

        const { startDate, endDate, previousStartDate, previousEndDate } = getDateRange(timeRange);

        console.log('📦 Dashboard Orders API - timeRange:', timeRange);
        console.log('📅 Date range:', { startDate, endDate });
        console.log('📅 Previous range:', { previousStartDate, previousEndDate });

        // Kiểm tra xem bảng orders có created_at column không
        let orderDateColumn = 'completedAt';
        try {
            const columns = await sequelize.query(`
                SELECT COLUMN_NAME 
                FROM INFORMATION_SCHEMA.COLUMNS 
                WHERE TABLE_SCHEMA = DATABASE() 
                AND TABLE_NAME = 'orders' 
                AND COLUMN_NAME IN ('created_at', 'createdAt')
                LIMIT 1
            `, { type: sequelize.QueryTypes.SELECT });

            if (columns && columns.length > 0 && columns[0].COLUMN_NAME) {
                orderDateColumn = columns[0].COLUMN_NAME;
            }
        } catch (error) {
            console.log('Không thể kiểm tra created_at của orders, dùng completedAt');
        }

        // 1. Tổng số đơn hàng trong kỳ hiện tại (không tính cancelled)
        let totalOrdersQuery;
        if (orderDateColumn === 'completedAt') {
            totalOrdersQuery = `
                SELECT COUNT(id) as totalOrders
                FROM orders
                WHERE status NOT IN ('cancelled')
                AND (
                    completedAt BETWEEN :startDate AND :endDate
                    OR (completedAt IS NULL)
                )
            `;
        } else {
            totalOrdersQuery = `
                SELECT COUNT(id) as totalOrders
                FROM orders
                WHERE status NOT IN ('cancelled')
                AND ${orderDateColumn} BETWEEN :startDate AND :endDate
            `;
        }

        // 2. Đơn hàng đang xử lý (Pending: NEW, pending, processing, ready)
        let pendingOrdersQuery;
        if (orderDateColumn === 'completedAt') {
            pendingOrdersQuery = `
                SELECT COUNT(id) as pendingOrders
                FROM orders
                WHERE status IN ('NEW', 'pending', 'processing', 'ready')
                AND (
                    completedAt BETWEEN :startDate AND :endDate
                    OR (completedAt IS NULL)
                )
            `;
        } else {
            pendingOrdersQuery = `
                SELECT COUNT(id) as pendingOrders
                FROM orders
                WHERE status IN ('NEW', 'pending', 'processing', 'ready')
                AND ${orderDateColumn} BETWEEN :startDate AND :endDate
            `;
        }

        // 3. Đơn hàng hoàn thành (Completed)
        let completedOrdersQuery;
        if (orderDateColumn === 'completedAt') {
            completedOrdersQuery = `
                SELECT COUNT(id) as completedOrders
                FROM orders
                WHERE status = 'completed'
                AND (
                    completedAt BETWEEN :startDate AND :endDate
                    OR (completedAt IS NULL AND status = 'completed')
                )
            `;
        } else {
            completedOrdersQuery = `
                SELECT COUNT(id) as completedOrders
                FROM orders
                WHERE status = 'completed'
                AND ${orderDateColumn} BETWEEN :startDate AND :endDate
            `;
        }

        // Query cho kỳ trước - Completed orders
        let previousCompletedOrdersQuery;
        if (orderDateColumn === 'completedAt') {
            previousCompletedOrdersQuery = `
                SELECT COUNT(id) as completedOrders
                FROM orders
                WHERE status = 'completed'
                AND (
                    completedAt BETWEEN :prevStartDate AND :prevEndDate
                    OR (completedAt IS NULL AND status = 'completed')
                )
            `;
        } else {
            previousCompletedOrdersQuery = `
                SELECT COUNT(id) as completedOrders
                FROM orders
                WHERE status = 'completed'
                AND ${orderDateColumn} BETWEEN :prevStartDate AND :prevEndDate
            `;
        }

        // Thực thi queries
        const [totalOrdersData] = await sequelize.query(totalOrdersQuery, {
            replacements: { startDate, endDate },
            type: sequelize.QueryTypes.SELECT
        });

        const [pendingOrdersData] = await sequelize.query(pendingOrdersQuery, {
            replacements: { startDate, endDate },
            type: sequelize.QueryTypes.SELECT
        });

        const [completedOrdersData] = await sequelize.query(completedOrdersQuery, {
            replacements: { startDate, endDate },
            type: sequelize.QueryTypes.SELECT
        });

        const [previousCompletedOrdersData] = await sequelize.query(previousCompletedOrdersQuery, {
            replacements: { prevStartDate: previousStartDate, prevEndDate: previousEndDate },
            type: sequelize.QueryTypes.SELECT
        });

        const totalOrders = parseInt(totalOrdersData?.totalOrders || 0);
        const pendingOrders = parseInt(pendingOrdersData?.pendingOrders || 0);
        const completedOrders = parseInt(completedOrdersData?.completedOrders || 0);
        const previousCompletedOrders = parseInt(previousCompletedOrdersData?.completedOrders || 0);

        // Tính tỷ lệ tăng trưởng Completed
        let completedGrowthRate = 0;
        if (previousCompletedOrders > 0) {
            completedGrowthRate = ((completedOrders - previousCompletedOrders) / previousCompletedOrders) * 100;
        } else if (completedOrders > 0) {
            completedGrowthRate = 100; // Tăng 100% nếu kỳ trước = 0
        }

        console.log('📦 Orders data:', {
            totalOrders,
            pendingOrders,
            completedOrders,
            completedGrowthRate
        });

        res.json({
            success: true,
            data: {
                totalOrders: totalOrders,
                pendingOrders: pendingOrders,
                completedOrders: completedOrders,
                completedGrowthRate: completedGrowthRate.toFixed(2),
                timeRange: timeRange,
                period: {
                    start: startDate.toISOString(),
                    end: endDate.toISOString()
                }
            }
        });
    } catch (error) {
        console.error('Lỗi lấy thống kê đơn hàng:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi server khi lấy thống kê đơn hàng',
            error: error.message
        });
    }
});

// GET /api/dashboard/products - Lấy thống kê sản phẩm
router.get('/products', auth, async (req, res) => {
    try {
        const { timeRange = 'week' } = req.query; // today, week, month

        const { startDate, endDate, previousStartDate, previousEndDate } = getDateRange(timeRange);

        console.log('📦 Dashboard Products API - timeRange:', timeRange);
        console.log('📅 Date range:', { startDate, endDate });
        console.log('📅 Previous range:', { previousStartDate, previousEndDate });

        // Kiểm tra xem bảng price_rules có created_at column không
        let priceRuleDateColumn = null;
        try {
            const columns = await sequelize.query(`
                SELECT COLUMN_NAME 
                FROM INFORMATION_SCHEMA.COLUMNS 
                WHERE TABLE_SCHEMA = DATABASE() 
                AND TABLE_NAME = 'price_rules' 
                AND COLUMN_NAME IN ('created_at', 'createdAt')
                LIMIT 1
            `, { type: sequelize.QueryTypes.SELECT });

            if (columns && columns.length > 0 && columns[0].COLUMN_NAME) {
                priceRuleDateColumn = columns[0].COLUMN_NAME;
            }
        } catch (error) {
            console.log('Không thể kiểm tra created_at của price_rules');
        }

        // 1. Tổng số sản phẩm (All Products): Tổng số PriceRule
        const allProductsQuery = `
            SELECT COUNT(id) as totalProducts
            FROM price_rules
        `;

        // 2. Sản phẩm đang kinh doanh (Active Products): PriceRule có isActive = true
        // Kiểm tra tên cột isActive trong database
        let isActiveColumn = 'isActive';
        try {
            const activeColumns = await sequelize.query(`
                SELECT COLUMN_NAME 
                FROM INFORMATION_SCHEMA.COLUMNS 
                WHERE TABLE_SCHEMA = DATABASE() 
                AND TABLE_NAME = 'price_rules' 
                AND COLUMN_NAME IN ('isActive', 'is_active')
                LIMIT 1
            `, { type: sequelize.QueryTypes.SELECT });

            if (activeColumns && activeColumns.length > 0 && activeColumns[0].COLUMN_NAME) {
                isActiveColumn = activeColumns[0].COLUMN_NAME;
            }
        } catch (error) {
            console.log('Không thể kiểm tra isActive, dùng isActive');
        }

        const activeProductsQuery = `
            SELECT COUNT(id) as activeProducts
            FROM price_rules
            WHERE ${isActiveColumn} = 1
        `;

        // 3. Sản phẩm mới trong kỳ hiện tại (nếu có created_at)
        let newProductsQuery, previousNewProductsQuery;
        if (priceRuleDateColumn) {
            newProductsQuery = `
                SELECT COUNT(id) as newProducts
                FROM price_rules
                WHERE ${priceRuleDateColumn} BETWEEN :startDate AND :endDate
            `;

            previousNewProductsQuery = `
                SELECT COUNT(id) as newProducts
                FROM price_rules
                WHERE ${priceRuleDateColumn} BETWEEN :prevStartDate AND :prevEndDate
            `;
        } else {
            // Nếu không có created_at, không thể tính sản phẩm mới theo thời gian
            newProductsQuery = `
                SELECT 0 as newProducts
            `;
            previousNewProductsQuery = `
                SELECT 0 as newProducts
            `;
        }

        // Thực thi queries
        const [allProductsData] = await sequelize.query(allProductsQuery, {
            type: sequelize.QueryTypes.SELECT
        });

        const [activeProductsData] = await sequelize.query(activeProductsQuery, {
            type: sequelize.QueryTypes.SELECT
        });

        const [newProductsData] = await sequelize.query(newProductsQuery, {
            replacements: { startDate, endDate },
            type: sequelize.QueryTypes.SELECT
        });

        const [previousNewProductsData] = await sequelize.query(previousNewProductsQuery, {
            replacements: { prevStartDate: previousStartDate, prevEndDate: previousEndDate },
            type: sequelize.QueryTypes.SELECT
        });

        const allProducts = parseInt(allProductsData?.totalProducts || 0);
        const activeProducts = parseInt(activeProductsData?.activeProducts || 0);
        const newProducts = parseInt(newProductsData?.newProducts || 0);
        const previousNewProducts = parseInt(previousNewProductsData?.newProducts || 0);

        // Tính tỷ lệ tăng trưởng sản phẩm mới
        let newProductsGrowthRate = 0;
        if (previousNewProducts > 0) {
            newProductsGrowthRate = ((newProducts - previousNewProducts) / previousNewProducts) * 100;
        } else if (newProducts > 0) {
            newProductsGrowthRate = 100; // Tăng 100% nếu kỳ trước = 0
        }

        console.log('📦 Products data:', {
            allProducts,
            activeProducts,
            newProducts,
            newProductsGrowthRate
        });

        res.json({
            success: true,
            data: {
                allProducts: allProducts,
                activeProducts: activeProducts,
                newProducts: newProducts,
                newProductsGrowthRate: newProductsGrowthRate.toFixed(2),
                timeRange: timeRange,
                period: {
                    start: startDate.toISOString(),
                    end: endDate.toISOString()
                }
            }
        });
    } catch (error) {
        console.error('Lỗi lấy thống kê sản phẩm:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi server khi lấy thống kê sản phẩm',
            error: error.message
        });
    }
});

// GET /api/dashboard/abandoned-cart - Lấy thống kê giỏ hàng bị bỏ quên
router.get('/abandoned-cart', auth, async (req, res) => {
    try {
        const { timeRange = 'week' } = req.query; // today, week, month

        const { startDate, endDate, previousStartDate, previousEndDate } = getDateRange(timeRange);

        console.log('🛒 Dashboard Abandoned Cart API - timeRange:', timeRange);
        console.log('📅 Date range:', { startDate, endDate });
        console.log('📅 Previous range:', { previousStartDate, previousEndDate });

        // Kiểm tra xem bảng orders có created_at column không
        let orderDateColumn = 'completedAt';
        try {
            const columns = await sequelize.query(`
                SELECT COLUMN_NAME 
                FROM INFORMATION_SCHEMA.COLUMNS 
                WHERE TABLE_SCHEMA = DATABASE() 
                AND TABLE_NAME = 'orders' 
                AND COLUMN_NAME IN ('created_at', 'createdAt')
                LIMIT 1
            `, { type: sequelize.QueryTypes.SELECT });

            if (columns && columns.length > 0 && columns[0].COLUMN_NAME) {
                orderDateColumn = columns[0].COLUMN_NAME;
            }
        } catch (error) {
            console.log('Không thể kiểm tra created_at của orders, dùng completedAt');
        }

        // 1. Tổng số đơn hàng trong kỳ (để tính tỷ lệ)
        let totalOrdersQuery;
        if (orderDateColumn === 'completedAt') {
            // Không có createdAt: dùng toàn bộ đơn không bị hủy (all-time) cho cả current & previous
            totalOrdersQuery = `
                SELECT COUNT(id) as totalOrders
                FROM orders
                WHERE status NOT IN ('cancelled')
            `;
        } else {
            totalOrdersQuery = `
                SELECT COUNT(id) as totalOrders
                FROM orders
                WHERE status NOT IN ('cancelled')
                AND ${orderDateColumn} BETWEEN :startDate AND :endDate
            `;
        }

        // 2. Đơn hàng bị bỏ quên (Abandoned): status NEW hoặc pending, chưa completed
        // Nếu có created_at, lấy đơn tạo trong kỳ nhưng chưa completed
        // Nếu không có created_at, lấy tất cả đơn NEW/pending chưa completed
        let abandonedOrdersQuery, abandonedCustomersQuery;
        if (orderDateColumn === 'completedAt') {
            // Không có created_at: lấy tất cả đơn NEW/pending chưa completed
            abandonedOrdersQuery = `
                SELECT COUNT(id) as abandonedOrders
                FROM orders
                WHERE status IN ('NEW', 'pending')
                AND completedAt IS NULL
            `;

            abandonedCustomersQuery = `
                SELECT COUNT(DISTINCT customerId) as abandonedCustomers
                FROM orders
                WHERE status IN ('NEW', 'pending')
                AND completedAt IS NULL
            `;
        } else {
            // Có created_at: lấy đơn tạo trong kỳ nhưng chưa completed
            abandonedOrdersQuery = `
                SELECT COUNT(id) as abandonedOrders
                FROM orders
                WHERE status IN ('NEW', 'pending')
                AND ${orderDateColumn} BETWEEN :startDate AND :endDate
                AND completedAt IS NULL
            `;

            abandonedCustomersQuery = `
                SELECT COUNT(DISTINCT customerId) as abandonedCustomers
                FROM orders
                WHERE status IN ('NEW', 'pending')
                AND ${orderDateColumn} BETWEEN :startDate AND :endDate
                AND completedAt IS NULL
            `;
        }

        // Query cho kỳ trước
        let previousAbandonedOrdersQuery, previousTotalOrdersQuery;
        if (orderDateColumn === 'completedAt') {
            // Không có createdAt: dùng cùng một tập dữ liệu all-time cho previous
            previousAbandonedOrdersQuery = `
                SELECT COUNT(id) as abandonedOrders
                FROM orders
                WHERE status IN ('NEW', 'pending')
                AND completedAt IS NULL
            `;

            previousTotalOrdersQuery = `
                SELECT COUNT(id) as totalOrders
                FROM orders
                WHERE status NOT IN ('cancelled')
            `;
        } else {
            previousAbandonedOrdersQuery = `
                SELECT COUNT(id) as abandonedOrders
                FROM orders
                WHERE status IN ('NEW', 'pending')
                AND ${orderDateColumn} BETWEEN :prevStartDate AND :prevEndDate
                AND completedAt IS NULL
            `;

            previousTotalOrdersQuery = `
                SELECT COUNT(id) as totalOrders
                FROM orders
                WHERE status NOT IN ('cancelled')
                AND ${orderDateColumn} BETWEEN :prevStartDate AND :prevEndDate
            `;
        }

        // Thực thi queries
        const [totalOrdersData] = await sequelize.query(totalOrdersQuery, {
            replacements: { startDate, endDate },
            type: sequelize.QueryTypes.SELECT
        });

        const [abandonedOrdersData] = await sequelize.query(abandonedOrdersQuery, {
            replacements: orderDateColumn === 'completedAt' ? {} : { startDate, endDate },
            type: sequelize.QueryTypes.SELECT
        });

        const [abandonedCustomersData] = await sequelize.query(abandonedCustomersQuery, {
            replacements: orderDateColumn === 'completedAt' ? {} : { startDate, endDate },
            type: sequelize.QueryTypes.SELECT
        });

        const [previousAbandonedOrdersData] = await sequelize.query(previousAbandonedOrdersQuery, {
            replacements: orderDateColumn === 'completedAt' ? {} : { prevStartDate: previousStartDate, prevEndDate: previousEndDate },
            type: sequelize.QueryTypes.SELECT
        });

        const [previousTotalOrdersData] = await sequelize.query(previousTotalOrdersQuery, {
            replacements: { prevStartDate: previousStartDate, prevEndDate: previousEndDate },
            type: sequelize.QueryTypes.SELECT
        });

        const totalOrders = parseInt(totalOrdersData?.totalOrders || 0);
        const abandonedOrders = parseInt(abandonedOrdersData?.abandonedOrders || 0);
        const abandonedCustomers = parseInt(abandonedCustomersData?.abandonedCustomers || 0);
        const previousAbandonedOrders = parseInt(previousAbandonedOrdersData?.abandonedOrders || 0);
        const previousTotalOrders = parseInt(previousTotalOrdersData?.totalOrders || 0);

        // Tính tỷ lệ bỏ giỏ hàng (%)
        let abandonedCartRate = 0;
        if (totalOrders > 0) {
            abandonedCartRate = (abandonedOrders / totalOrders) * 100;
        }

        // Tính tỷ lệ bỏ giỏ hàng kỳ trước
        let previousAbandonedCartRate = 0;
        if (previousTotalOrders > 0) {
            previousAbandonedCartRate = (previousAbandonedOrders / previousTotalOrders) * 100;
        }

        // Tính % thay đổi so với kỳ trước
        let abandonedCartRateChange = 0;
        if (previousAbandonedCartRate > 0) {
            abandonedCartRateChange = ((abandonedCartRate - previousAbandonedCartRate) / previousAbandonedCartRate) * 100;
        } else if (abandonedCartRate > 0) {
            abandonedCartRateChange = 100; // Tăng 100% nếu kỳ trước = 0
        }

        console.log('🛒 Abandoned Cart data:', {
            totalOrders,
            abandonedOrders,
            abandonedCustomers,
            abandonedCartRate,
            abandonedCartRateChange
        });

        res.json({
            success: true,
            data: {
                abandonedCartRate: abandonedCartRate.toFixed(2),
                abandonedCustomers: abandonedCustomers,
                abandonedCartRateChange: abandonedCartRateChange.toFixed(2),
                timeRange: timeRange,
                period: {
                    start: startDate.toISOString(),
                    end: endDate.toISOString()
                }
            }
        });
    } catch (error) {
        console.error('Lỗi lấy thống kê giỏ hàng bị bỏ quên:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi server khi lấy thống kê giỏ hàng bị bỏ quên',
            error: error.message
        });
    }
});

// GET /api/dashboard/summary-chart - Lấy dữ liệu biểu đồ doanh số theo thời gian
router.get('/summary-chart', auth, async (req, res) => {
    try {
        const { days = 7 } = req.query; // 7 hoặc 30 ngày

        const daysCount = parseInt(days) === 30 ? 30 : 7;
        const now = new Date();
        const startDate = new Date(now);
        // Lấy đúng "daysCount" ngày, bao gồm cả hôm nay: ví dụ 7 ngày → now - 6
        startDate.setDate(now.getDate() - (daysCount - 1));
        startDate.setHours(0, 0, 0, 0);
        const endDate = new Date(now);
        endDate.setHours(23, 59, 59, 999);

        console.log('📊 Dashboard Summary Chart API - days:', daysCount);
        console.log('📅 Date range:', { startDate, endDate });

        // Kiểm tra xem bảng orders có created_at column không
        let orderDateColumn = 'completedAt';
        try {
            const columns = await sequelize.query(`
                SELECT COLUMN_NAME 
                FROM INFORMATION_SCHEMA.COLUMNS 
                WHERE TABLE_SCHEMA = DATABASE() 
                AND TABLE_NAME = 'orders' 
                AND COLUMN_NAME IN ('created_at', 'createdAt')
                LIMIT 1
            `, { type: sequelize.QueryTypes.SELECT });

            if (columns && columns.length > 0 && columns[0].COLUMN_NAME) {
                orderDateColumn = columns[0].COLUMN_NAME;
            }
        } catch (error) {
            console.log('Không thể kiểm tra created_at của orders, dùng completedAt');
        }

        // Query doanh thu theo từng ngày
        let dailyRevenueQuery;
        if (orderDateColumn === 'completedAt') {
            // Nếu dùng completedAt, lấy doanh thu từ đơn completed
            dailyRevenueQuery = `
                SELECT 
                    DATE(completedAt) as date,
                    COALESCE(SUM(totalAmount), 0) as revenue
                FROM orders
                WHERE status = 'completed'
                AND completedAt BETWEEN :startDate AND :endDate
                GROUP BY DATE(completedAt)
                ORDER BY DATE(completedAt) ASC
            `;
        } else {
            // Nếu có created_at, lấy doanh thu từ đơn tạo trong ngày (không tính cancelled)
            dailyRevenueQuery = `
                SELECT 
                    DATE(${orderDateColumn}) as date,
                    COALESCE(SUM(totalAmount), 0) as revenue
                FROM orders
                WHERE status NOT IN ('cancelled')
                AND ${orderDateColumn} BETWEEN :startDate AND :endDate
                GROUP BY DATE(${orderDateColumn})
                ORDER BY DATE(${orderDateColumn}) ASC
            `;
        }

        const dailyRevenueData = await sequelize.query(dailyRevenueQuery, {
            replacements: { startDate, endDate },
            type: sequelize.QueryTypes.SELECT
        });

        // Tạo mảng dữ liệu cho tất cả các ngày trong khoảng thời gian
        const dailyData = [];
        const maxRevenue = Math.max(...dailyRevenueData.map(d => parseFloat(d.revenue || 0)), 1);

        for (let i = 0; i < daysCount; i++) {
            const currentDate = new Date(startDate);
            currentDate.setDate(startDate.getDate() + i);
            const dateStr = currentDate.toISOString().split('T')[0];

            const dayData = dailyRevenueData.find(d => {
                const dDate = new Date(d.date);
                return dDate.toISOString().split('T')[0] === dateStr;
            });

            const revenue = dayData ? parseFloat(dayData.revenue || 0) : 0;
            const percentage = maxRevenue > 0 ? (revenue / maxRevenue) * 100 : 0;

            dailyData.push({
                date: dateStr,
                dateLabel: currentDate.toLocaleDateString('vi-VN', { day: 'numeric', month: 'short' }),
                revenue: revenue,
                percentage: percentage
            });
        }

        console.log('📊 Daily revenue data:', dailyData);

        res.json({
            success: true,
            data: {
                days: daysCount,
                maxRevenue: maxRevenue,
                dailyData: dailyData,
                period: {
                    start: startDate.toISOString(),
                    end: endDate.toISOString()
                }
            }
        });
    } catch (error) {
        console.error('Lỗi lấy dữ liệu biểu đồ doanh số:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi server khi lấy dữ liệu biểu đồ doanh số',
            error: error.message
        });
    }
});

// GET /api/dashboard/marketing - Lấy dữ liệu Marketing Donut Chart (3 nhóm khách hàng)
router.get('/marketing', auth, async (req, res) => {
    try {
        const { timeRange = 'week' } = req.query; // today, week, month

        const { startDate, endDate } = getDateRange(timeRange);

        console.log('📊 Dashboard Marketing API - timeRange:', timeRange);
        console.log('📅 Date range:', { startDate, endDate });

        // Kiểm tra xem bảng orders có created_at column không
        let orderDateColumn = 'completedAt';
        try {
            const columns = await sequelize.query(`
                SELECT COLUMN_NAME 
                FROM INFORMATION_SCHEMA.COLUMNS 
                WHERE TABLE_SCHEMA = DATABASE() 
                AND TABLE_NAME = 'orders' 
                AND COLUMN_NAME IN ('created_at', 'createdAt')
                LIMIT 1
            `, { type: sequelize.QueryTypes.SELECT });

            if (columns && columns.length > 0 && columns[0].COLUMN_NAME) {
                orderDateColumn = columns[0].COLUMN_NAME;
            }
        } catch (error) {
            console.log('Không thể kiểm tra created_at của orders, dùng completedAt');
        }

        // Đếm số đơn hàng của mỗi khách hàng trong khoảng thời gian
        let customerOrderCountQuery;
        if (orderDateColumn === 'completedAt') {
            // Nếu dùng completedAt, chỉ tính đơn completed
            customerOrderCountQuery = `
                SELECT 
                    customerId,
                    COUNT(*) as orderCount
                FROM orders
                WHERE status = 'completed'
                AND completedAt BETWEEN :startDate AND :endDate
                GROUP BY customerId
            `;
        } else {
            // Nếu có created_at, tính tất cả đơn không bị cancelled
            customerOrderCountQuery = `
                SELECT 
                    customerId,
                    COUNT(*) as orderCount
                FROM orders
                WHERE status NOT IN ('cancelled')
                AND ${orderDateColumn} BETWEEN :startDate AND :endDate
                GROUP BY customerId
            `;
        }

        const customerOrderCounts = await sequelize.query(customerOrderCountQuery, {
            replacements: { startDate, endDate },
            type: sequelize.QueryTypes.SELECT
        });

        console.log('📊 Customer order counts:', customerOrderCounts);

        // Phân loại khách hàng thành 3 nhóm
        let acquisition = 0; // 1 đơn hàng (lần đầu)
        let purchase = 0;    // 2-4 đơn hàng (quay lại)
        let retention = 0;   // >= 5 đơn hàng (trung thành)

        customerOrderCounts.forEach(row => {
            const orderCount = parseInt(row.orderCount || 0);
            if (orderCount === 1) {
                acquisition++;
            } else if (orderCount >= 2 && orderCount <= 4) {
                purchase++;
            } else if (orderCount >= 5) {
                retention++;
            }
        });

        const total = acquisition + purchase + retention;

        // Tính tỷ lệ phần trăm
        const acquisitionPercent = total > 0 ? ((acquisition / total) * 100).toFixed(1) : 0;
        const purchasePercent = total > 0 ? ((purchase / total) * 100).toFixed(1) : 0;
        const retentionPercent = total > 0 ? ((retention / total) * 100).toFixed(1) : 0;

        const data = {
            acquisition: {
                count: acquisition,
                percentage: parseFloat(acquisitionPercent)
            },
            purchase: {
                count: purchase,
                percentage: parseFloat(purchasePercent)
            },
            retention: {
                count: retention,
                percentage: parseFloat(retentionPercent)
            },
            total: total
        };

        console.log('📊 Marketing data:', data);

        res.json({
            success: true,
            data: data
        });
    } catch (error) {
        console.error('Lỗi lấy dữ liệu Marketing:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi server khi lấy dữ liệu Marketing',
            error: error.message
        });
    }
});

// GET /api/dashboard/recent-orders - Lấy danh sách đơn hàng gần nhất
router.get('/recent-orders', auth, async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 10; // Mặc định 10 đơn hàng

        const OrderItem = require('../models/OrderItem');

        // Kiểm tra xem bảng orders có created_at column không
        let orderDateColumn = 'id';
        let orderDateSelect = 'o.id as orderDate';
        let orderDateOrderBy = 'o.id DESC';
        
        try {
            const columns = await sequelize.query(`
                SELECT COLUMN_NAME 
                FROM INFORMATION_SCHEMA.COLUMNS 
                WHERE TABLE_SCHEMA = DATABASE() 
                AND TABLE_NAME = 'orders' 
                AND COLUMN_NAME IN ('created_at', 'createdAt', 'updatedAt', 'updated_at')
                ORDER BY 
                    CASE COLUMN_NAME 
                        WHEN 'updatedAt' THEN 1
                        WHEN 'updated_at' THEN 2
                        WHEN 'createdAt' THEN 3
                        WHEN 'created_at' THEN 4
                    END
                LIMIT 1
            `, { type: sequelize.QueryTypes.SELECT });

            if (columns && columns.length > 0 && columns[0].COLUMN_NAME) {
                orderDateColumn = columns[0].COLUMN_NAME;
                orderDateSelect = `o.${orderDateColumn} as orderDate`;
                orderDateOrderBy = `o.${orderDateColumn} DESC`;
            }
        } catch (error) {
            console.log('Không thể kiểm tra date column của orders, dùng id');
        }

        console.log('📅 Sử dụng cột date:', orderDateColumn);

        // Lấy danh sách đơn hàng gần nhất bằng raw SQL để join với các bảng liên quan
        // Sắp xếp theo order date (createdAt/updatedAt) hoặc id nếu không có
        const query = `
            SELECT 
                oi.id as itemId,
                oi.orderId,
                oi.printType,
                oi.pages,
                oi.quantity,
                oi.unitPrice,
                oi.lineTotal,
                oi.extraOptions,
                o.completedAt,
                o.status,
                ${orderDateSelect},
                ps.name as paperSizeName,
                ps.widthMm as paperWidth,
                ps.heightMm as paperHeight,
                cm.description as colorModeName,
                s.description as sideName
            FROM order_items oi
            INNER JOIN orders o ON oi.orderId = o.id
            LEFT JOIN paper_sizes ps ON oi.paperSizeId = ps.id
            LEFT JOIN color_modes cm ON oi.colorModeId = cm.id
            LEFT JOIN sides s ON oi.sideId = s.id
            WHERE o.status != 'cancelled'
            ORDER BY 
                ${orderDateOrderBy},
                o.id DESC,
                oi.id DESC
            LIMIT :limit
        `;

        const items = await sequelize.query(query, {
            replacements: { limit: limit * 5 }, // Lấy nhiều hơn để có đủ items
            type: sequelize.QueryTypes.SELECT
        });

        console.log(`📦 Lấy được ${items.length} order items từ database`);

        // Format dữ liệu để trả về
        const recentOrders = items.map(item => {
            let extraOptions = {};
            if (item.extraOptions) {
                if (typeof item.extraOptions === 'string') {
                    try {
                        extraOptions = JSON.parse(item.extraOptions);
                    } catch (e) {
                        console.warn('⚠️ Không parse được extraOptions cho order item', item.id, e);
                        extraOptions = {};
                    }
                } else {
                    extraOptions = item.extraOptions;
                }
            }

            const fileName = extraOptions.fileName || extraOptions.originalFileName || '';
            
            // Tạo tên sản phẩm
            let productName = '';
            if (item.printType === 'PHOTO') {
                productName = fileName || 'Photo';
            } else if (item.printType === 'BANNER') {
                productName = fileName || 'Banner';
            } else {
                productName = fileName || 'Document';
            }

            // Tạo mô tả sản phẩm
            let description = '';
            if (item.printType === 'PHOTO') {
                // Chuyển đổi từ mm sang cm
                const widthCm = item.paperWidth ? (parseFloat(item.paperWidth) / 10).toFixed(1) : '';
                const heightCm = item.paperHeight ? (parseFloat(item.paperHeight) / 10).toFixed(1) : '';
                const size = widthCm && heightCm ? `${widthCm}×${heightCm} cm` : '';
                description = `${size} • ${item.colorModeName || ''} • ${item.quantity} copy`.trim();
            } else if (item.printType === 'BANNER') {
                // Chuyển đổi từ mm sang cm
                const widthCm = item.paperWidth ? (parseFloat(item.paperWidth) / 10).toFixed(1) : '';
                const heightCm = item.paperHeight ? (parseFloat(item.paperHeight) / 10).toFixed(1) : '';
                const size = widthCm && heightCm ? `${widthCm}×${heightCm} cm` : '';
                description = `${size} • ${item.colorModeName || ''}`.trim();
            } else {
                description = `${item.pages || 0} pages • ${item.paperSizeName || ''} • ${item.colorModeName || ''}`.trim();
            }

            return {
                orderId: item.orderId,
                itemId: item.itemId,
                productName: productName,
                printType: item.printType,
                description: description,
                paperSize: item.paperSizeName || '',
                colorMode: item.colorModeName || '',
                side: item.sideName || '',
                pages: item.pages || 0,
                quantity: item.quantity || 1,
                unitPrice: parseFloat(item.unitPrice) || 0,
                discount: 0, // Có thể tính từ order.discount nếu cần
                total: parseFloat(item.lineTotal) || 0,
                extraOptions: extraOptions,
                completedAt: item.completedAt,
                orderDate: item.orderDate
            };
        });

        // Sắp xếp lại theo orderDate để đảm bảo đúng thứ tự (mới nhất trước)
        recentOrders.sort((a, b) => {
            const dateA = a.orderDate ? new Date(a.orderDate) : null;
            const dateB = b.orderDate ? new Date(b.orderDate) : null;

            if (dateA && dateB) {
                return dateB - dateA; // Mới nhất trước
            }
            if (dateA) return -1;
            if (dateB) return 1;
            // Nếu cả hai đều không có date, sắp xếp theo orderId
            return b.orderId - a.orderId;
        });

        // Giới hạn số lượng items
        const limitedOrders = recentOrders.slice(0, limit);
        
        console.log(`✅ Trả về ${limitedOrders.length} đơn hàng gần nhất`);

        res.json({
            success: true,
            data: limitedOrders
        });
    } catch (error) {
        console.error('Lỗi lấy danh sách đơn hàng gần nhất:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi server khi lấy danh sách đơn hàng gần nhất',
            error: error.message
        });
    }
});

module.exports = router;