// controllers/orders.controller.js
const { Op } = require("sequelize");
const db = require("../models");
const { QueryTypes } = require("sequelize");
const { sequelize } = require("../config/database");

// ----- Helper: Fully-qualified table name theo DB hiện tại -----
const DB = (sequelize.config && sequelize.config.database) || process.env.DB_NAME;
const T = (name) => `\`${DB}\`.\`${name}\``;  // ví dụ: `printnow`.`payments`


// Parse "#ORD-YYYY-000123" => 123
function resolveOrderIdFromOrderCode(orderCode) {
  const s = String(orderCode || "").toUpperCase().trim();
  // ORD với hoặc không có #, và cho phép mọi ký tự ngăn cách không-phải-số
  let m = s.match(/#?ORD\D?(\d{4})\D?(\d{1,6})$/i);
  if (m) return Number(m[2]);
  // DOC/PHOTO-000123 | DOC000123 | PHOTO 123
  m = s.match(/(DOC|PHOTO)[-.\s]?(\d{1,10})/i);
  if (m) return Number(m[2]);
  return null;
}

// parse "createdAt:DESC"
function parseSort(sortStr) {
  if (!sortStr) return [["createdAt", "DESC"]];
  const [col, dir] = String(sortStr).split(":");
  const direction = (dir || "DESC").toUpperCase() === "ASC" ? "ASC" : "DESC";
  return [[col || "createdAt", direction]];
}

// "#ORD-YYYY-XXX"
function genOrderCode(o) {
  const d = o.createdAt ? new Date(o.createdAt) : new Date();
  const year = d.getFullYear();
  const pad = String(o.id || 0).padStart(3, "0");
  return `#ORD-${year}-${pad}`;
}

// Hiển thị tên sản phẩm “đẹp”
function buildProductName(it) {
  const ex = it.extraOptions || {};
  // Ưu tiên những gì có sẵn
  if (ex.productName) return ex.productName;
  if (ex.fileName) return ex.fileName;
  if (ex.name) return ex.name;

  const type = String(it.printType || '').toUpperCase();
  if (type === 'DOCUMENT') {
    const size = ex.size || 'A4';
    const side = ex.side || ex.twoSides ? '2 sides' : (ex.side || '1 side');
    const mode = ex.mode || ex.docType || 'Black & White';
    return `Document • ${size} • ${side} • ${mode}`;
  }
  if (type === 'PHOTO') {
    const size = ex.sizeCode || '10x15';
    const paper = ex.paper || 'Glossy';
    const bl = ex.borderless ? ' • Borderless' : '';
    return `Photo • ${size} • ${paper}${bl}`;
  }
  return it.printType || 'Item';
}

function normalizeStatus(s) {
  const val = String(s || "").toLowerCase();
  if (val === 'pending' || val === 'new') return 'pending';       // 👈 giữ riêng
  if (['processing', 'ready'].includes(val)) return 'processing';
  if (val === 'paid') return 'paid';
  if (val === 'completed') return 'completed';
  if (val.startsWith('cancel')) return 'cancelled';
  return 'processing';
}

// Tính tiền đặt cọc: >100.000₫ thì thu 50%, ngược lại thu đủ
function calcDeposit(total) {
  const t = Number(total || 0);
  if (t <= 0) return 0;
  return t > 100000 ? Math.round(t * 0.5) : t;
}

// GET /api/orders/by-code/:orderCode
exports.getMyOrderByCode = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });

    const oc = String(req.params.orderCode || "").toUpperCase();
    const id = resolveOrderIdFromOrderCode(oc);
    if (!id) return res.status(404).json({ success: false, message: "Invalid order code" });

    const order = await db.Order.findOne({
      where: { id, customerId: userId },
      attributes: ["id", "status", "note", "totalAmount", "createdAt", "updatedAt"],
      include: [
        { model: db.User, as: "customer", attributes: ["id", "fullName", "email"] },
        { model: db.OrderItem, as: "items", attributes: ["id", "printType", "quantity", "unitPrice", "lineTotal", "extraOptions"] },
      ],
      order: [[{ model: db.OrderItem, as: "items" }, "id", "ASC"]],
    });
    if (!order) return res.status(404).json({ success: false, message: "Order not found" });

    const raw = order.toJSON();
    const items = (raw.items || []).map((it) => ({
      id: it.id,
      printType: it.printType,
      quantity: Number(it.quantity),
      unitPrice: Number(it.unitPrice),
      lineTotal: Number(it.lineTotal),
      extraOptions: it.extraOptions || {},
      productName: buildProductName(it),
      totalPrice: Number(it.lineTotal),
    }));

    const payload = {
      id: raw.id,
      code: genOrderCode(raw),
      status: normalizeStatus(raw.status),
      note: raw.note || null,
      totalAmount: Number(raw.totalAmount),
      createdAt: raw.createdAt,
      updatedAt: raw.updatedAt,
      user: raw.customer,
      items,
      cancellable: String(raw.status).toLowerCase() === 'pending',
    };
    return res.json({ success: true, data: payload });
  } catch (err) {
    console.error("getMyOrderByCode error:", err);
    return res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

// ======================== SSE (in-memory) =========================
// orderCode -> Set(res)
const sseClientsByOrder = new Map();

function addSseClient(orderCode, res) {
  if (!sseClientsByOrder.has(orderCode)) sseClientsByOrder.set(orderCode, new Set());
  sseClientsByOrder.get(orderCode).add(res);
}
function removeSseClient(orderCode, res) {
  const set = sseClientsByOrder.get(orderCode);
  if (!set) return;
  set.delete(res);
  if (set.size === 0) sseClientsByOrder.delete(orderCode);
}
function broadcastPaid(orderCode, payload) {
  const set = sseClientsByOrder.get(orderCode);
  if (!set || set.size === 0) return;
  const data = JSON.stringify({ type: "paid", ...payload });
  for (const res of set) {
    res.write(`data: ${data}\n\n`);
  }
}

// GET /api/orders/:orderCode/stream
exports.streamOrderPayment = (req, res) => {
  const orderCode = String(req.params.orderCode || "").trim();
  if (!orderCode) return res.status(400).end();
  res.set({
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });
  res.flushHeaders?.();
  // ping mở kết nối
  res.write(`event: ping\ndata: "ok"\n\n`);
  addSseClient(orderCode, res);
  req.on("close", () => removeSseClient(orderCode, res));
};

// POST /api/orders/webhooks/casso
exports.webhookCassoLike = async (req, res) => {
  try {
    // 1) Payload thật từ Casso V2 (qua smee) thường nằm ở body.data
    const data = req.body?.data || req.body || {};
    const desc =
      (data.description || data.content || req.body?.description || "") + " " +
      (data.reference || "");

    // 2) Số tiền
    const amt = Math.round(
      Number(data.amount ?? req.body?.amount ?? req.body?.paidAmount ?? 0)
    );

    // 3) Bóc mã đơn từ mô tả: DOC-000073 | DOC000073 | #ORD-2024-073 ...
    const upper = String(desc).toUpperCase();

    // Ưu tiên DOC/PHOTO trong description hoặc reference
    let oc = "";
    let pool = [
      String(data.description || req.body?.description || ""),
      String(data.reference || req.body?.reference || ""),
      String(desc || "")
    ].map(s => s.toUpperCase()).join(" ");
    // optional: nén khoảng trắng
    pool = pool.replace(/\s+/g, ' ').trim();

    // 1) DOC-000123 | DOC000123 | PHOTO-000123
    let m = pool.match(/(DOC|PHOTO)[-.\s]?(\d{1,10})/);
    if (m && m[2]) {
      const digits = m[2].replace(/\D/g, "");
      oc = `${m[1]}-${digits.padStart(6, "0")}`;
    }
    // 2) ORD có/không có # và/hoặc dấu ngăn cách
    if (!oc) {
      m = pool.match(/#?ORD\D?(\d{4})\D?(\d{1,6})/);
      if (m) {
        const year = m[1];
        const id = m[2].replace(/\D/g, "");
        oc = `#ORD-${year}-${id.padStart(3, "0")}`; // chuẩn hoá lại dạng hiển thị
      }
    }
    // 3) Cho phép test nhanh qua query: ?orderCode=...
    if (!oc && req.query?.orderCode) {
      oc = String(req.query.orderCode).toUpperCase();
    }

    if (!oc || !amt) {
      console.log("Webhook thiếu oc/amt", {
        oc,
        amt,
        content: desc,
        body: req.body,
      });
      // Trả 200 để Casso không retry, nhưng không phát sự kiện
      return res.status(200).json({ ok: true, ignored: true });
    }

    // 4) (Tuỳ chọn) cập nhật DB payment tại đây...
    const orderId = resolveOrderIdFromOrderCode(oc);
    if (!orderId) {
      console.log("Cannot resolve orderId from code:", oc);
      // vẫn trả 200 để provider không retry vô hạn
      return res.status(200).json({ ok: true, ignored: true });
    }

    await sequelize.transaction(async (t) => {
      // Upsert payment VNPAY -> SUCCESS
      await sequelize.query(
        `INSERT INTO ${T('payments')} (order_id, method, status, amount, currency, paid_at, created_at, updated_at)
     VALUES (:orderId, 'VNPAY', 'SUCCESS', :amount, 'VND', NOW(), NOW(), NOW())
     ON DUPLICATE KEY UPDATE
       method     = 'VNPAY',
       status     = 'SUCCESS',
       amount     = VALUES(amount),
       currency   = 'VND',
       paid_at    = NOW(),
       updated_at = NOW()`,
        { type: QueryTypes.INSERT, transaction: t, replacements: { orderId, amount: amt } }
      );

      // Lấy total hiện tại để quyết định tổng sau giảm
      const [rows] = await sequelize.query(
        `SELECT totalAmount FROM ${T('orders')} WHERE id = :orderId FOR UPDATE`,
        { type: QueryTypes.SELECT, transaction: t, replacements: { orderId } }
      );
      const currentTotal = Number(rows?.totalAmount ?? 0);
      const finalTotal = Math.min(currentTotal || amt, amt || currentTotal); // phản ánh giảm giá
      // Hoàn tất đơn ngay khi nhận thanh toán
      await sequelize.query(
        `UPDATE ${T('orders')}
           SET status='completed',
               totalAmount = :finalTotal,
               updatedAt = NOW()
         WHERE id = :orderId`,
        { type: QueryTypes.UPDATE, transaction: t, replacements: { orderId, finalTotal } }
      );
    });

    // Sau khi lưu DB thành công mới phát SSE (để UI sync đúng)
    broadcastPaid(oc, { paidAmount: amt });
    return res.json({ ok: true });

  } catch (e) {
    console.error("webhookCassoLike error", e);
    return res.status(500).json({ ok: false });
  }
};

// POST /api/orders/:orderCode/mark-paid  {paidAmount}
exports.markPaidManual = async (req, res) => {
  const oc = String(req.params.orderCode || "").trim();
  const amt = Math.round(Number(req.body?.paidAmount || 0));
  if (!oc || !amt) return res.status(400).json({ ok: false, error: "invalid_body" });

  const orderId = resolveOrderIdFromOrderCode(oc);
  if (!orderId) return res.status(404).json({ ok: false, error: "invalid_order_code" });

  await sequelize.transaction(async (t) => {
    // Lưu/ghi đè payment (đánh dấu SUCCESS)
    await sequelize.query(
      `INSERT INTO ${T('payments')} (order_id, method, status, amount, currency, paid_at, created_at, updated_at)
       VALUES (:orderId, 'VNPAY', 'SUCCESS', :amount, 'VND', NOW(), NOW(), NOW())
       ON DUPLICATE KEY UPDATE
         method='VNPAY', status='SUCCESS', amount=VALUES(amount), currency='VND', paid_at=NOW(), updated_at=NOW()`,
      { type: QueryTypes.INSERT, transaction: t, replacements: { orderId, amount: amt } }
    );
    // Chốt đơn  cập nhật tổng sau giảm
    const [rows] = await sequelize.query(
      `SELECT totalAmount FROM ${T('orders')} WHERE id = :orderId FOR UPDATE`,
      { type: QueryTypes.SELECT, transaction: t, replacements: { orderId } }
    );
    const currentTotal = Number(rows?.totalAmount ?? 0);
    const finalTotal = Math.min(currentTotal || amt, amt || currentTotal);
    await sequelize.query(
      `UPDATE ${T('orders')}
         SET status='completed',
             totalAmount = :finalTotal,
             updatedAt = NOW()
       WHERE id = :orderId`,
      { type: QueryTypes.UPDATE, transaction: t, replacements: { orderId, finalTotal } }
    );
  });

  // Báo về FE (SSE) để các trang khác đang mở tự cập nhật
  broadcastPaid(oc, { paidAmount: amt });
  res.json({ ok: true });
};

// POST /api/orders/:orderCode/cancel  {reason?}
exports.cancelMyOrder = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });
    const oc = String(req.params.orderCode || '').trim().toUpperCase();
    const id = resolveOrderIdFromOrderCode(oc);
    if (!id) return res.status(404).json({ success: false, message: 'Invalid order code' });

    const order = await db.Order.findOne({
      where: { id, customerId: userId },
      attributes: ['id', 'status', 'note'],
    });
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
    const st = String(order.status).toLowerCase();
    if (!['pending', 'new'].includes(st)) {
      return res.status(409).json({ success: false, message: 'ONLY_PENDING_CAN_BE_CANCELLED' });
    }
    await order.update({
      status: 'cancelled',
      note: req.body?.reason ? `${order.note ? order.note + ' | ' : ''}User cancel: ${req.body.reason}` : order.note,
    });
    return res.json({ success: true, message: 'ORDER_CANCELLED' });
  } catch (e) {
    console.error('cancelMyOrder error:', e);
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};

exports.listMyOrders = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });

    const { status, from, to, page = 1, pageSize = 10, sort } = req.query;

    const where = { customerId: userId };
    // Nếu FE truyền status = processing/completed/cancelled, map về giá trị DB
    if (status) {
      const k = String(status).toLowerCase();
      if (k === "processing") where.status = ["NEW", "processing", "ready", "paid"];
      else if (k === "pending") where.status = ["NEW", "pending"];
      else if (k === "completed") where.status = "completed";
      else if (k === "cancelled") where.status = { [Op.like]: "cancel%" };
    }

    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt[Op.gte] = new Date(from);
      if (to) where.createdAt[Op.lte] = new Date(to);
    }

    const limit = Math.max(1, Math.min(Number(pageSize) || 10, 100));
    const offset = (Math.max(1, Number(page) || 1) - 1) * limit;

    const { rows, count } = await db.Order.findAndCountAll({
      where,
      limit,
      offset,
      order: parseSort(sort),
      attributes: ["id", "status", "totalAmount", "createdAt", "note"],
    });

    const data = rows.map((r) => {
      const o = r.toJSON();
      const raw = String(o.status).toLowerCase();
      return {
        ...o,
        rawStatus: raw,                              // ✅ dùng biến raw đúng
        status: normalizeStatus(o.status),
        code: genOrderCode(o),
        cancellable: ['pending', 'new'].includes(raw) // ✅ cho hủy khi NEW
      };
    });

    return res.json({
      success: true,
      data,
      pagination: {
        page: Number(page) || 1,
        pageSize: limit,
        total: count,
        totalPages: Math.ceil(count / limit),
      },
    });
  } catch (err) {
    console.error("listMyOrders error:", err);
    return res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

exports.getMyOrderById = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });

    const id = req.params.id;

    const order = await db.Order.findOne({
      where: { id, customerId: userId },
      // Trả thêm note (và có thể giữ subtotal nếu muốn hiển thị)
      attributes: ["id", "status", "note", "totalAmount", "createdAt", "updatedAt"],
      include: [
        { model: db.User, as: "customer", attributes: ["id", "fullName", "email"] },
        // Đảm bảo có printType + extraOptions để FE Reorder
        { model: db.OrderItem, as: "items", attributes: ["id", "printType", "quantity", "unitPrice", "lineTotal", "extraOptions"] },
      ],
      order: [[{ model: db.OrderItem, as: "items" }, "id", "ASC"]],
    });

    if (!order) return res.status(404).json({ success: false, message: "Order not found" });

    // 👇 FIX: cần chuyển sang JSON để có biến raw
    const raw = order.toJSON();

    // GIỮ NGUYÊN dữ liệu cần cho Reorder (printType, extraOptions, ...)
    const items = (raw.items || []).map((it) => ({
      id: it.id,
      printType: it.printType,
      quantity: Number(it.quantity),
      unitPrice: Number(it.unitPrice),
      lineTotal: Number(it.lineTotal),
      extraOptions: it.extraOptions || {},
      // Tên hiển thị “đẹp” cho FE
      productName: buildProductName(it),
      totalPrice: Number(it.lineTotal),
    }));

    const payload = {
      id: raw.id,
      code: genOrderCode(raw),
      status: normalizeStatus(raw.status),
      note: raw.note || null,
      totalAmount: Number(raw.totalAmount),
      createdAt: raw.createdAt,
      updatedAt: raw.updatedAt,
      user: raw.customer,
      items,
      cancellable: ['pending', 'new'].includes(String(raw.status).toLowerCase()),
    };
    return res.json({ success: true, data: payload });
  } catch (err) {
    console.error("getMyOrderById error:", err);
    return res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

exports.confirmStorePayment = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });

    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ success: false, message: "Invalid order id" });

    // Chỉ cho chủ đơn
    const order = await db.Order.findOne({ where: { id, customerId: userId } });
    if (!order) return res.status(404).json({ success: false, message: "Order not found" });

    // Tính số tiền phải thanh toán ngay (tiền cọc hoặc đủ)
    const amount = calcDeposit(order.totalAmount);


    await sequelize.transaction(async (t) => {
      // Tạo/đồng bộ bản ghi payments (CASH, PENDING) với amount hợp lệ
      await sequelize.query(
        `INSERT INTO ${T('payments')} (order_id, method, status, amount, currency, paid_at, created_at, updated_at)
         VALUES (:orderId, 'CASH', 'PENDING', :amount, 'VND', NULL, NOW(), NOW())
         ON DUPLICATE KEY UPDATE
           method = 'CASH',
           -- nếu đã SUCCESS thì giữ nguyên amount cũ, không ghi đè
           amount = IF(${T('payments')}.status='SUCCESS', ${T('payments')}.amount, VALUES(amount)),
           currency = 'VND',
           updated_at = NOW()`,
        { type: QueryTypes.INSERT, transaction: t, replacements: { orderId: id, amount } }
      );

      // Cập nhật trạng thái đơn sang processing (đã xác nhận trả tại cửa hàng)
      await sequelize.query(
        `UPDATE ${T('orders')} SET status='processing', updatedAt=NOW() WHERE id=:orderId`,
        { type: QueryTypes.UPDATE, transaction: t, replacements: { orderId: id } }
      );
    });

    // Đọc lại payment để trả về cho FE (cần có id)
    const payment = await sequelize.query(
      `SELECT id, order_id AS orderId, method, status, amount, currency,
            paid_at AS paidAt, created_at AS createdAt, updated_at AS updatedAt
     FROM ${T('payments')}
     WHERE order_id = :orderId
     LIMIT 1`,
      { type: QueryTypes.SELECT, replacements: { orderId: id } }
    );
    // trả về object (không phải mảng) hoặc null
    return res.json({ success: true, payment: payment?.[0] ?? null });
  } catch (e) {
    console.error('confirmStorePayment error:', e);
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};

// ===== Expose a couple helpers internally (FOR PAYMENTS CONTROLLER) =====
// Cho phép module khác phát SSE khi đã lưu DB thành công
exports._broadcastPaid = broadcastPaid;
// Dùng lại genOrderCode nếu cần
exports._genOrderCode = genOrderCode;