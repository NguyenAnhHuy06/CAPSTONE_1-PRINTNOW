// routes/orders.js
const { QueryTypes } = require("sequelize");
const express = require("express");
const { body, validationResult } = require("express-validator");
const { sequelize } = require("../config/database");
const { Order, OrderItem } = require("../models");
const auth = require("../middleware/auth");
const router = express.Router();
const controller = require("../controllers/orders.controller");
const RealtimeHub = require("../services/realtimeHub");

// Lấy một số helper từ controller để tránh lặp code
const {
  _broadcastStatus: broadcastOrderStatus,
  _genOrderCode: genOrderCode,
  _mapFrontendStatusToProgress: mapFrontendStatusToProgress,
  _mapFrontendStatusToDbStatus: mapFrontendStatusToDbStatus,
  _ORDER_STAGES: ORDER_STAGES,
  _broadcastDashboardSummaries: broadcastDashboardSummaries,
  _createPaymentNotification: createPaymentNotification,
  _createOrderCreatedNotification: createOrderCreatedNotification,
} = controller;

// ====== Config quyền & tiện ích ======
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@example.com";
const STAFF_EMAIL = process.env.STAFF_EMAIL || "staff@example.com";
const DEFAULT_LIMIT = Number(process.env.API_DEFAULT_LIMIT || 20);

const isPrivileged = (user) =>
  user && (user.email === ADMIN_EMAIL || user.email === STAFF_EMAIL);

const idemCache = new Map(); // key -> { orderId, ts }
function rememberIdem(key, orderId) {
  idemCache.set(key, { orderId, ts: Date.now() });
  // dọn rác đơn giản
  const TTL = 2 * 60 * 1000;
  for (const [k, v] of idemCache)
    if (Date.now() - v.ts > TTL) idemCache.delete(k);
}
function getIdem(key) {
  const v = idemCache.get(key);
  if (!v) return null;
  if (Date.now() - v.ts > 2 * 60 * 1000) {
    idemCache.delete(key);
    return null;
  }
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
router.post("/:orderCode/mark-paid", auth, controller.markPaidManual);

// ====== GET /api/orders/all  (danh sách đơn hàng cho employee/admin) ======
router.get("/all", auth, controller.listAllOrders);

// ====== SUMMARY cho dashboard (This week/month/year + % so sánh) ======
router.get("/summary", auth, controller.getOrdersSummary);
router.get("/summary-multi", auth, controller.getOrdersSummaryMulti);

// ====== SSE realtime dashboard stream (nhân viên) ======
// GET /api/orders/stream?token=...
router.get("/stream", require("../services/streamAuth"), (req, res) => {
  // chỉ cho admin/staff
  const user = req.user;
  const isPriv =
    user &&
    (user.email === (process.env.ADMIN_EMAIL || "").toLowerCase() ||
      user.email === (process.env.STAFF_EMAIL || "").toLowerCase() ||
      String(user.role || "").toLowerCase() === "admin" ||
      String(user.role || "").toLowerCase() === "staff");
  if (!isPriv) return res.status(403).end();

  res.set({
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });
  res.flushHeaders?.();
  res.write(`event: ping\ndata: "ok"\n\n`);

  RealtimeHub.addClient(res);

  // heartbeat
  const iv = setInterval(() => {
    try {
      res.write(`event: ping\ndata: "ok"\n\n`);
    } catch { }
  }, 25000);

  req.on("close", () => {
    clearInterval(iv);
    RealtimeHub.removeClient(res);
  });
});

// ====== PATCH /api/orders/:orderCode/status  (nhân viên cập nhật trạng thái thủ công) ======
router.patch(
  "/:orderCode/status",
  auth,
  body("status").isString().trim().notEmpty(),
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res
        .status(400)
        .json({
          success: false,
          message: "INVALID_STATUS",
          errors: errors.array(),
        });
    }
    return controller.updateStatusByCode(req, res);
  }
);

// [PHOTO API HELPERS] ---------------------------------
async function getIdByCode(table, code) {
  const whitelist = new Set(["sides", "color_modes", "paper_sizes"]);
  if (!whitelist.has(String(table))) throw new Error("INVALID_TABLE");
  const rows = await sequelize.query(
    `SELECT id FROM ${table} WHERE code = :code LIMIT 1`,
    { type: QueryTypes.SELECT, replacements: { code } }
  );
  return rows?.[0]?.id || null;
}

async function ensurePhotoSizes() {
  const defs = [
    { code: "10x15", name: "10 x 15 cm", widthMm: 100.0, heightMm: 150.0 },
    { code: "13x18", name: "13 x 18 cm", widthMm: 130.0, heightMm: 180.0 },
    { code: "15x20", name: "15 x 20 cm", widthMm: 150.0, heightMm: 200.0 },
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
router.post("/photo", auth, async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { note = null, files = [] } = req.body || {};
    const customerId = req.user?.id || null; // ⬅️ gắn từ user đăng nhập
    if (!customerId) {
      await t.rollback();
      return res.status(401).json({ success: false, message: "UNAUTHORIZED" });
    }
    if (!Array.isArray(files) || files.length === 0) {
      await t.rollback();
      return res.status(400).json({ success: false, message: "EMPTY_FILES" });
    }

    // Đảm bảo có ref tối thiểu
    await ensureBasicRefs();
    // Đảm bảo có 3 khổ ảnh
    await ensurePhotoSizes();

    // Map danh mục mặc định
    const sideId = await getIdByCode("sides", "SINGLE"); // In một mặt
    const colorModeId = await getIdByCode("color_modes", "COLOR"); // Full color

    if (!sideId || !colorModeId) {
      await t.rollback();
      return res.status(500).json({
        success: false,
        message: "MISSING_REF_DATA",
        details: {
          needColorModeCode: "COLOR",
          needSideCode: "SINGLE",
        },
      });
    }

    // Tạo Order (dùng model có sẵn)
    const order = await Order.create(
      {
        customerId, // ⬅️ luôn có id user
        note: note || null,
        subtotal: 0,
        discount: 0,
        totalAmount: 0,
        status: "pending",
      },
      { transaction: t }
    );

    // Bảng giá ảnh (giống FE)
    const basePriceMap = { "10x15": 5500, "13x18": 8800, "15x20": 16500 };
    const paperExtra = { Glossy: 0, Matte: 2000, Premium: 4000 };
    const BORDERLESS_MULT = 0.1;

    let subtotal = 0;

    for (const f of files) {
      const sizeCode = String(f.sizeCode || "10x15");
      const paper = String(f.paper || "Glossy");
      const borderless = !!f.borderless;
      const copies = Number(f.copies || 1);
      const name = String(f.name || "photo");

      const base = basePriceMap[sizeCode] ?? basePriceMap["10x15"];
      const extra = paperExtra[paper] ?? 0;
      let amount = (base + extra) * copies;
      if (borderless) amount = Math.round(amount * (1 + BORDERLESS_MULT));
      subtotal += amount;

      // paperSizeId theo code
      const paperSizeRow = await sequelize.query(
        `SELECT id FROM paper_sizes WHERE code = :code LIMIT 1`,
        {
          type: QueryTypes.SELECT,
          transaction: t,
          replacements: { code: sizeCode },
        }
      );
      const paperSizeId = paperSizeRow?.[0]?.id || null;

      await OrderItem.create(
        {
          orderId: order.id,
          printType: "PHOTO",
          pricingMode: "FIXED",
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
          extraOptions: {
            type: "Photo",
            paper,
            borderless,
            fileName: name,
            sizeCode,
          },
        },
        { transaction: t }
      );
    }

    // Update tổng (DB trigger cũng sẽ tự recalc, nhưng ta set cho chắc)
    order.subtotal = subtotal;
    order.totalAmount = subtotal;
    await order.save({ transaction: t });

    // ✅ Commit transaction trước khi trả về
    await t.commit();

    const respOrder = { id: order.id, totalAmount: order.totalAmount };
    res.json({
      success: true,
      order: respOrder,
    });
    // Cập nhật realtime 3 card summary cho dashboard
    try {
      await broadcastDashboardSummaries();
    } catch (e) {
      console.error("broadcastDashboardSummaries error (photo order):", e);
    }

    // 🔔 Notification: khách vừa tạo đơn in ảnh thành công
    try {
      await createOrderCreatedNotification(order);
    } catch (e) {
      console.error("createOrderCreatedNotification error (photo order):", e);
    }
    return;
  } catch (err) {
    console.error("POST /api/orders/photo error", err);
    // tránh throw thêm nếu transaction đã bị đóng
    try {
      await t.rollback();
    } catch { }
    return res.status(500).json({ success: false, message: "SERVER_ERROR" });
  }
});

// Đọc đơn ảnh
// GET /api/orders/photo/:id
router.get("/photo/:id", auth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const order = await Order.findByPk(id, {
      include: [{ model: OrderItem, as: "items" }],
    });

    // Không tìm thấy đơn
    if (!order) {
      return res
        .status(404)
        .json({ success: false, message: "NOT_FOUND" });
    }

    // ===== P0: chỉ chủ đơn hoặc staff/admin mới được xem
    if (
      !isPrivileged(req.user) &&
      Number(order.customerId) !== Number(req.user.id)
    ) {
      return res.status(403).json({ success: false, message: "FORBIDDEN" });
    }

    // Trả đúng format nhẹ nhàng cho FE
    return res.json({
      success: true,
      order: {
        id: order.id,
        customerId: order.customerId,
        note: order.note,
        totalAmount: Number(order.totalAmount),
        createdAt: order.createdAt,
      },
      items: (order.items || []).map((it) => ({
        id: it.id,
        quantity: it.quantity,
        unitPrice: Number(it.unitPrice),
        lineTotal: Number(it.lineTotal),
        extraOptions: it.extraOptions,
        printType: it.printType, // Đảm bảo có printType
      })),
    });
  } catch (err) {
    console.error("GET /api/orders/photo/:id error", err);
    return res.status(500).json({ success: false, message: "SERVER_ERROR" });
  }
});

// [PHOTO API END] -----------------------------------

// ====== REF LOOKUP: GET /api/orders/lookup-ids?paper=A4&color=COLOR&side=SINGLE
router.get("/lookup-ids", async (req, res) => {
  try {
    const { paper, color, side } = req.query;
    const [paperRow] = await sequelize.query(
      "SELECT id FROM paper_sizes WHERE code = :code LIMIT 1",
      { type: QueryTypes.SELECT, replacements: { code: String(paper || "") } }
    );
    const [colorRow] = await sequelize.query(
      "SELECT id FROM color_modes WHERE code = :code LIMIT 1",
      { type: QueryTypes.SELECT, replacements: { code: String(color || "") } }
    );
    const [sideRow] = await sequelize.query(
      "SELECT id FROM sides WHERE code = :code LIMIT 1",
      { type: QueryTypes.SELECT, replacements: { code: String(side || "") } }
    );

    return res.json({
      success: true,
      paperSizeId: paperRow?.id || null,
      colorModeId: colorRow?.id || null,
      sideId: sideRow?.id || null,
    });
  } catch (err) {
    console.error("GET /orders/lookup-ids error:", err);
    return res.status(500).json({ success: false, message: "SERVER_ERROR" });
  }
});

// ====== CONFIRM PAY AT STORE (COD) ======
// Chuẩn hoá: dùng controller + bắt buộc auth
router.post("/:id/confirm-store", auth, controller.confirmStorePayment);

// ====== MARK CASH PAID (nhân viên xác nhận đã thu tiền) ======
router.post("/:id/mark-cash-paid", auth, async (req, res) => {
  const t = await sequelize.transaction();
  try {
    // ===== P0: chỉ staff/admin
    if (!isPrivileged(req.user)) {
      await t.rollback();
      return res.status(403).json({ success: false, message: "FORBIDDEN" });
    }
    const orderId = Number(req.params.id);
    let orderCode = null;

    const payment = await sequelize.query(
      `SELECT * FROM payments WHERE order_id = :orderId LIMIT 1`,
      { type: QueryTypes.SELECT, transaction: t, replacements: { orderId } }
    );

    if (!payment?.length) {
      await t.rollback();
      return res
        .status(404)
        .json({ success: false, message: "PAYMENT_NOT_FOUND" });
    }
    if (payment[0].status === "SUCCESS") {
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

    // Lấy createdAt để gen ra orderCode đúng format (#ORD-YYYY-XXX)
    const [orderRow] = await sequelize.query(
      `SELECT id, createdAt FROM orders WHERE id = :orderId LIMIT 1`,
      { type: QueryTypes.SELECT, transaction: t, replacements: { orderId } }
    );
    if (orderRow) {
      orderCode = genOrderCode(orderRow);
    }

    // Đọc lại bản ghi đã cập nhật để FE có id/status mới nhất
    const [updated] = await sequelize.query(
      `SELECT id, order_id AS orderId, method, status, amount, currency, paid_at AS paidAt, created_at AS createdAt, updated_at AS updatedAt
       FROM payments WHERE order_id = :orderId LIMIT 1`,
      { type: QueryTypes.SELECT, transaction: t, replacements: { orderId } }
    );

    await t.commit();

    // 🔔 Tạo notification cho khách: đã nhận tiền mặt tại quầy
    try {
      if (typeof createPaymentNotification === "function") {
        const paidAmount = updated?.amount ?? payment[0].amount ?? 0;
        await createPaymentNotification(orderId, paidAmount, "CASH", orderCode);
      }
    } catch (e) {
      console.error("createPaymentNotification error (mark-cash-paid):", e);
    }

    // Sau khi commit: Broadcast SSE cho UI khách đang mở trang Order Status
    if (orderCode) {
      const prog = mapFrontendStatusToProgress("in-progress"); // ~60%, stage "Printing"
      broadcastOrderStatus(orderCode, {
        status: "In-Progress",
        dbStatus: "processing",
        progress: prog.progress,
        currentStage: prog.currentStage,
        stages: ORDER_STAGES,
        updatedAt: new Date().toISOString(),
      });
    }
    const json = { success: true, payment: updated };
    res.json(json);
    // Đồng bộ 3 card summary
    try {
      await broadcastDashboardSummaries();
    } catch (e) {
      console.error("broadcastDashboardSummaries error (mark-cash-paid):", e);
    }
    return;
  } catch (err) {
    console.error("POST /orders/:id/mark-cash-paid error", err);
    await t.rollback();
    return res.status(500).json({ success: false, message: "SERVER_ERROR" });
  }
});

// ====== POST /api/orders  (create) ======
router.post(
  "/",
  auth,
  [
    body("note").optional().isString().withMessage("Ghi chú phải là chuỗi"),
    body("orderItems")
      .isArray({ min: 1 })
      .withMessage("Đơn hàng phải có ít nhất 1 item"),
    body("orderItems.*.printType")
      .isIn(["DOCUMENT", "PHOTO", "BANNER"])
      .withMessage("Loại in không hợp lệ"),
    body("orderItems.*.pricingMode")
      .isIn(["PER_PAGE", "PER_SHEET", "FIXED"])
      .withMessage("Chế độ tính giá không hợp lệ"),
    body("orderItems.*.paperSizeId")
      .isInt({ gt: 0 })
      .withMessage("ID kích thước giấy không hợp lệ"),
    body("orderItems.*.colorModeId")
      .isInt({ gt: 0 })
      .withMessage("ID chế độ màu không hợp lệ"),
    body("orderItems.*.sideId")
      .isInt({ gt: 0 })
      .withMessage("ID chế độ in không hợp lệ"),
    body("orderItems.*.pages")
      .isInt({ gt: 0 })
      .withMessage("Số trang phải lớn hơn 0"),
    body("orderItems.*.quantity")
      .isInt({ gt: 0 })
      .withMessage("Số lượng phải lớn hơn 0"),
    body("orderItems.*.unitPrice")
      .isDecimal()
      .withMessage("Giá đơn vị không hợp lệ"),
  ],
  async (req, res) => {
    try {
      const idemKey = req.get("X-Idempotency-Key");
      if (idemKey) {
        const existedOrderId = getIdem(idemKey);
        if (existedOrderId) {
          const existed = await Order.findByPk(existedOrderId, {
            include: [{ model: OrderItem, as: "items" }],
          });
          return res
            .status(201)
            .json({
              success: true,
              message: "Tạo đơn hàng thành công",
              order: existed,
            });
        }
      }
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res
          .status(400)
          .json({
            success: false,
            message: "Dữ liệu không hợp lệ",
            errors: errors.array(),
          });
      }

      const { note, orderItems, status: frontendStatus } = req.body;
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
        // Map trạng thái FE (Pending / In-Progress / Ready / Completed)
        // sang trạng thái trong DB (pending / processing / ready / completed / cancelled)
        let dbStatus = mapFrontendStatusToDbStatus(frontendStatus || "pending");
        // Không cho tạo đơn mới ở trạng thái "cancelled" -> ép về "pending"
        if (dbStatus === "cancelled") {
          dbStatus = "pending";
        }

        const order = await Order.create(
          {
            customerId,
            note: note || null,
            subtotal,
            discount: 0,
            totalAmount: subtotal,
            status: dbStatus,
          },
          { transaction: t }
        );

        const itemsWithOrderId = itemsToCreate.map((it) => ({
          ...it,
          orderId: order.id,
        }));
        await OrderItem.bulkCreate(itemsWithOrderId, { transaction: t });

        const fullOrder = await Order.findByPk(order.id, {
          include: [{ model: OrderItem, as: "items" }],
          transaction: t,
        });

        if (idemKey) rememberIdem(idemKey, order.id);
        return fullOrder;
      });

      // Publish realtime cho dashboard
      try {
        const mapped = controller._toDashboardRow(result);
        RealtimeHub.publish({ type: 'orders.created', ts: Date.now(), data: mapped });
      } catch (e) { /* ignore */ }

      // Đồng bộ 3 card summary (tuần/tháng/năm) cho dashboard qua SSE
      try {
        await broadcastDashboardSummaries();
      } catch (e) {
        console.error("broadcastDashboardSummaries error (create order):", e);
      }

      // 🔔 Notification: khách vừa tạo đơn in tài liệu thành công
      try {
        await createOrderCreatedNotification(result);
      } catch (e) {
        console.error("createOrderCreatedNotification error (create order):", e);
      }

      res
        .status(201)
        .json({ success: true, message: "Tạo đơn hàng thành công", order: result });
    } catch (error) {
      console.error("POST /orders error:", error);
      res
        .status(500)
        .json({ success: false, message: "Lỗi server", error: error.message });
    }
  }
);

// ====== GET /api/orders/:id  (chi tiết đơn hàng của user hiện tại) ======
router.get("/:id", auth, controller.getMyOrderById);

// ====== POST /api/orders/:orderCode/cancel  (khách tự hủy nếu pending) ======
router.post("/:orderCode/cancel", auth, controller.cancelMyOrder);

// =========================================================================
module.exports = router;
