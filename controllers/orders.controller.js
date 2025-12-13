// controllers/orders.controller.js
const { Op, fn, col, where: sqlWhere } = require("sequelize");
const db = require("../models");
const Notification = require("../models/Notification");
const { QueryTypes } = require("sequelize");
const { sequelize } = require("../config/database");
const RealtimeHub = require("../services/realtimeHub");

// ----- Helper: Fully-qualified table name theo DB hiện tại -----
const DB = (sequelize.config && sequelize.config.database) || process.env.DB_NAME;
const T = (name) => `\`${DB}\`.\`${name}\``;  // ví dụ: `printnow`.`payments`

// Các bước hiển thị trên UI khách (progress steps)
const ORDER_STAGES = [
  "Order received",
  "Processing",
  "Printing",
  "Quality Control",
  "Ready to ship/receive",
  "Completed",
];

// ===== Quyền truy cập: admin/staff =====
function isPrivileged(user) {
  if (!user) return false;
  const role = String(user.role || "").toLowerCase();
  if (role === "admin" || role === "staff") return true;
  const email = String(user.email || "").toLowerCase();
  const ADMIN_EMAIL = String(process.env.ADMIN_EMAIL || "").toLowerCase();
  const STAFF_EMAIL = String(process.env.STAFF_EMAIL || "").toLowerCase();
  return (!!ADMIN_EMAIL && email === ADMIN_EMAIL) || (!!STAFF_EMAIL && email === STAFF_EMAIL);
}
function assertPrivileged(req) {
  if (!req.user) {
    const err = new Error("Unauthorized");
    err.status = 401;
    throw err;
  }
  if (!isPrivileged(req.user)) {
    const err = new Error("Forbidden");
    err.status = 403;
    throw err;
  }
}

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

// 🔔 Helper: tạo Notification khi nhận thanh toán thành công
async function createPaymentNotification(orderId, amount, method = "VNPAY", orderCode) {
  try {
    const order = await db.Order.findByPk(orderId, {
      attributes: ["id", "customerId", "createdAt"],
    });
    if (!order || !order.customerId) return;

    const code = orderCode || genOrderCode(order);
    const userId = order.customerId;

    const amtNum = Math.round(Number(amount) || 0);
    const formatted = amtNum.toLocaleString("vi-VN") + "₫";

    const title = "Payment successful";
    const message =
      method === "CASH"
        ? `We have received your cash payment of ${formatted} for order ${code}. The order is now being processed.`
        : `Payment of ${formatted} for order ${code} has been received successfully.`;

    const link = `/order/status?orderCode=${encodeURIComponent(code)}`;

    // Tránh tạo trùng nếu webhook bị gọi lại nhiều lần
    const existed = await Notification.findOne({
      where: { userId, link, type: "success", title },
    });
    if (existed) return;

    await Notification.create({
      userId,
      title,
      message,
      type: "success",
      tag: "important",
      link,
      isRead: 0,
    });
  } catch (e) {
    console.error("createPaymentNotification error:", e);
  }
}

// 🔔 Helper: tạo Notification khi khách vừa tạo đơn mới (Document / Photo)
async function createOrderCreatedNotification(orderOrRaw) {
  try {
    const o = orderOrRaw?.toJSON ? orderOrRaw.toJSON() : orderOrRaw;
    if (!o || !o.customerId) return;

    const code = genOrderCode(o);
    const userId = o.customerId;

    const title = `Order ${code} created`;
    const message =
      `Your order ${code} has been placed successfully. ` +
      `We will start processing it soon.`;

    const link = `/order/status?orderCode=${encodeURIComponent(code)}`;

    await Notification.create({
      userId,
      title,
      message,
      type: "info",      // tạo đơn xong -> thông tin
      tag: "none",
      link,
      isRead: 0,
    });
  } catch (e) {
    console.error("createOrderCreatedNotification error:", e);
  }
}

// 🔔 Helper: tạo Notification khi admin/staff đổi trạng thái đơn + broadcast realtime cho bell
async function createOrderStatusNotification(orderOrRaw, frontendStatus, orderCodeFromRoute) {
  try {
    const o = orderOrRaw?.toJSON ? orderOrRaw.toJSON() : orderOrRaw;
    if (!o || !o.customerId) return;

    const userId = o.customerId;
    const code = orderCodeFromRoute || genOrderCode(o);

    const fe = String(frontendStatus || mapDbStatusToFrontend(o.status) || "").toLowerCase();

    let title;
    let message;

    switch (fe) {
      case "pending":
        title = `Order ${code} received`;
        message = `Your order ${code} has been received and is pending processing.`;
        break;
      case "in-progress":
        title = `Order ${code} is being processed`;
        message = `Your order ${code} is currently being processed.`;
        break;
      case "ready":
        title = `Order ${code} is ready`;
        message = `Your order ${code} is ready for pickup or delivery.`;
        break;
      case "completed":
        title = `Order ${code} completed`;
        message = `Your order ${code} has been completed. Thank you for using our service.`;
        break;
      case "cancelled":
        title = `Order ${code} cancelled`;
        message = `Your order ${code} has been cancelled. If you have any questions, please contact our staff.`;
        break;
      default:
        title = `Order ${code} updated`;
        message = `The status of your order ${code} has been updated.`;
        break;
    }

    const link = `/order/status?orderCode=${encodeURIComponent(code)}`;

    const notifType =
      fe === "cancelled" ? "error"
        : fe === "ready" || fe === "completed" ? "success"
          : "info";
    const notifTag =
      fe === "ready" || fe === "completed" || fe === "cancelled"
        ? "important"
        : "none";

    const notif = await Notification.create({
      userId,
      title,
      message,
      type: notifType,
      tag: notifTag,
      link,
      isRead: 0,
    });

    // Đếm lại tổng unread cho user (để FE cập nhật bell)
    const unreadCount = await Notification.count({
      where: { userId, isRead: 0 },
    });

    // parse orderCode từ link (để FE dùng nếu cần)
    const parseOrderCode = (l) => {
      if (!l) return null;
      try {
        const u = new URL(l, "http://localhost");
        return u.searchParams.get("orderCode");
      } catch {
        return null;
      }
    };

    // 📣 Broadcast realtime tới tất cả client đang nghe RealtimeHub
    // FE có thể lọc theo data.userId === currentUser.id
    try {
      RealtimeHub.publish({
        type: "notifications.new",
        ts: Date.now(),
        data: {
          userId,
          unreadCount,
          notification: {
            id: notif.id,
            userId,
            title: notif.title,
            body: notif.message,
            type: notif.type || "info",
            isRead: !!notif.isRead,
            createdAt: notif.created_at || notif.createdAt || new Date(),
            data: {
              link: notif.link || null,
              linkText: null,
              tag: notif.tag,
              important: notif.tag === "important",
              orderCode: parseOrderCode(notif.link),
            },
          },
        },
      });
    } catch (e) {
      console.error("createOrderStatusNotification broadcast error:", e);
    }
  } catch (e) {
    console.error("createOrderStatusNotification error:", e);
  }
}

// Chuẩn hoá 1 dòng cho bảng dashboard
function toDashboardRow(orderOrRaw) {
  const o = orderOrRaw.toJSON ? orderOrRaw.toJSON() : orderOrRaw;
  const rawStatus = String(o.status).toLowerCase();
  const feStatus = mapDbStatusToFrontend(o.status);
  const firstItem = (o.items || [])[0];
  return {
    id: o.id,
    code: genOrderCode(o),
    status: feStatus,
    rawStatus,
    totalAmount: Number(o.totalAmount || 0),
    createdAt: o.createdAt,
    note: o.note || null,
    customerName: o.customer?.fullName || o.customer?.email || undefined,
    orderType: firstItem?.printType || null,
  };
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
  if (val === "pending" || val === "new") return "pending"; // 👈 giữ riêng
  // 👇 Không gộp ready vào processing nữa
  if (val === "processing" || val === "paid") return "processing";
  if (val === "ready") return "ready";
  if (val === "completed") return "completed";
  if (val.startsWith("cancel")) return "cancelled";
  return "pending";
}

// Map trạng thái trong DB -> trạng thái FE (Pending / Received / In-Progress / Completed / Successful)
function mapDbStatusToFrontend(dbStatus) {
  const s = String(dbStatus || "").toLowerCase();
  if (s === "pending" || s === "new") return "Pending";
  if (s === "processing" || s === "paid") return "In-Progress";
  if (s === "ready") return "Ready";
  if (s === "completed") return "Completed";
  // ✅ Hiển thị rõ đơn đã hủy
  if (s.startsWith("cancel")) return "Cancelled";
  return "Pending";
}

// Map trạng thái FE (Pending / Received / In-Progress / Completed / Successful)
// sang enum status trong DB (NEW/pending/processing/ready/completed/cancelled)
function mapFrontendStatusToDbStatus(feStatus) {
  const s = String(feStatus || "").toLowerCase();
  if (s === "pending") return "pending";
  if (s === "in-progress") return "processing";
  if (s === "ready") return "ready";
  if (s === "completed") return "completed";
  if (s === "cancelled") return "cancelled";
  return "processing";
}

// Map FE status sang progress + currentStage cho UI khách hàng
function mapFrontendStatusToProgress(feStatus) {
  const s = String(feStatus || "").toLowerCase();
  switch (s) {
    case "pending":
      return { progress: 10, currentStage: "Order received" };
    case "in-progress":
      return { progress: 60, currentStage: "Printing" };
    case "ready":
      return { progress: 85, currentStage: "Ready to ship/receive" };
    case "completed":
      return { progress: 100, currentStage: "Completed" };
    case "cancelled":
      // Hiển thị rõ ràng khi đơn đã bị hủy (khi SSE replay lại trạng thái)
      return { progress: 0, currentStage: "Order cancelled" };
    default:
      return { progress: 40, currentStage: "Processing" };
  }
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
      // Cho phép khách hủy khi đơn còn ở trạng thái NEW/PENDING (đồng bộ với listMyOrders & getMyOrderById)
      cancellable: ['pending', 'new'].includes(String(raw.status).toLowerCase()),
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
  for (const res of [...set]) {
    try {
      res.write(`data: ${data}\n\n`);
    } catch (e) {
      // kết nối SSE đã lỗi / bị đóng -> loại khỏi pool để tránh memory leak
      set.delete(res);
    }
  }
  if (set.size === 0) {
    sseClientsByOrder.delete(orderCode);
  }
}

// Broadcast trạng thái đơn hàng (nhân viên cập nhật thủ công)
function broadcastOrderStatus(orderCode, payload) {
  const set = sseClientsByOrder.get(orderCode);
  if (!set || set.size === 0) return;
  const data = JSON.stringify({ type: "status", ...payload });
  for (const res of [...set]) {
    try {
      res.write(`data: ${data}\n\n`);
    } catch (e) {
      set.delete(res);
    }
  }
  if (set.size === 0) {
    sseClientsByOrder.delete(orderCode);
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

  // 🔁 Heartbeat mỗi 25s để giữ kết nối qua proxy
  const iv = setInterval(() => {
    try { res.write(`event: ping\ndata: "ok"\n\n`); } catch { }
  }, 25000);

  // 🔁 Replay trạng thái gần nhất (nếu có thể resolve code -> id)
  (async () => {
    try {
      const id = resolveOrderIdFromOrderCode(orderCode);
      if (!id) return;
      // Lấy order + payment tối thiểu để suy ra FE status
      const [ord] = await sequelize.query(
        `SELECT status, createdAt FROM ${T('orders')} WHERE id = :id LIMIT 1`,
        { type: QueryTypes.SELECT, replacements: { id } }
      );
      if (!ord) return;
      const feStatus = mapDbStatusToFrontend(ord.status);
      const prog = mapFrontendStatusToProgress(feStatus);
      const payload = {
        status: feStatus,
        dbStatus: String(ord.status || '').toLowerCase(),
        progress: prog.progress,
        currentStage: prog.currentStage,
        stages: ORDER_STAGES,
        updatedAt: new Date().toISOString(),
        replay: true
      };
      const data = JSON.stringify({ type: "status", ...payload });
      try { res.write(`data: ${data}\n\n`); } catch { }
    } catch { }
  })();

  req.on("close", () => {
    clearInterval(iv);
    removeSseClient(orderCode, res);
  });
};

// POST /api/orders/webhooks/casso
exports.webhookCassoLike = async (req, res) => {
  try {
    // ===== P0: Bảo vệ webhook bằng shared secret =====
    const expected = String(process.env.WEBHOOK_CASSO_TOKEN || "");
    const got = String(req.get("X-Webhook-Token") || req.query?.token || "");
    if (!expected || got !== expected) {
      // Không tiết lộ chi tiết — trả 401 để chặn giả mạo
      return res.status(401).json({ ok: false, error: "UNAUTHORIZED_WEBHOOK" });
    }

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
    // 1) Báo realtime tiền đã vào (type: "paid")
    broadcastPaid(oc, { paidAmount: amt });

    // 2) Đồng thời broadcast trạng thái đơn đã hoàn tất (type: "status")
    const prog = mapFrontendStatusToProgress("completed");
    broadcastOrderStatus(oc, {
      status: "Completed",
      dbStatus: "completed",         // trạng thái thực trong DB
      progress: prog.progress,       // ~100%
      currentStage: prog.currentStage, // "Completed"
      stages: ORDER_STAGES,
      updatedAt: new Date().toISOString(),
    });
    // 📣 Dashboard: phát sự kiện cập nhật 1 đơn
    try {
      const [row] = await sequelize.query(
        `SELECT id, status, totalAmount, createdAt, note FROM ${T('orders')} WHERE id = :id LIMIT 1`,
        { type: QueryTypes.SELECT, replacements: { id: resolveOrderIdFromOrderCode(oc) } }
      );
      if (row) RealtimeHub.publish({ type: 'orders.updated', ts: Date.now(), data: toDashboardRow(row) });
    } catch { }

    // 📊 Đồng bộ lại 3 card summary (this_week / this_month / this_year)
    try {
      await broadcastDashboardSummariesDefaultRanges();
    } catch (e) {
      console.error("broadcastDashboardSummaries error (webhookCassoLike):", e);
    }
    // 🔔 Tạo notification "Payment successful" cho chủ đơn
    try {
      await createPaymentNotification(orderId, amt, "VNPAY", oc);
    } catch (e) {
      console.error("createPaymentNotification error (webhookCassoLike):", e);
    }
    return res.json({ ok: true });

  } catch (e) {
    console.error("webhookCassoLike error", e);
    return res.status(500).json({ ok: false });
  }
};

// POST /api/orders/:orderCode/mark-paid  {paidAmount}
exports.markPaidManual = async (req, res) => {
  // ===== P0: chỉ staff/admin mới được đánh dấu paid thủ công
  try { assertPrivileged(req); } catch (e) { return res.status(e.status || 403).json({ ok: false, error: e.message }); }
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

  // 🔔 Notification cho khách: đã ghi nhận thanh toán (staff đánh dấu)
  try {
    await createPaymentNotification(orderId, amt, "VNPAY", oc);
  } catch (e) {
    console.error("createPaymentNotification error (markPaidManual):", e);
  }

  // Báo về FE (SSE) để các trang khác đang mở tự cập nhật
  // 1) Thanh toán thành công
  broadcastPaid(oc, { paidAmount: amt });
  // 2) Trạng thái đơn đã hoàn tất
  const prog = mapFrontendStatusToProgress("completed");
  broadcastOrderStatus(oc, {
    status: "Completed",
    dbStatus: "completed",
    progress: prog.progress,
    currentStage: prog.currentStage,
    stages: ORDER_STAGES,
    updatedAt: new Date().toISOString(),
  });
  res.json({ ok: true });
  // Dashboard update
  try {
    const [row] = await sequelize.query(
      `SELECT id, status, totalAmount, createdAt, note FROM ${T('orders')} WHERE id = :id LIMIT 1`,
      { type: QueryTypes.SELECT, replacements: { id: resolveOrderIdFromOrderCode(oc) } }
    );
    if (row) RealtimeHub.publish({ type: 'orders.updated', ts: Date.now(), data: toDashboardRow(row) });
  } catch { }
  // 3 card summary realtime
  try {
    await broadcastDashboardSummariesDefaultRanges();
  } catch (e) {
    console.error("broadcastDashboardSummaries error (markPaidManual):", e);
  }
};

// PATCH /api/orders/:orderCode/status  {status}
// Nhân viên cập nhật trạng thái -> lưu DB + broadcast SSE cho khách hàng
exports.updateStatusByCode = async (req, res) => {
  try {
    // ===== P0: bắt buộc quyền staff/admin
    try { assertPrivileged(req); } catch (e) { return res.status(e.status || 403).json({ success: false, message: e.message }); }

    const orderCode = String(req.params.orderCode || "").trim();
    const frontendStatus = req.body?.status;

    if (!orderCode || !frontendStatus) {
      return res
        .status(400)
        .json({ success: false, message: "Missing orderCode or status" });
    }

    const orderId = resolveOrderIdFromOrderCode(orderCode);
    if (!orderId) {
      return res
        .status(404)
        .json({ success: false, message: "Invalid order code" });
    }

    const order = await db.Order.findByPk(orderId);
    if (!order) {
      return res
        .status(404)
        .json({ success: false, message: "Order not found" });
    }

    // Map FE status -> enum status DB
    const dbStatus = mapFrontendStatusToDbStatus(frontendStatus);
    order.status = dbStatus;
    await order.save();

    // 🔔 Tạo notification cho chủ đơn khi trạng thái thay đổi
    // (dùng frontendStatus để text thân thiện, orderCode từ URL)
    try {
      await createOrderStatusNotification(order, frontendStatus, orderCode);
    } catch (e) {
      console.error("createOrderStatusNotification error (updateStatusByCode):", e);
    }

    // Chuẩn bị dữ liệu tiến độ cho UI khách hàng
    const prog = mapFrontendStatusToProgress(frontendStatus);
    const stages = ORDER_STAGES;

    // Broadcast qua SSE cho tất cả client đang nghe /:orderCode/stream
    broadcastOrderStatus(orderCode, {
      status: frontendStatus,
      dbStatus,
      progress: prog.progress,
      currentStage: prog.currentStage,
      stages,
      updatedAt: new Date().toISOString(),
    });

    return res.json({
      success: true,
      data: {
        status: frontendStatus,
        dbStatus,
      },
    });
    // (không chạy tới đây)
  } catch (err) {
    console.error("updateStatusByCode error", err);
    return res
      .status(500)
      .json({ success: false, message: "Internal Server Error" });
  }
};

// Sau khi response đã gửi, phát realtime cho dashboard (dựa vào orderId)
// Monkey-patch nhẹ bằng cách bọc hàm gốc: (giữ nguyên xử lý trên)
const _origUpdate = exports.updateStatusByCode;
exports.updateStatusByCode = async function (req, res) {
  const orderCode = String(req.params.orderCode || '').trim();
  const r = await _origUpdate.call(this, req, res);
  try {
    const id = resolveOrderIdFromOrderCode(orderCode);
    if (id) {
      const order = await db.Order.findByPk(id, {
        include: [{ model: db.User, as: "customer", attributes: ["fullName", "email"] },
        { model: db.OrderItem, as: "items", attributes: ["printType"] }]
      });
      if (order) {
        RealtimeHub.publish({ type: 'orders.updated', ts: Date.now(), data: toDashboardRow(order) });
      }
    }
  } catch { }
  // Đồng bộ 3 card summary
  try {
    await broadcastDashboardSummariesDefaultRanges();
  } catch (e) {
    console.error("broadcastDashboardSummaries error (updateStatusByCode):", e);
  }
  return r;
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
      // cần customerId để gửi notification cho đúng user
      attributes: ['id', 'status', 'note', 'customerId'],
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

    // 🔔 Gửi notification cho chủ đơn: "Order ... cancelled"
    try {
      await createOrderStatusNotification(order, "cancelled", oc);
    } catch (e) {
      console.error("createOrderStatusNotification error (cancelMyOrder):", e);
    }
    // 📣 Broadcast ngay để các tab/trang khách hàng đang nghe SSE cập nhật
    const prog = { progress: 0, currentStage: "Order cancelled" };
    broadcastOrderStatus(oc, {
      status: "Cancelled",
      dbStatus: "cancelled",
      progress: prog.progress,
      currentStage: prog.currentStage,
      stages: ORDER_STAGES,
      updatedAt: new Date().toISOString(),
    });
    res.json({ success: true, message: 'ORDER_CANCELLED' });

    // 📣 Dashboard: phát sự kiện cập nhật 1 đơn (đã bị hủy)
    try {
      const [row] = await sequelize.query(
        `SELECT id, status, totalAmount, createdAt, note FROM ${T('orders')} WHERE id = :id LIMIT 1`,
        { type: QueryTypes.SELECT, replacements: { id } }
      );
      if (row) {
        RealtimeHub.publish({
          type: 'orders.updated',
          ts: Date.now(),
          data: toDashboardRow(row),
        });
      }
    } catch (e) {
      console.error("Realtime orders.updated error (cancelMyOrder):", e);
    }

    // 📊 Đồng bộ lại 3 card summary (this_week / this_month / this_year)
    broadcastDashboardSummariesDefaultRanges().catch((e) => {
      console.error("broadcastDashboardSummaries error (cancelMyOrder):", e);
    });
    return;
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
      // 🚫 Không include NEW trong "processing"
      if (k === "processing") where.status = ["processing", "ready"];
      else if (k === "pending") where.status = ["new", "NEW", "pending"];
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

// ====== LIST ALL ORDERS FOR EMPLOYEE / ADMIN ======
// GET /api/orders/all
exports.listAllOrders = async (req, res) => {
  try {
    if (!isPrivileged(req.user)) {
      return res
        .status(403)
        .json({ success: false, message: "Forbidden" });
    }

    const {
      status,
      from,
      to,
      page = 1,
      pageSize = 10,
      sort,
      search,
      orderType,
    } = req.query;

    const whereClause = {};

    // Filter theo trạng thái FE (Pending / In-Progress / Ready / Completed / Cancelled / All)
    if (status && status !== "All") {
      const s = String(status).toLowerCase();
      if (s === "pending") {
        whereClause.status = { [Op.in]: ["pending", "new", "NEW"] };
      } else if (s === "in-progress") {
        whereClause.status = { [Op.in]: ["processing", "paid"] };
      } else if (s === "ready") {
        whereClause.status = "ready";
      } else if (s === "completed") {
        whereClause.status = "completed";
      } else if (s === "cancelled") {
        whereClause.status = { [Op.like]: "cancel%" };
      }
    }

    // Filter theo ngày tạo
    if (from || to) {
      whereClause.createdAt = {};
      if (from) whereClause.createdAt[Op.gte] = new Date(from);
      if (to) {
        const d = new Date(to);
        d.setHours(23, 59, 59, 999);
        whereClause.createdAt[Op.lte] = d;
      }
    }

    // Search theo mã đơn, note, tên/email khách (case-insensitive bằng LOWER())
    if (search && String(search).trim()) {
      const q = String(search).trim();
      const qLower = q.toLowerCase();
      const kw = `%${qLower}%`;

      const orConds = [
        sqlWhere(fn("LOWER", col("Order.note")), { [Op.like]: kw }),
        sqlWhere(fn("LOWER", col("customer.full_name")), { [Op.like]: kw }),
        sqlWhere(fn("LOWER", col("customer.email")), { [Op.like]: kw }),
      ];

      // Nếu user gõ toàn số -> search trực tiếp theo id
      if (/^\d+$/.test(q)) {
        orConds.push({ id: Number(q) });
      } else {
        // Thử resolve theo mã đơn: #ORD-YYYY-XXX, DOC-000123, PHOTO-000123...
        const resolvedId = resolveOrderIdFromOrderCode(q);
        if (resolvedId) {
          orConds.push({ id: resolvedId });
        }
      }

      whereClause[Op.or] = orConds;
    }

    // Include khách hàng + items (để lấy printType)
    const include = [
      {
        model: db.User,
        as: "customer",
        attributes: ["id", "fullName", "email"],
      },
      {
        model: db.OrderItem,
        as: "items",
        attributes: ["id", "printType"],
        // Filter theo loại đơn (DOCUMENT / PHOTO / BANNER ...)
        ...(orderType && orderType !== "All"
          ? { where: { printType: orderType }, required: true }   // inner join khi có filter
          : { required: false }),
      },
    ];

    const limit = Math.max(1, Math.min(Number(pageSize) || 10, 100));
    const offset = (Math.max(1, Number(page) || 1) - 1) * limit;

    const { rows, count } = await db.Order.findAndCountAll({
      where: whereClause,
      include,
      limit,
      offset,
      order: parseSort(sort),
      attributes: ["id", "status", "totalAmount", "createdAt", "note"],
      distinct: true,   // cần để count đúng khi có include
      subQuery: false,  // tránh đẩy điều kiện include vào subquery
    });

    const data = rows.map((r) => {
      const o = r.toJSON();
      const rawStatus = String(o.status).toLowerCase();
      const feStatus = mapDbStatusToFrontend(o.status);
      const firstItem = (o.items || [])[0];

      return {
        id: o.id,
        code: genOrderCode(o),
        status: feStatus,        // FE dùng để hiển thị  dropdown
        rawStatus,               // nếu cần debug
        totalAmount: Number(o.totalAmount || 0),
        createdAt: o.createdAt,
        note: o.note || null,
        customerName:
          o.customer?.fullName || o.customer?.email || "N/A",
        customer: o.customer || null,
        orderType: firstItem?.printType || null,
        items: (o.items || []).map((it) => ({
          id: it.id,
          printType: it.printType,
        })),
      };
    });

    // Summary theo tập kết quả hiện tại (sau khi filter)
    const summary = {
      all: count,
      pending: 0,
      completed: 0,
      canceled: 0,
      returned: 0,
      damaged: 0,
    };
    data.forEach((o) => {
      const st = String(o.rawStatus || "").toLowerCase();
      if (["pending", "new"].includes(st)) summary.pending += 1;
      else if (st === "completed") summary.completed += 1;
      else if (st.startsWith("cancel")) summary.canceled += 1;
    });

    return res.json({
      success: true,
      data,
      summary,
      pagination: {
        page: Number(page) || 1,
        pageSize: limit,
        total: count,
        totalPages: Math.ceil(count / limit),
      },
    });
  } catch (err) {
    console.error("listAllOrders error:", err);
    return res
      .status(500)
      .json({ success: false, message: "Internal Server Error" });
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

    // Sau khi transaction xong: broadcast trạng thái mới cho UI khách
    // "Pay at store" -> đơn đã được xác nhận và đang trong trạng thái "Processing"
    const orderCode = genOrderCode(order); // cùng format với getMyOrderByCode
    const prog = mapFrontendStatusToProgress("in-progress");
    broadcastOrderStatus(orderCode, {
      status: "In-Progress",
      dbStatus: "processing",      // trạng thái trong DB
      progress: prog.progress,
      currentStage: prog.currentStage,
      stages: ORDER_STAGES,
      updatedAt: new Date().toISOString(),
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
    res.json({ success: true, payment: payment?.[0] ?? null });

    // 📣 Dashboard: phát sự kiện cập nhật 1 đơn (đã chuyển sang processing)
    try {
      const [row] = await sequelize.query(
        `SELECT id, status, totalAmount, createdAt, note FROM ${T('orders')} WHERE id = :id LIMIT 1`,
        { type: QueryTypes.SELECT, replacements: { id } }
      );
      if (row) {
        RealtimeHub.publish({
          type: 'orders.updated',
          ts: Date.now(),
          data: toDashboardRow(row),
        });
      }
    } catch (e) {
      console.error("Realtime orders.updated error (confirmStorePayment):", e);
    }

    // 📊 Cập nhật 3 card summary cho dashboard
    try {
      await broadcastDashboardSummariesDefaultRanges();
    } catch (e) {
      console.error("broadcastDashboardSummaries error (confirmStorePayment):", e);
    }
    return;
  } catch (e) {
    console.error('confirmStorePayment error:', e);
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};

// ===== Expose helpers internally (FOR OTHER MODULES) =====
// Cho phép module khác phát SSE khi đã lưu DB thành công
exports._broadcastPaid = broadcastPaid;
exports._broadcastStatus = broadcastOrderStatus;
// Dùng lại genOrderCode & mapping nếu cần
exports._genOrderCode = genOrderCode;
exports._mapFrontendStatusToProgress = mapFrontendStatusToProgress;
exports._mapFrontendStatusToDbStatus = mapFrontendStatusToDbStatus;
exports._ORDER_STAGES = ORDER_STAGES;
exports._toDashboardRow = toDashboardRow;
exports._broadcastDashboardSummaries = broadcastDashboardSummariesDefaultRanges;
exports._createPaymentNotification = createPaymentNotification;
exports._createOrderCreatedNotification = createOrderCreatedNotification;
exports._createOrderStatusNotification = createOrderStatusNotification;

// =================== SUMMARY (This week/month/year  % so sánh) ===================
function startOfWeek(d) {
  const dt = new Date(d);
  const day = dt.getDay() || 7; // Mon=1..Sun=7
  dt.setHours(0, 0, 0, 0);
  dt.setDate(dt.getDate() - day + 1);
  return dt;
}
function endOfWeek(d) {
  const s = startOfWeek(d);
  const e = new Date(s);
  e.setDate(s.getDate() + 6);
  e.setHours(23, 59, 59, 999);
  return e;
}
function startOfMonth(d) {
  const dt = new Date(d.getFullYear(), d.getMonth(), 1);
  dt.setHours(0, 0, 0, 0);
  return dt;
}
function endOfMonth(d) {
  const dt = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  dt.setHours(23, 59, 59, 999);
  return dt;
}
function startOfYear(d) {
  const dt = new Date(d.getFullYear(), 0, 1);
  dt.setHours(0, 0, 0, 0);
  return dt;
}
function endOfYear(d) {
  const dt = new Date(d.getFullYear(), 11, 31);
  dt.setHours(23, 59, 59, 999);
  return dt;
}
function getRange(key, now = new Date()) {
  const n = new Date(now);
  if (key === "this_week") return { from: startOfWeek(n), to: endOfWeek(n), prevKey: "last_week" };
  if (key === "last_week") { const d = new Date(n); d.setDate(d.getDate() - 7); return { from: startOfWeek(d), to: endOfWeek(d), prevKey: "prev_week" }; }
  if (key === "this_month") return { from: startOfMonth(n), to: endOfMonth(n), prevKey: "last_month" };
  if (key === "last_month") { const d = new Date(n.getFullYear(), n.getMonth() - 1, 1); return { from: startOfMonth(d), to: endOfMonth(d), prevKey: "prev_month" }; }
  if (key === "this_year") return { from: startOfYear(n), to: endOfYear(n), prevKey: "last_year" };
  if (key === "last_year") { const d = new Date(n.getFullYear() - 1, 0, 1); return { from: startOfYear(d), to: endOfYear(d), prevKey: "prev_year" }; }
  // fallback: this_week
  return getRange("this_week", n);
}
function getPrevOf(key, now = new Date()) {
  // Map “kỳ liền trước” dùng cho % so sánh
  if (key === "this_week") return "last_week";
  if (key === "this_month") return "last_month";
  if (key === "this_year") return "last_year";
  // nếu FE yêu cầu last_* thì so với kỳ ngay trước đó của last_*
  if (key === "last_week") return "prev_week";
  if (key === "last_month") return "prev_month";
  if (key === "last_year") return "prev_year";
  return "last_week";
}
function getRangeLoose(key, now = new Date()) {
  // mở rộng cho prev_week/prev_month/prev_year
  if (key === "prev_week") {
    const d = new Date(now); d.setDate(d.getDate() - 14);
    return { from: startOfWeek(d), to: endOfWeek(d) };
  }
  if (key === "prev_month") {
    const d = new Date(now.getFullYear(), now.getMonth() - 2, 1);
    return { from: startOfMonth(d), to: endOfMonth(d) };
  }
  if (key === "prev_year") {
    const d = new Date(now.getFullYear() - 2, 0, 1);
    return { from: startOfYear(d), to: endOfYear(d) };
  }
  return getRange(key, now); // cho this_*, last_* bình thường
}
function pctChange(curr, prev) {
  const c = Number(curr || 0), p = Number(prev || 0);
  if (p === 0) return c === 0 ? 0 : 100; // quy ước
  return Math.round(((c - p) / p) * 100);
}

async function countSummaryBetween(from, to) {
  const whereDate = `createdAt BETWEEN :from AND :to`;
  // Tổng đơn, pending/new, completed, cancelled…, distinct customers
  const [rows] = await sequelize.query(
    `
      SELECT
        COUNT(*)                                               AS allCount,
        SUM(CASE WHEN LOWER(status) IN ('pending','new') THEN 1 ELSE 0 END) AS pendingCount,
        SUM(CASE WHEN LOWER(status) = 'completed' THEN 1 ELSE 0 END)             AS completedCount,
        SUM(CASE WHEN LOWER(status) LIKE 'cancel%' THEN 1 ELSE 0 END)            AS canceledCount
      FROM ${T('orders')}
      WHERE ${whereDate}
    `,
    { type: QueryTypes.SELECT, replacements: { from, to } }
  );
  const [cust] = await sequelize.query(
    `
      SELECT COUNT(DISTINCT customerId) AS customers
      FROM ${T('orders')}
      WHERE ${whereDate}
    `,
    { type: QueryTypes.SELECT, replacements: { from, to } }
  );
  return {
    all: Number(rows?.allCount || 0),
    pending: Number(rows?.pendingCount || 0),
    completed: Number(rows?.completedCount || 0),
    canceled: Number(rows?.canceledCount || 0),
    returned: 0,
    damaged: 0,
    customers: Number(cust?.customers || 0),
    // “abandonedCartRate” tạm tính = canceled / all (%)
    abandonedRate: (Number(rows?.allCount || 0) === 0) ? 0 :
      Math.round(100 * Number(rows?.canceledCount || 0) / Number(rows?.allCount || 0))
  };
}

async function buildSummaryPayload(rangeKey, now = new Date()) {
  const { from, to } = getRangeLoose(rangeKey, now);
  const prevKey = getPrevOf(rangeKey, now);
  const prevRange = getRangeLoose(prevKey, now);
  const curr = await countSummaryBetween(from, to);
  const prev = await countSummaryBetween(prevRange.from, prevRange.to);
  return {
    range: rangeKey,
    from, to,
    counts: curr,
    prevCounts: prev,
    deltas: {
      all: pctChange(curr.all, prev.all),
      pending: pctChange(curr.pending, prev.pending),
      completed: pctChange(curr.completed, prev.completed),
      canceled: pctChange(curr.canceled, prev.canceled),
      returned: pctChange(curr.returned, prev.returned),
      damaged: pctChange(curr.damaged, prev.damaged),
      customers: pctChange(curr.customers, prev.customers),
      abandonedRate: pctChange(curr.abandonedRate, prev.abandonedRate),
    },
    ts: new Date().toISOString(),
  };
}

// Phát realtime summary cho dashboard (3 card chính) qua SSE
async function broadcastDashboardSummariesDefaultRanges() {
  try {
    const ranges = ["this_week", "this_month", "this_year"];
    const summaries = {};
    await Promise.all(
      ranges.map(async (key) => {
        summaries[key] = await buildSummaryPayload(key);
      })
    );
    RealtimeHub.publish({
      type: "summary.updated",
      ts: Date.now(),
      data: { ranges, summaries },
    });
  } catch (e) {
    console.error("broadcastDashboardSummaries error:", e);
  }
}

// GET /api/orders/summary?range=this_week|this_month|this_year|last_week|...
exports.getOrdersSummary = async (req, res) => {
  try {
    if (!isPrivileged(req.user)) return res.status(403).json({ success: false, message: "Forbidden" });
    const range = String(req.query.range || "this_week");
    const payload = await buildSummaryPayload(range);
    return res.json({ success: true, summary: payload });
  } catch (e) {
    console.error("getOrdersSummary error:", e);
    return res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

// GET /api/orders/summary-multi?ranges=this_week,this_month,this_year
exports.getOrdersSummaryMulti = async (req, res) => {
  try {
    if (!isPrivileged(req.user)) return res.status(403).json({ success: false, message: "Forbidden" });
    const raw = String(req.query.ranges || "").trim();
    const keys = Array.from(new Set((raw ? raw.split(",") : ["this_week"]).map(s => s.trim()).filter(Boolean)));
    const out = {};
    await Promise.all(keys.map(async k => { out[k] = await buildSummaryPayload(k); }));
    return res.json({ success: true, summaries: out });
  } catch (e) {
    console.error("getOrdersSummaryMulti error:", e);
    return res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};