// routes/orders.js
const { QueryTypes } = require('sequelize');
const express = require('express');
const { body, validationResult } = require('express-validator');
const { sequelize } = require('../config/database');
const { Order, OrderItem } = require('../models');
const auth = require('../middleware/auth');
const router = express.Router();
const controller = require("../controllers/orders.controller");

// ====== Config quyền & tiện ích ======
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@example.com';
const STAFF_EMAIL = process.env.STAFF_EMAIL || 'staff@example.com';
const DEFAULT_LIMIT = Number(process.env.API_DEFAULT_LIMIT || 20);

const isPrivileged = (user) =>
  user && (user.email === ADMIN_EMAIL || user.email === STAFF_EMAIL);

const idemCache = new Map(); // key -> { orderId, ts }
function rememberIdem(key, orderId) {
  idemCache.set(key, { orderId, ts: Date.now() });
  // dọn rác đơn giản
  const TTL = 2 * 60 * 1000;
  for (const [k, v] of idemCache) if (Date.now() - v.ts > TTL) idemCache.delete(k);
}
function getIdem(key) {
  const v = idemCache.get(key);
  if (!v) return null;
  if (Date.now() - v.ts > 2 * 60 * 1000) { idemCache.delete(key); return null; }
  return v.orderId;
}

// ====== GET /api/orders  (danh sách đơn hàng của user hiện tại) ======
router.get("/", auth, controller.listMyOrders);

// ====== GET /api/orders/by-code/:orderCode  (chi tiết đơn theo mã hiển thị) ======
router.get("/by-code/:orderCode", auth, controller.getMyOrderByCode);


// ====== SSE: client lắng nghe trạng thái thanh toán theo orderCode ======
// GET /api/orders/:orderCode/stream
router.get("/:orderCode/stream", controller.streamOrderPayment);

// ====== Webhook: provider báo tiền vào (body: {orderCode, paidAmount}) ======
// POST /api/orders/webhooks/casso
router.post("/webhooks/casso", controller.webhookCassoLike);

// ====== Test nhanh: tự đánh dấu đã thanh toán ======
// POST /api/orders/:orderCode/mark-paid  {paidAmount}
router.post("/:orderCode/mark-paid", controller.markPaidManual);

// [PHOTO API HELPERS] ---------------------------------
async function getIdByCode(table, code) {
  const whitelist = new Set(['sides', 'color_modes', 'paper_sizes']);
  if (!whitelist.has(String(table))) throw new Error('INVALID_TABLE');
  const rows = await sequelize.query(
    `SELECT id FROM ${table} WHERE code = :code LIMIT 1`,
    { type: QueryTypes.SELECT, replacements: { code } }
  );
  return rows?.[0]?.id || null;
}

async function ensurePhotoSizes() {
  const defs = [
    { code: '10x15', name: '10 x 15 cm', widthMm: 100.0, heightMm: 150.0 },
    { code: '13x18', name: '13 x 18 cm', widthMm: 130.0, heightMm: 180.0 },
    { code: '15x20', name: '15 x 20 cm', widthMm: 150.0, heightMm: 200.0 },
  ];
  for (const d of defs) {
    await sequelize.query(
      `INSERT INTO paper_sizes (code, name, widthMm, heightMm, isActive)
       SELECT :code, :name, :widthMm, :heightMm, 1
       WHERE NOT EXISTS (SELECT 1 FROM paper_sizes WHERE code=:code)`,
      { type: QueryTypes.INSERT, replacements: d }
    );
  }
}

// 👇 THÊM MỚI: đảm bảo ref cơ bản tồn tại (COLOR màu & SINGLE 1 mặt)
async function ensureBasicRefs() {
  // color_modes: 'COLOR'
  await sequelize.query(
    `INSERT INTO color_modes (code, description, isActive)
     SELECT 'COLOR', 'Full color', 1
     WHERE NOT EXISTS (SELECT 1 FROM color_modes WHERE code='COLOR')`,
    { type: QueryTypes.INSERT }
  );

  // sides: 'SINGLE'
  await sequelize.query(
    `INSERT INTO sides (code, description, isActive)
     SELECT 'SINGLE', 'Single-sided', 1
     WHERE NOT EXISTS (SELECT 1 FROM sides WHERE code='SINGLE')`,
    { type: QueryTypes.INSERT }
  );
}

// [PHOTO API START] ---------------------------------

// Tạo đơn in ảnh
// POST /api/orders/photo
router.post('/photo', auth, async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { note = null, files = [] } = req.body || {};
    const customerId = req.user?.id || null; // ⬅️ gắn từ user đăng nhập
    if (!customerId) {
      await t.rollback();
      return res.status(401).json({ success: false, message: 'UNAUTHORIZED' });
    }
    if (!Array.isArray(files) || files.length === 0) {
      await t.rollback();
      return res.status(400).json({ success: false, message: 'EMPTY_FILES' });
    }

    // Đảm bảo có ref tối thiểu
    await ensureBasicRefs();
    // Đảm bảo có 3 khổ ảnh
    await ensurePhotoSizes();

    // Map danh mục mặc định
    const sideId = await getIdByCode('sides', 'SINGLE');        // In một mặt
    const colorModeId = await getIdByCode('color_modes', 'COLOR'); // Full color

    if (!sideId || !colorModeId) {
      await t.rollback();
      return res.status(500).json({
        success: false,
        message: 'MISSING_REF_DATA',
        details: {
          needColorModeCode: 'COLOR',
          needSideCode: 'SINGLE'
        }
      });
    }

    // Tạo Order (dùng model có sẵn)
    const order = await Order.create({
      customerId,                      // ⬅️ luôn có id user
      note: note || null,
      subtotal: 0,
      discount: 0,
      totalAmount: 0,
      status: 'pending',
    },
      { transaction: t }
    );

    // Bảng giá ảnh (giống FE)
    const basePriceMap = { '10x15': 5500, '13x18': 8800, '15x20': 16500 };
    const paperExtra = { 'Glossy': 0, 'Matte': 2000, 'Premium': 4000 };
    const BORDERLESS_MULT = 0.10;

    let subtotal = 0;

    for (const f of files) {
      const sizeCode = String(f.sizeCode || '10x15');
      const paper = String(f.paper || 'Glossy');
      const borderless = !!f.borderless;
      const copies = Number(f.copies || 1);
      const name = String(f.name || 'photo');

      const base = basePriceMap[sizeCode] ?? basePriceMap['10x15'];
      const extra = paperExtra[paper] ?? 0;
      let amount = (base + extra) * copies;
      if (borderless) amount = Math.round(amount * (1 + BORDERLESS_MULT));
      subtotal += amount;

      // paperSizeId theo code
      const paperSizeRow = await sequelize.query(
        `SELECT id FROM paper_sizes WHERE code = :code LIMIT 1`,
        { type: QueryTypes.SELECT, transaction: t, replacements: { code: sizeCode } }
      );
      const paperSizeId = paperSizeRow?.[0]?.id || null;

      await OrderItem.create(
        {
          orderId: order.id,
          printType: 'PHOTO',
          pricingMode: 'FIXED',
          // Không có cột fileName trong model -> đưa vào extraOptions

          // Ảnh: 1 "trang" mỗi tấm, quantity = số bản in
          pages: 1,
          quantity: copies,

          paperSizeId,
          colorModeId,
          sideId,

          unitPrice: Math.round(amount / Math.max(1, copies)),
          lineTotal: amount,

          // Tùy chọn bổ sung
          extraOptions: { type: 'Photo', paper, borderless, fileName: name, sizeCode }
        },
        { transaction: t }
      );
    }

    // Update tổng
    order.subtotal = subtotal;
    order.totalAmount = subtotal;
    await order.save({ transaction: t });

    await t.commit();
    return res.json({ success: true, order: { id: order.id, totalAmount: order.totalAmount } });
  } catch (err) {
    console.error('POST /api/orders/photo error', err);
    await t.rollback();
    return res.status(500).json({ success: false, message: 'SERVER_ERROR' });
  }
});

// Đọc đơn ảnh
// GET /api/orders/photo/:id
router.get('/photo/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const order = await Order.findByPk(id, {
      include: [{ model: OrderItem, as: 'items' }]
    });
    if (!order) return res.status(404).json({ success: false, message: 'NOT_FOUND' });

    // Trả đúng format nhẹ nhàng cho FE
    return res.json({
      success: true,
      order: {
        id: order.id,
        customerId: order.customerId,
        note: order.note,
        totalAmount: Number(order.totalAmount),
        createdAt: order.createdAt
      },
      items: (order.items || []).map(it => ({
        id: it.id,
        quantity: it.quantity,
        unitPrice: Number(it.unitPrice),
        lineTotal: Number(it.lineTotal),
        extraOptions: it.extraOptions,
        printType: it.printType // Đảm bảo có printType
      }))
    });
  } catch (err) {
    console.error('GET /api/orders/photo/:id error', err);
    return res.status(500).json({ success: false, message: 'SERVER_ERROR' });
  }
});

// [PHOTO API END] -----------------------------------

// ====== REF LOOKUP: GET /api/orders/lookup-ids?paper=A4&color=COLOR&side=SINGLE
router.get('/lookup-ids', async (req, res) => {
  try {
    const { paper, color, side } = req.query;
    const [paperRow] = await sequelize.query(
      'SELECT id FROM paper_sizes WHERE code = :code LIMIT 1',
      { type: QueryTypes.SELECT, replacements: { code: String(paper || '') } }
    );
    const [colorRow] = await sequelize.query(
      'SELECT id FROM color_modes WHERE code = :code LIMIT 1',
      { type: QueryTypes.SELECT, replacements: { code: String(color || '') } }
    );
    const [sideRow] = await sequelize.query(
      'SELECT id FROM sides WHERE code = :code LIMIT 1',
      { type: QueryTypes.SELECT, replacements: { code: String(side || '') } }
    );

    return res.json({
      success: true,
      paperSizeId: paperRow?.id || null,
      colorModeId: colorRow?.id || null,
      sideId: sideRow?.id || null,
    });
  } catch (err) {
    console.error('GET /orders/lookup-ids error:', err);
    return res.status(500).json({ success: false, message: 'SERVER_ERROR' });
  }
});

// ====== CONFIRM PAY AT STORE (COD) ======
// Chuẩn hoá: dùng controller + bắt buộc auth
router.post('/:id/confirm-store', auth, controller.confirmStorePayment);

// ====== MARK CASH PAID (nhân viên xác nhận đã thu tiền) ======
router.post('/:id/mark-cash-paid', async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const orderId = Number(req.params.id);

    const payment = await sequelize.query(
      `SELECT * FROM payments WHERE order_id = :orderId LIMIT 1`,
      { type: QueryTypes.SELECT, transaction: t, replacements: { orderId } }
    );

    if (!payment?.length) {
      await t.rollback();
      return res.status(404).json({ success: false, message: 'PAYMENT_NOT_FOUND' });
    }
    if (payment[0].status === 'SUCCESS') {
      await t.rollback();
      return res.json({ success: true }); // đã success rồi
    }

    await sequelize.query(
      `UPDATE payments
         SET status = 'SUCCESS',
             paid_at = NOW(),
             updated_at = NOW()
       WHERE order_id = :orderId`,
      { type: QueryTypes.UPDATE, transaction: t, replacements: { orderId } }
    );

    await sequelize.query(
      `UPDATE orders SET status='processing', updatedAt = NOW() WHERE id=:orderId`,
      { type: QueryTypes.UPDATE, transaction: t, replacements: { orderId } }
    );

    // Đọc lại bản ghi đã cập nhật để FE có id/status mới nhất
    const [updated] = await sequelize.query(
      `SELECT id, order_id AS orderId, method, status, amount, currency, paid_at AS paidAt, created_at AS createdAt, updated_at AS updatedAt
       FROM payments WHERE order_id = :orderId LIMIT 1`,
      { type: QueryTypes.SELECT, transaction: t, replacements: { orderId } }
    );

    await t.commit();
    return res.json({ success: true, payment: updated });
  } catch (err) {
    console.error('POST /orders/:id/mark-cash-paid error', err);
    await t.rollback();
    return res.status(500).json({ success: false, message: 'SERVER_ERROR' });
  }
});

// ====== POST /api/orders  (create) ======
router.post(
  '/',
  auth,
  [
    body('note').optional().isString().withMessage('Ghi chú phải là chuỗi'),
    body('orderItems').isArray({ min: 1 }).withMessage('Đơn hàng phải có ít nhất 1 item'),
    body('orderItems.*.printType').isIn(['DOCUMENT', 'PHOTO', 'BANNER']).withMessage('Loại in không hợp lệ'),
    body('orderItems.*.pricingMode').isIn(['PER_PAGE', 'PER_SHEET', 'FIXED']).withMessage('Chế độ tính giá không hợp lệ'),
    body('orderItems.*.paperSizeId').isInt({ gt: 0 }).withMessage('ID kích thước giấy không hợp lệ'),
    body('orderItems.*.colorModeId').isInt({ gt: 0 }).withMessage('ID chế độ màu không hợp lệ'),
    body('orderItems.*.sideId').isInt({ gt: 0 }).withMessage('ID chế độ in không hợp lệ'),
    body('orderItems.*.pages').isInt({ gt: 0 }).withMessage('Số trang phải lớn hơn 0'),
    body('orderItems.*.quantity').isInt({ gt: 0 }).withMessage('Số lượng phải lớn hơn 0'),
    body('orderItems.*.unitPrice').isDecimal().withMessage('Giá đơn vị không hợp lệ'),
  ],
  async (req, res) => {
    try {
      const idemKey = req.get('X-Idempotency-Key');
      if (idemKey) {
        const existedOrderId = getIdem(idemKey);
        if (existedOrderId) {
          const existed = await Order.findByPk(existedOrderId, { include: [{ model: OrderItem, as: 'items' }] });
          return res.status(201).json({ success: true, message: 'Tạo đơn hàng thành công', order: existed });
        }
      }
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, message: 'Dữ liệu không hợp lệ', errors: errors.array() });
      }

      const { note, orderItems } = req.body;
      const customerId = req.user.id;

      // Tính tổng
      let subtotal = 0;
      const itemsToCreate = orderItems.map((it) => {
        const lineTotal = Number(it.unitPrice) * Number(it.quantity);
        subtotal += lineTotal;
        return { ...it, lineTotal };
      });

      // Transaction
      const result = await sequelize.transaction(async (t) => {
        const order = await Order.create(
          {
            customerId,
            note: note || null,
            subtotal,
            discount: 0,
            totalAmount: subtotal,
            status: 'pending',
          },
          { transaction: t }
        );

        const itemsWithOrderId = itemsToCreate.map((it) => ({ ...it, orderId: order.id }));
        await OrderItem.bulkCreate(itemsWithOrderId, { transaction: t });

        const fullOrder = await Order.findByPk(order.id, {
          include: [{ model: OrderItem, as: 'items' }],
          transaction: t,
        });


        if (idemKey) rememberIdem(idemKey, order.id);
        return fullOrder;
      });

      res.status(201).json({ success: true, message: 'Tạo đơn hàng thành công', order: result });
    } catch (error) {
      console.error('POST /orders error:', error);
      res.status(500).json({ success: false, message: 'Lỗi server', error: error.message });
    }
  }
);

// ====== GET /api/orders/:id  (chi tiết đơn hàng của user hiện tại) ======
router.get("/:id", auth, controller.getMyOrderById);

// ====== POST /api/orders/:orderCode/cancel  (khách tự hủy nếu pending) ======
router.post("/:orderCode/cancel", auth, controller.cancelMyOrder);

// =========================================================================
module.exports = router;
