// routes/notifications.js
const express = require('express');
const { Op } = require('sequelize');
const Notification = require('../models/Notification');
const auth = require('../middleware/auth');

const router = express.Router();

// helper: chuẩn hoá bản ghi theo shape FE
const toFE = (row) => {
    const createdAt = row.created_at || row.createdAt || row.get?.('created_at');
    // parse orderCode từ link (nếu có dạng ...?orderCode=XXX)
    const parseOrderCode = (link) => {
        if (!link) return null;
        try {
            const u = new URL(link, 'http://localhost'); // base giả để parse query
            return u.searchParams.get('orderCode');
        } catch {
            return null;
        }
    };
    return {
        id: row.id,
        userId: row.userId,
        title: row.title,
        body: row.message,                        // map từ DB
        type: row.type || 'info',
        isRead: !!row.isRead,
        createdAt,                                // FE đang dùng camelCase
        // "data" tổng hợp từ các cột có thật trong DB
        data: {
            link: row.link || null,
            linkText: row.link ? 'Xem chi tiết' : null,
            tag: row.tag,
            important: row.tag === 'important',
            orderCode: parseOrderCode(row.link)
        }
    };
};
// --- đặt TRƯỚC router.get('/:id') ---
const seedHandler = async (req, res) => {
    try {
        const userId = req.user.id;
        // Cho phép seed tối đa 100 (đủ cho nhu cầu 50–70)
        const count = Math.min(parseInt(req.query.count || '25', 10), 100);
        const maxDays = Math.min(parseInt(req.query.days || '10', 10), 60);
        const makeTsAgo = (m) => new Date(Date.now() - m * 60 * 1000);

        const primaries = [
            {
                orderCode: 'ORD-2025-001', title: 'Order #ORD-2025-001 Completed',
                message: 'Your 100-page document order is ready for in-store pickup. Please bring your order number with you when you arrive.',
                type: 'success', tag: 'important', minutesAgo: 5
            },
            {
                orderCode: 'ORD-2025-002', title: 'Order #ORD-2025-002 is being processed',
                message: 'Order to print 200 name cards is in the process of printing. Estimated completion time: 2 hours.',
                type: 'processing', tag: 'none', minutesAgo: 30
            },
            {
                orderCode: 'ORD-2025-002', title: 'Payment successful',
                message: 'Payment of 150,000 VND has been received for order #ORD-2025-002. Thank you for using the service!',
                type: 'success', tag: 'important', minutesAgo: 120
            },
            {
                orderCode: 'ORD-2025-004', title: 'Order #ORD-2025-004 has been confirmed',
                message: 'Order for printing 10 ceramic cups has been confirmed and is pending. Estimated completion time: 1 day.',
                type: 'info', tag: 'none', minutesAgo: 5 * 24 * 60
            },
            {
                orderCode: null, title: 'System update',
                message: 'The system has been updated with new features: Realtime order tracking and multiple payment methods.',
                type: 'neutral', tag: 'none', minutesAgo: 5 * 24 * 60
            },
        ];

        const more = [
            (oc) => ({ title: `Order #${oc} is ready for pickup`, message: `Your order ${oc} has finished printing. You can pick it up at the counter.`, type: 'success', tag: 'none' }),
            (oc) => ({ title: `Order #${oc} is being processed`, message: `Your order ${oc} is in queue. Estimated completion time: 2–3 hours.`, type: 'processing', tag: 'none' }),
            (oc) => ({ title: `Payment received for ${oc}`, message: `We have received your payment for ${oc}.`, type: 'success', tag: 'none' }),
            (oc) => ({ title: `Artwork issue detected for ${oc}`, message: 'Your file contains low-resolution images. Please re-upload a higher resolution file.', type: 'error', tag: 'important' }),
            (oc) => ({ title: `Shipping update for ${oc}`, message: 'Your order has been handed over to the courier.', type: 'info', tag: 'none' }),
            (oc) => ({ title: `Order ${oc} delayed`, message: 'High workload today. Your order may be delayed by 4–6 hours.', type: 'info', tag: 'none' }),
            (oc) => ({ title: `Coupon applied successfully`, message: 'Promo code PRINTNOW10 was applied to your order.', type: 'success', tag: 'none' }),
            (oc) => ({ title: `Invoice available for ${oc}`, message: 'Your VAT invoice is ready to download.', type: 'info', tag: 'none' }),
        ];

        const rows = [];
        const toDb = (u, { orderCode, title, message, type, tag, minutesAgo }, i) => ({
            userId: u,
            title, message, type, tag,
            link: orderCode ? `/order/status?orderCode=${encodeURIComponent(orderCode)}` : null,
            isRead: i % 3 === 0 ? 1 : 0,
            created_at: makeTsAgo(minutesAgo ?? (10 + i * 7)),
        });

        primaries.forEach((p, i) => rows.push(toDb(userId, p, i)));

        const need = Math.max(0, count - rows.length);
        for (let i = 0; i < need; i++) {
            const oc = `ORD-2025-${String(100 + i).padStart(3, '0')}`;
            const pick = more[i % more.length](oc);
            const randMin = Math.floor(Math.random() * (maxDays * 24 * 60));
            rows.push(toDb(userId, { ...pick, orderCode: oc, minutesAgo: randMin }, i + primaries.length));
        }

        await Notification.bulkCreate(rows, { validate: true });
        const unreadCount = await Notification.count({ where: { userId, isRead: 0 } });
        res.json({ success: true, inserted: rows.length, unreadCount });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
};

router.post('/seed', auth, seedHandler);
router.get('/seed', auth, seedHandler); // tiện cho việc gõ URL trực tiếp

// GET /api/notifications?limit=50&offset=0&unread=1
router.get('/', auth, async (req, res) => {
    try {
        const userId = req.user.id;
        const limit = parseInt(req.query.limit, 10) || 50;
        const offset = parseInt(req.query.offset, 10) || 0;
        const unreadOnly = req.query.unread === '1' || req.query.unread === 'true';

        const where = { userId };
        if (unreadOnly) where.isRead = 0;

        const [rows, unreadCount] = await Promise.all([
            Notification.findAll({
                where,
                order: [['created_at', 'DESC']],
                limit, offset
            }),
            Notification.count({ where: { userId, isRead: 0 } })
        ]);

        res.json({
            success: true,
            notifications: rows.map(toFE),
            unreadCount
        });
    } catch (e) {
        res.status(500).json({ success: false, message: 'Lỗi server', error: e.message });
    }
});

// GET /api/notifications/:id  (id chỉ là số để tránh “read/seed” bị nuốt)
router.get('/:id(\\d+)', auth, async (req, res) => {
    const row = await Notification.findByPk(req.params.id);
    if (!row || String(row.userId) !== String(req.user.id)) {
        return res.status(404).json({ success: false, message: 'Not found' });
    }
    res.json({ success: true, notification: toFE(row) });
});

// PUT /api/notifications/:id/read  (id chỉ là số)
router.put('/:id(\\d+)/read', auth, async (req, res) => {
    const row = await Notification.findByPk(req.params.id);
    if (!row || String(row.userId) !== String(req.user.id)) {
        return res.status(404).json({ success: false, message: 'Not found' });
    }
    row.isRead = 1;
    await row.save();
    res.json({ success: true });
});

// PUT /api/notifications/mark-all-read
router.put('/mark-all-read', auth, async (req, res) => {
    await Notification.update(
        { isRead: 1 },
        { where: { userId: req.user.id, isRead: 0 } }
    );
    res.json({ success: true });
});

// DELETE /api/notifications/read  (xoá tất cả đã đọc) — đặt TRƯỚC '/:id'
router.delete('/read', auth, async (req, res) => {
    const count = await Notification.destroy({
        where: { userId: req.user.id, isRead: 1 }
    });
    res.json({ success: true, deleted: count });
});

// DELETE /api/notifications/:id  (id chỉ là số)
router.delete('/:id(\\d+)', auth, async (req, res) => {
    const row = await Notification.findByPk(req.params.id);
    if (!row || String(row.userId) !== String(req.user.id)) {
        return res.status(404).json({ success: false, message: 'Not found' });
    }
    await row.destroy();
    res.json({ success: true });
});

module.exports = router;
