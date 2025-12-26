// controllers/orders.controller.js
const { Op, fn, col, where: sqlWhere } = require("sequelize");
const db = require("../models");
const Notification = require("../models/Notification");
const { QueryTypes } = require("sequelize");
const { sequelize } = require("../config/database");
const RealtimeHub = require("../services/realtimeHub");

// ----- Helper: Fully-qualified table name theo DB hiện tại -----
const DB =
  (sequelize.config && sequelize.config.database) || process.env.DB_NAME;
const T = (name) => `\`${DB}\`.\`${name}\``; // ví dụ: `printnow`.`payments`

// ===== cache helpers (avoid heavy INFORMATION_SCHEMA queries repeatedly) =====
let __hasOrderStatusHistoryTable = null; // true/false after first check
let __lastOverdueRunAt = 0;

async function hasOrderStatusHistoryTable() {
  if (typeof __hasOrderStatusHistoryTable === "boolean") return __hasOrderStatusHistoryTable;
  try {
    const [row] = await sequelize.query(
      `
        SELECT 1 AS ok
        FROM INFORMATION_SCHEMA.TABLES
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'order_status_history'
        LIMIT 1
      `,
      { type: QueryTypes.SELECT }
    );
    __hasOrderStatusHistoryTable = !!row?.ok;
  } catch {
    __hasOrderStatusHistoryTable = false;
  }
  return __hasOrderStatusHistoryTable;
}

function shouldRunOverdueNow() {
  const isDev = String(process.env.NODE_ENV || "development") !== "production";
  // dev: allow frequent; prod: at most every 60s (or tune to 300s)
  const minIntervalMs = isDev ? 2000 : 60 * 1000;
  const now = Date.now();
  if (now - __lastOverdueRunAt < minIntervalMs) return false;
  __lastOverdueRunAt = now;
  return true;
}

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
  if (role === "admin" || role === "staff" || role === "owner") return true;
  const email = String(user.email || "").toLowerCase();
  const ADMIN_EMAIL = String(process.env.ADMIN_EMAIL || "").toLowerCase();
  const STAFF_EMAIL = String(process.env.STAFF_EMAIL || "").toLowerCase();
  const OWNER_EMAIL = String(process.env.OWNER_EMAIL || "").toLowerCase();
  return (
    (!!ADMIN_EMAIL && email === ADMIN_EMAIL) ||
    (!!STAFF_EMAIL && email === STAFF_EMAIL) ||
    (!!OWNER_EMAIL && email === OWNER_EMAIL)
  );
  // OR owner
  // return ((!!ADMIN_EMAIL && email === ADMIN_EMAIL) || (!!STAFF_EMAIL && email === STAFF_EMAIL) || (!!OWNER_EMAIL && email === OWNER_EMAIL));
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
  const s = String(orderCode || "")
    .toUpperCase()
    .trim();
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

// ===================== STAFF/OWNER Notifications =====================
async function getStaffRecipients() {
  // staff/owner/admin đều nhận (role) + fallback theo email env (nếu role DB chưa set)
  const emails = [
    String(process.env.ADMIN_EMAIL || "").toLowerCase(),
    String(process.env.STAFF_EMAIL || "").toLowerCase(),
    String(process.env.OWNER_EMAIL || "").toLowerCase(),
  ].filter(Boolean);

  // Support different schemas: role / roleCode / role_code
  // Your User model has "role" (ENUM customer/staff/admin/owner).
  // Only include columns that exist in User model to avoid SQL errors.
  const roleFields = [];
  try {
    const ra = db?.User?.rawAttributes || {};
    const candidates = ["role", "roleCode", "role_code"];
    for (const k of candidates) {
      if (ra[k]) roleFields.push(ra[k].field || k);
    }
  } catch { }

  const roleConds =
    roleFields.length
      ? roleFields.map((fieldName) =>
        sqlWhere(fn("LOWER", col(fieldName)), {
          [Op.in]: ["staff", "owner", "admin"],
        })
      )
      : [];

  const users = await db.User.findAll({
    where: {
      [Op.or]: [
        ...roleConds,
        ...(emails.length
          ? [sqlWhere(fn("LOWER", col("email")), { [Op.in]: emails })]
          : []),
      ],
    },
    attributes: ["id"],
  });
  return users.map((u) => Number(u.id));
}

// Tạo notification cho tất cả staff/owner
async function createStaffNotification({
  type,
  title,
  message,
  orderCode,
  link,
  tag = "important",
  dedupeMinutes = 0, // nếu >0: tránh spam trong khoảng thời gian này theo (userId,type,title,link)
}) {
  try {
    const recipientIds = await getStaffRecipients();
    if (!recipientIds.length) return;

    // ✅ Prefer providing a safe link so FE can always resolve orderCode/details.
    // Notification_Employee.html already converts /order/status?orderCode=... to Employee_Dashboard search.
    // Keeping link helps E2E tests & avoids relying on parsing title/body.
    const href =
      link ||
      (orderCode ? `/order/status?orderCode=${encodeURIComponent(orderCode)}` : null);

    // Dedupe theo cửa sổ thời gian (tránh tạo trùng khi staff refresh / listAllOrders gọi nhiều lần)
    let filteredRecipients = recipientIds;
    if (dedupeMinutes > 0) {
      const since = new Date(Date.now() - dedupeMinutes * 60 * 1000);
      const existed = await Notification.findAll({
        where: {
          userId: { [Op.in]: recipientIds },
          type,
          title,
          ...(href ? { link: href } : {}),
          created_at: { [Op.gte]: since },
        },
        attributes: ["userId"],
      });
      const existedSet = new Set(existed.map((r) => Number(r.userId)));
      filteredRecipients = recipientIds.filter(
        (uid) => !existedSet.has(Number(uid))
      );
      if (!filteredRecipients.length) return;
    }

    // tạo 1 notif cho mỗi staff/owner
    const rows = filteredRecipients.map((uid) => ({
      userId: uid,
      title,
      message,
      type,
      tag,
      link: href,
      isRead: 0,
    }));

    await Notification.bulkCreate(rows, { validate: true });

    // broadcast realtime theo từng user để FE bell cập nhật
    for (const uid of filteredRecipients) {
      const unreadCount = await Notification.count({
        where: { userId: uid, isRead: 0 },
      });
      RealtimeHub.publish({
        type: "notifications.new",
        ts: Date.now(),
        data: {
          userId: uid,
          unreadCount,
          notification: {
            id: null, // FE không bắt buộc id trong event, nhưng nếu muốn đúng tuyệt đối -> query last row
            userId: uid,
            title,
            body: message,
            type,
            isRead: false,
            createdAt: new Date().toISOString(),
            data: {
              link: href,
              linkText: null,
              tag,
              important: tag === "important",
              orderCode: orderCode || null,
            },
          },
        },
      });
    }
  } catch (e) {
    console.error("createStaffNotification error:", e);
  }
}

// ====== 3 CASES THÔNG BÁO CHO STAFF ======
// Khi có đơn hàng mới tạo
async function notifyStaffNewOrder(orderOrRaw) {
  const o = orderOrRaw?.toJSON ? orderOrRaw.toJSON() : orderOrRaw;
  const code = genOrderCode(o);
  return createStaffNotification({
    type: "new_order",
    title: `New order created: ${code}`,
    message: `A new order ${code} has been created. Please review and process it.`,
    orderCode: code,
    tag: "important",
    dedupeMinutes: 30, // tránh spam trong 30 phút
  });
}

// Khi khách yêu cầu hủy đơn
async function notifyStaffCancelOrder(orderCode, reason) {
  return createStaffNotification({
    type: "cancel_order",
    title: `Cancellation request: ${orderCode}`,
    message: reason
      ? `Customer requested to cancel ${orderCode}. Reason: ${reason}`
      : `Customer requested to cancel ${orderCode}.`,
    orderCode,
    tag: "important",
    dedupeMinutes: 60, // tránh spam trong 60 phút
  });
}

// Khi nhận thanh toán thành công
async function notifyStaffPaymentSuccess(orderCode, amount, method = "VNPAY") {
  const amtNum = Math.round(Number(amount) || 0);
  const formatted = amtNum.toLocaleString("vi-VN") + "₫";
  return createStaffNotification({
    type: "payment_success",
    title: `Payment confirmed: ${orderCode}`,
    message: `Payment (${method}) of ${formatted} has been received for order ${orderCode}.`,
    orderCode,
    tag: "important",
    dedupeMinutes: 60, // tránh spam trong 60 phút
  });
}

// ====== 2 CASES OVERDUE (STAFF) ======
async function notifyStaffOverdueUnassigned(orderCode) {
  const isDev = String(process.env.NODE_ENV || "development") !== "production";
  return createStaffNotification({
    type: "overdue_unassigned",
    title: `URGENT: Unpaid order overdue: ${orderCode}`,
    message: `Order ${orderCode} has been waiting for payment/deposit for too long. Please contact customer or guide payment/checkout.`,
    orderCode,
    tag: "important",
    // tránh spam (mỗi 6h tối đa 1 lần cho cùng (type,title,link,user))
    // ✅ tối ưu: dev ~ 10-30s, prod ~ 6h
    dedupeMinutes: Number(process.env.OVERDUE_UNASSIGNED_DEDUPE_MINUTES || (isDev ? 0.5 : 360)),
  });
}

// Khi đơn in xong nhưng bị kẹt lâu trong processing/ready
async function notifyStaffOverduePrinted(orderCode, phase = "processing") {
  const isDev = String(process.env.NODE_ENV || "development") !== "production";
  const p = String(phase || "processing").toLowerCase();
  const title =
    p === "ready"
      ? `URGENT: Ready order stuck: ${orderCode}`
      : `URGENT: Processing order overdue: ${orderCode}`;
  const message =
    p === "ready"
      ? `Order ${orderCode} has been in READY for too long. Please arrange pickup/delivery or mark completed/cancelled.`
      : `Order ${orderCode} has been in PROCESSING for too long. Please check printing/QC and update status.`;

  return createStaffNotification({
    type: "overdue_printed",
    title,
    message,
    orderCode,
    tag: "important",
    // tránh spam (mỗi 6h tối đa 1 lần cho cùng (type,title,link,user))
    // ✅ tối ưu: dev ~ 2-5 phút, prod ~ 6h
    dedupeMinutes: Number(process.env.OVERDUE_PRINTED_DEDUPE_MINUTES || (isDev ? 3 : 360)),
  });
}

// Heuristic check (không có deadline field trong DB => dùng “tuổi đơn” + status)
async function checkAndNotifyOverdueOrders() {
  try {
    // ✅ kill-switch: tắt toàn bộ overdue scan nếu cần
    const enabled = String(process.env.ENABLE_OVERDUE_CHECK || "1");
    if (enabled !== "1" && enabled.toLowerCase() !== "true") return;

    // throttle to avoid being executed too frequently (e.g., dashboard spam refresh)
    if (!shouldRunOverdueNow()) return;

    // // NEW/pending quá X phút => overdue_unassigned
    // const minutesUnassigned = Math.max(
    //   0.01,
    //   Number(process.env.OVERDUE_UNASSIGNED_MINUTES || 120)
    // );
    // // processing quá X giờ => overdue_printed
    // const hoursProcessing = Math.max(
    //   0.01,
    //   Number(process.env.OVERDUE_PROCESSING_HOURS || 24)
    // );
    // // ready quá X giờ => overdue_printed (nhưng message khác)
    // const hoursReady = Math.max(
    //   0.01,
    //   Number(process.env.OVERDUE_READY_HOURS || 48)
    // );
    const isDev = String(process.env.NODE_ENV || "development") !== "production";
    const MIN_UNASSIGNED = isDev ? 0.01 : 10; // prod tối thiểu 10 phút
    const MIN_HOURS = isDev ? 0.001 : 1;      // prod tối thiểu 1 giờ

    const defUnassigned = isDev ? 0.01 : 120;
    const defProcHours = isDev ? 0.001 : 24;
    const defReadyHours = isDev ? 0.001 : 48;

    const envUnassigned = Number(process.env.OVERDUE_UNASSIGNED_MINUTES);
    const envProcHours = Number(process.env.OVERDUE_PROCESSING_HOURS);
    const envReadyHours = Number(process.env.OVERDUE_READY_HOURS);

    const minutesUnassigned = Math.max(
      MIN_UNASSIGNED,
      Number.isFinite(envUnassigned) && envUnassigned > 0 ? envUnassigned : defUnassigned
    );
    const hoursProcessing = Math.max(
      MIN_HOURS,
      Number.isFinite(envProcHours) && envProcHours > 0 ? envProcHours : defProcHours
    );
    const hoursReady = Math.max(
      MIN_HOURS,
      Number.isFinite(envReadyHours) && envReadyHours > 0 ? envReadyHours : defReadyHours
    );

    const cutoffUnassigned = new Date(
      Date.now() - minutesUnassigned * 60 * 1000
    );
    const cutoffProcessing = new Date(
      Date.now() - hoursProcessing * 60 * 60 * 1000
    );
    const cutoffReady = new Date(Date.now() - hoursReady * 60 * 60 * 1000);

    // 1) NEW/pending quá lâu + CHƯA có payment SUCCESS => overdue_unassigned
    //    (coi là chưa thanh toán/đặt cọc)
    const unassigned = await sequelize.query(
      `
        SELECT o.id, o.status, o.createdAt
        FROM ${T("orders")} o
        WHERE LOWER(o.status) IN ('new','pending')
          AND o.createdAt <= :cutoff
          AND NOT EXISTS (
            SELECT 1 FROM ${T("payments")} p
            WHERE p.order_id = o.id AND p.status = 'SUCCESS'
          )
        ORDER BY o.createdAt ASC
      `,
      { type: QueryTypes.SELECT, replacements: { cutoff: cutoffUnassigned } }
    );
    for (const o of unassigned) {
      const code = genOrderCode(o);
      await notifyStaffOverdueUnassigned(code);
    }

    // 2) processing/ready bị kẹt quá lâu kể từ lần vào trạng thái hiện tại
    const hasHist = await hasOrderStatusHistoryTable();
    const processingStuck = hasHist
      ? await sequelize.query(
        `
            SELECT
              o.id, o.status, o.createdAt, o.updatedAt,
              COALESCE(
                (SELECT MAX(h.changed_at)
                 FROM ${T("order_status_history")} h
                 WHERE h.order_id = o.id AND LOWER(h.to_status) = 'processing'),
                o.updatedAt,
                o.createdAt
              ) AS statusSince
            FROM ${T("orders")} o
            WHERE LOWER(o.status) = 'processing'
              AND COALESCE(
                (SELECT MAX(h.changed_at)
                 FROM ${T("order_status_history")} h
                 WHERE h.order_id = o.id AND LOWER(h.to_status) = 'processing'),
                o.updatedAt,
                o.createdAt
              ) <= :cutoff
            ORDER BY statusSince ASC
          `,
        { type: QueryTypes.SELECT, replacements: { cutoff: cutoffProcessing } }
      )
      : await sequelize.query(
        `
            SELECT o.id, o.status, o.createdAt, o.updatedAt, o.updatedAt AS statusSince
            FROM ${T("orders")} o
            WHERE LOWER(o.status) = 'processing'
              AND COALESCE(o.updatedAt, o.createdAt) <= :cutoff
            ORDER BY COALESCE(o.updatedAt, o.createdAt) ASC
          `,
        { type: QueryTypes.SELECT, replacements: { cutoff: cutoffProcessing } }
      );
    for (const o of processingStuck) {
      const code = genOrderCode(o);
      await notifyStaffOverduePrinted(code, "processing");
    }

    const readyStuck = hasHist
      ? await sequelize.query(
        `
            SELECT
              o.id, o.status, o.createdAt, o.updatedAt,
              COALESCE(
                (SELECT MAX(h.changed_at)
                 FROM ${T("order_status_history")} h
                 WHERE h.order_id = o.id AND LOWER(h.to_status) = 'ready'),
                o.updatedAt,
                o.createdAt
              ) AS statusSince
            FROM ${T("orders")} o
            WHERE LOWER(o.status) = 'ready'
              AND COALESCE(
                (SELECT MAX(h.changed_at)
                 FROM ${T("order_status_history")} h
                 WHERE h.order_id = o.id AND LOWER(h.to_status) = 'ready'),
                o.updatedAt,
                o.createdAt
              ) <= :cutoff
            ORDER BY statusSince ASC
          `,
        { type: QueryTypes.SELECT, replacements: { cutoff: cutoffReady } }
      )
      : await sequelize.query(
        `
            SELECT o.id, o.status, o.createdAt, o.updatedAt, o.updatedAt AS statusSince
            FROM ${T("orders")} o
            WHERE LOWER(o.status) = 'ready'
              AND COALESCE(o.updatedAt, o.createdAt) <= :cutoff
            ORDER BY COALESCE(o.updatedAt, o.createdAt) ASC
          `,
        { type: QueryTypes.SELECT, replacements: { cutoff: cutoffReady } }
      );
    for (const o of readyStuck) {
      const code = genOrderCode(o);
      await notifyStaffOverduePrinted(code, "ready");
    }
  } catch (e) {
    console.error("checkAndNotifyOverdueOrders error:", e);
  }
}

// 🔔 Helper: tạo Notification khi nhận thanh toán thành công
async function createPaymentNotification(
  orderId,
  amount,
  method = "VNPAY",
  orderCode
) {
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
      `Payment of ${formatted} for order ${code} has been received successfully. ` +
      `Your order is now being processed.`;

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
      type: "info", // tạo đơn xong -> thông tin
      tag: "none",
      link,
      isRead: 0,
    });
  } catch (e) {
    console.error("createOrderCreatedNotification error:", e);
  }
}

// 🔔 Helper: tạo Notification khi admin/staff đổi trạng thái đơn + broadcast realtime cho bell
async function createOrderStatusNotification(
  orderOrRaw,
  frontendStatus,
  orderCodeFromRoute
) {
  try {
    const o = orderOrRaw?.toJSON ? orderOrRaw.toJSON() : orderOrRaw;
    if (!o || !o.customerId) return;

    const userId = o.customerId;
    const code = orderCodeFromRoute || genOrderCode(o);

    const fe = String(
      frontendStatus || mapDbStatusToFrontend(o.status) || ""
    ).toLowerCase();

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
      fe === "cancelled"
        ? "error"
        : fe === "ready" || fe === "completed"
          ? "success"
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

  const type = String(it.printType || "").toUpperCase();
  if (type === "DOCUMENT") {
    const size = ex.size || "A4";
    const side = ex.side ? String(ex.side) : (ex.twoSides ? "2 sides" : "1 side");
    const mode = ex.mode || ex.docType || "Black & White";
    return `Document • ${size} • ${side} • ${mode}`;
  }
  if (type === "PHOTO") {
    const size = ex.sizeCode || "10x15";
    const paper = ex.paper || "Glossy";
    const bl = ex.borderless ? " • Borderless" : "";
    return `Photo • ${size} • ${paper}${bl}`;
  }
  return it.printType || "Item";
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
  const s = String(feStatus || "").toLowerCase().trim();

  // accept both "pending" and "new" as pending
  if (s === "pending" || s === "new") return "pending";

  // accept multiple spellings
  if (s === "in-progress" || s === "processing" || s === "paid") return "processing";
  if (s === "ready") return "ready";
  if (s === "completed") return "completed";
  if (s === "cancelled" || s.startsWith("cancel")) return "cancelled";

  // IMPORTANT: default MUST be pending (not processing),
  // otherwise new orders can skip overdue_unassigned condition.
  return "pending";
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
    if (!userId)
      return res.status(401).json({ success: false, message: "Unauthorized" });

    const oc = String(req.params.orderCode || "").toUpperCase();
    const id = resolveOrderIdFromOrderCode(oc);
    if (!id)
      return res
        .status(404)
        .json({ success: false, message: "Invalid order code" });

    // ✅ Allow privileged (staff/admin/owner) to view any order by code
    const whereClause = { id };
    if (!isPrivileged(req.user)) whereClause.customerId = userId;

    const order = await db.Order.findOne({
      where: whereClause,
      attributes: [
        "id",
        "status",
        "note",
        "totalAmount",
        "createdAt",
        "updatedAt",
      ],
      include: [
        {
          model: db.User,
          as: "customer",
          attributes: ["id", "fullName", "email"],
        },
        {
          model: db.OrderItem,
          as: "items",
          attributes: [
            "id",
            "printType",
            "quantity",
            "unitPrice",
            "lineTotal",
            "extraOptions",
          ],
        },
      ],
      order: [[{ model: db.OrderItem, as: "items" }, "id", "ASC"]],
    });
    if (!order)
      return res
        .status(404)
        .json({ success: false, message: "Order not found" });

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
      cancellable: ["pending", "new"].includes(
        String(raw.status).toLowerCase()
      ),
    };
    return res.json({ success: true, data: payload });
  } catch (err) {
    console.error("getMyOrderByCode error:", err);
    return res
      .status(500)
      .json({ success: false, message: "Internal Server Error" });
  }
};

// ======================== SSE (in-memory) =========================
// orderCode -> Set(res)
const sseClientsByOrder = new Map();

function addSseClient(orderCode, res) {
  if (!sseClientsByOrder.has(orderCode))
    sseClientsByOrder.set(orderCode, new Set());
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
    try {
      res.write(`event: ping\ndata: "ok"\n\n`);
    } catch { }
  }, 25000);

  // 🔁 Replay trạng thái gần nhất (nếu có thể resolve code -> id)
  (async () => {
    try {
      const id = resolveOrderIdFromOrderCode(orderCode);
      if (!id) return;
      // Lấy order + payment tối thiểu để suy ra FE status
      const [ord] = await sequelize.query(
        `SELECT status, createdAt FROM ${T("orders")} WHERE id = :id LIMIT 1`,
        { type: QueryTypes.SELECT, replacements: { id } }
      );
      if (!ord) return;
      const feStatus = mapDbStatusToFrontend(ord.status);
      const prog = mapFrontendStatusToProgress(feStatus);
      const payload = {
        status: feStatus,
        dbStatus: String(ord.status || "").toLowerCase(),
        progress: prog.progress,
        currentStage: prog.currentStage,
        stages: ORDER_STAGES,
        updatedAt: new Date().toISOString(),
        replay: true,
      };
      const data = JSON.stringify({ type: "status", ...payload });
      try {
        res.write(`data: ${data}\n\n`);
      } catch { }
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
      (data.description || data.content || req.body?.description || "") +
      " " +
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
      String(desc || ""),
    ]
      .map((s) => s.toUpperCase())
      .join(" ");
    // optional: nén khoảng trắng
    pool = pool.replace(/\s+/g, " ").trim();

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

    // canonical orderCode để broadcast/notify đồng nhất UI (#ORD-YYYY-XXX)
    const orderForCode = await db.Order.findByPk(orderId, {
      attributes: ["id", "createdAt", "status"],
    });
    const canonicalCode = orderForCode ? genOrderCode(orderForCode) : oc;

    await sequelize.transaction(async (t) => {
      // Upsert payment VNPAY -> SUCCESS
      await sequelize.query(
        `INSERT INTO ${T("payments")}
           (order_id, method, status, amount, currency, paid_at, created_at, updated_at,
            callback_count, last_callback_at, provider_payload)
         VALUES
           (:orderId, 'VNPAY', 'SUCCESS', :amount, 'VND', NOW(), NOW(), NOW(),
            1, NOW(), JSON_ARRAY(CAST(:providerPayload AS JSON)))
        ON DUPLICATE KEY UPDATE
           method = 'VNPAY',
           status = 'SUCCESS',
           amount = VALUES(amount),
           currency = 'VND',
           paid_at = NOW(),
           updated_at = NOW(),
          callback_count = callback_count + 1,
           last_callback_at = NOW(),
           provider_payload =
             JSON_ARRAY_APPEND(
               COALESCE(provider_payload, JSON_ARRAY()),
               '$',
               CAST(:providerPayload AS JSON)
             )`,
        {
          type: QueryTypes.INSERT,
          transaction: t,
          replacements: {
            orderId,
            amount: amt,
            providerPayload: JSON.stringify({ ts: Date.now(), raw: req.body }),
          },
        }
      );

      // Khi nhận thanh toán/đặt cọc thành công:
      // - nếu đơn còn NEW/pending -> chuyển sang processing
      // - nếu đơn đang processing/ready/completed rồi -> giữ nguyên (tránh rollback trạng thái)
      await sequelize.query(
        `UPDATE ${T("orders")}
           SET status = CASE
                         WHEN LOWER(status) IN ('new','pending') THEN 'processing'
                         ELSE status
                       END,
               completedAt = CASE
                              WHEN LOWER(status) IN ('new','pending') THEN NULL
                              ELSE completedAt
                           END,
               updatedAt = NOW()
         WHERE id = :orderId`,
        { type: QueryTypes.UPDATE, transaction: t, replacements: { orderId } }
      );
    });

    // Sau khi lưu DB thành công mới phát SSE (để UI sync đúng)
    // 1) Báo realtime tiền đã vào (type: "paid")
    broadcastPaid(canonicalCode, { paidAmount: amt });

    // 2) Đồng thời broadcast trạng thái đơn đã hoàn tất (type: "status")
    // broadcast status theo trạng thái thực trong DB sau update
    let dbSt = "processing";
    try {
      const [ord] = await sequelize.query(
        `SELECT status FROM ${T("orders")} WHERE id = :id LIMIT 1`,
        { type: QueryTypes.SELECT, replacements: { id: orderId } }
      );
      dbSt = String(ord?.status || "processing").toLowerCase();
    } catch { }
    const feSt = mapDbStatusToFrontend(dbSt);
    const prog = mapFrontendStatusToProgress(
      String(feSt).toLowerCase() === "in-progress"
        ? "in-progress"
        : String(feSt).toLowerCase()
    );
    broadcastOrderStatus(canonicalCode, {
      status: feSt,
      dbStatus: dbSt,
      progress: prog.progress,
      currentStage: prog.currentStage,
      stages: ORDER_STAGES,
      updatedAt: new Date().toISOString(),
    });
    // 📣 Dashboard: phát sự kiện cập nhật 1 đơn
    try {
      const [row] = await sequelize.query(
        `SELECT id, status, totalAmount, createdAt, note FROM ${T(
          "orders"
        )} WHERE id = :id LIMIT 1`,
        {
          type: QueryTypes.SELECT,
          replacements: { id: resolveOrderIdFromOrderCode(oc) },
        }
      );
      if (row)
        RealtimeHub.publish({
          type: "orders.updated",
          ts: Date.now(),
          data: toDashboardRow(row),
        });
    } catch { }

    // 📊 Đồng bộ lại 3 card summary (this_week / this_month / this_year)
    try {
      await broadcastDashboardSummariesDefaultRanges();
    } catch (e) {
      console.error("broadcastDashboardSummaries error (webhookCassoLike):", e);
    }
    // 🔔 Tạo notification "Payment successful" cho chủ đơn
    try {
      await createPaymentNotification(orderId, amt, "VNPAY", canonicalCode);
    } catch (e) {
      console.error("createPaymentNotification error (webhookCassoLike):", e);
    }

    // 🔔 STAFF/OWNER notification: payment success
    try {
      await notifyStaffPaymentSuccess(canonicalCode, amt, "VNPAY");
    } catch (e) {
      console.error("notifyStaffPaymentSuccess error (webhookCassoLike):", e);
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
  try {
    assertPrivileged(req);
  } catch (e) {
    return res.status(e.status || 403).json({ ok: false, error: e.message });
  }
  const oc = String(req.params.orderCode || "").trim();
  const amt = Math.round(Number(req.body?.paidAmount || 0));
  if (!oc || !amt)
    return res.status(400).json({ ok: false, error: "invalid_body" });

  const orderId = resolveOrderIdFromOrderCode(oc);
  if (!orderId)
    return res.status(404).json({ ok: false, error: "invalid_order_code" });

  await sequelize.transaction(async (t) => {
    // Lưu/ghi đè payment (đánh dấu SUCCESS)
    await sequelize.query(
      `INSERT INTO ${T(
        "payments"
      )} (order_id, method, status, amount, currency, paid_at, created_at, updated_at)
       VALUES (:orderId, 'VNPAY', 'SUCCESS', :amount, 'VND', NOW(), NOW(), NOW())
       ON DUPLICATE KEY UPDATE
         method='VNPAY', status='SUCCESS', amount=VALUES(amount), currency='VND', paid_at=NOW(), updated_at=NOW()`,
      {
        type: QueryTypes.INSERT,
        transaction: t,
        replacements: { orderId, amount: amt },
      }
    );

    await sequelize.query(
      `UPDATE ${T("orders")}
         SET status = CASE
                       WHEN LOWER(status) IN ('new','pending') THEN 'processing'
                       ELSE status
                     END,
             completedAt = CASE
                            WHEN LOWER(status) IN ('new','pending') THEN NULL
                            ELSE completedAt
                          END,
             updatedAt = NOW()
       WHERE id = :orderId`,
      { type: QueryTypes.UPDATE, transaction: t, replacements: { orderId } }
    );
  });

  // 🔔 Notification cho khách: đã ghi nhận thanh toán (staff đánh dấu)
  try {
    await createPaymentNotification(orderId, amt, "VNPAY", oc);
  } catch (e) {
    console.error("createPaymentNotification error (markPaidManual):", e);
  }

  // 🔔 STAFF/OWNER notification
  try {
    await notifyStaffPaymentSuccess(oc, amt, "VNPAY");
  } catch (e) {
    console.error("notifyStaffPaymentSuccess error (markPaidManual):", e);
  }

  // Báo về FE (SSE) để các trang khác đang mở tự cập nhật
  // 1) Thanh toán thành công
  broadcastPaid(oc, { paidAmount: amt });
  // 2) Trạng thái đơn đã hoàn tất
  const prog = mapFrontendStatusToProgress("in-progress");
  broadcastOrderStatus(oc, {
    status: "In-Progress",
    dbStatus: "processing",
    progress: prog.progress,
    currentStage: prog.currentStage,
    stages: ORDER_STAGES,
    updatedAt: new Date().toISOString(),
  });
  res.json({ ok: true });
  // Dashboard update
  try {
    const [row] = await sequelize.query(
      `SELECT id, status, totalAmount, createdAt, note FROM ${T(
        "orders"
      )} WHERE id = :id LIMIT 1`,
      {
        type: QueryTypes.SELECT,
        replacements: { id: resolveOrderIdFromOrderCode(oc) },
      }
    );
    if (row)
      RealtimeHub.publish({
        type: "orders.updated",
        ts: Date.now(),
        data: toDashboardRow(row),
      });
  } catch { }
  // 3 card summary realtime
  try {
    await broadcastDashboardSummariesDefaultRanges();
  } catch (e) {
    console.error("broadcastDashboardSummaries error (markPaidManual):", e);
  }
};

// expose helpers
exports._notifyStaffNewOrder = notifyStaffNewOrder;
exports._notifyStaffCancelOrder = notifyStaffCancelOrder;
exports._notifyStaffPaymentSuccess = notifyStaffPaymentSuccess;
exports._notifyStaffOverdueUnassigned = notifyStaffOverdueUnassigned;
exports._notifyStaffOverduePrinted = notifyStaffOverduePrinted;

// PATCH /api/orders/:orderCode/status  {status}
// Nhân viên cập nhật trạng thái -> lưu DB + broadcast SSE cho khách hàng
exports.updateStatusByCode = async (req, res) => {
  try {
    // ===== P0: bắt buộc quyền staff/admin
    try {
      assertPrivileged(req);
    } catch (e) {
      return res
        .status(e.status || 403)
        .json({ success: false, message: e.message });
    }

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
    // set/clear completedAt theo schema
    if (String(dbStatus).toLowerCase() === "completed")
      order.completedAt = new Date();
    else order.completedAt = null;
    await order.save();

    // 🔔 Tạo notification cho chủ đơn khi trạng thái thay đổi
    // (dùng frontendStatus để text thân thiện, orderCode từ URL)
    try {
      await createOrderStatusNotification(order, frontendStatus, orderCode);
    } catch (e) {
      console.error(
        "createOrderStatusNotification error (updateStatusByCode):",
        e
      );
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
  const orderCode = String(req.params.orderCode || "").trim();
  const r = await _origUpdate.call(this, req, res);
  try {
    const id = resolveOrderIdFromOrderCode(orderCode);
    if (id) {
      const order = await db.Order.findByPk(id, {
        include: [
          { model: db.User, as: "customer", attributes: ["fullName", "email"] },
          { model: db.OrderItem, as: "items", attributes: ["printType"] },
        ],
      });
      if (order) {
        RealtimeHub.publish({
          type: "orders.updated",
          ts: Date.now(),
          data: toDashboardRow(order),
        });
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
    if (!userId)
      return res.status(401).json({ success: false, message: "Unauthorized" });
    const oc = String(req.params.orderCode || "")
      .trim()
      .toUpperCase();
    const id = resolveOrderIdFromOrderCode(oc);
    if (!id)
      return res
        .status(404)
        .json({ success: false, message: "Invalid order code" });

    const order = await db.Order.findOne({
      where: { id, customerId: userId },
      // cần customerId để gửi notification cho đúng user
      attributes: ["id", "status", "note", "customerId"],
    });
    if (!order)
      return res
        .status(404)
        .json({ success: false, message: "Order not found" });
    const st = String(order.status).toLowerCase();
    if (!["pending", "new"].includes(st)) {
      return res
        .status(409)
        .json({ success: false, message: "ONLY_PENDING_CAN_BE_CANCELLED" });
    }
    await order.update({
      status: "cancelled",
      note: req.body?.reason
        ? `${order.note ? order.note + " | " : ""}User cancel: ${req.body.reason
        }`
        : order.note,
    });

    // 🔔 STAFF/OWNER notification: cancel request
    try {
      await notifyStaffCancelOrder(oc, req.body?.reason);
    } catch (e) {
      console.error("notifyStaffCancelOrder error:", e);
    }

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
    res.json({ success: true, message: "ORDER_CANCELLED" });

    // 📣 Dashboard: phát sự kiện cập nhật 1 đơn (đã bị hủy)
    try {
      const [row] = await sequelize.query(
        `SELECT id, status, totalAmount, createdAt, note FROM ${T(
          "orders"
        )} WHERE id = :id LIMIT 1`,
        { type: QueryTypes.SELECT, replacements: { id } }
      );
      if (row) {
        RealtimeHub.publish({
          type: "orders.updated",
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
    console.error("cancelMyOrder error:", e);
    return res
      .status(500)
      .json({ success: false, message: "Internal Server Error" });
  }
};

exports.listMyOrders = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId)
      return res.status(401).json({ success: false, message: "Unauthorized" });

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
        rawStatus: raw, // ✅ dùng biến raw đúng
        status: normalizeStatus(o.status),
        code: genOrderCode(o),
        cancellable: ["pending", "new"].includes(raw), // ✅ cho hủy khi NEW
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
    return res
      .status(500)
      .json({ success: false, message: "Internal Server Error" });
  }
};

// ====== LIST ALL ORDERS FOR EMPLOYEE / ADMIN ======
// GET /api/orders/all
exports.listAllOrders = async (req, res) => {
  try {
    if (!isPrivileged(req.user)) {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }

    // Tạo 2 case overdue cho staff khi dashboard gọi list
    // Await để E2E test thấy notifications ngay sau khi mở dashboard.
    // ✅ tối ưu: không scan overdue theo refresh dashboard (tránh throttle/dedupe gây cảm giác "lọc")
    // Scheduler/server sẽ chạy độc lập.
    if (String(process.env.OVERDUE_SCAN_ON_DASHBOARD || "0") === "1") {
      await checkAndNotifyOverdueOrders().catch(() => { });
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
        whereClause.status = { [Op.in]: ["processing"] };
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
          ? { where: { printType: orderType }, required: true } // inner join khi có filter
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
      distinct: true, // cần để count đúng khi có include
      subQuery: false, // tránh đẩy điều kiện include vào subquery
    });

    const data = rows.map((r) => {
      const o = r.toJSON();
      const rawStatus = String(o.status).toLowerCase();
      const feStatus = mapDbStatusToFrontend(o.status);
      const firstItem = (o.items || [])[0];

      return {
        id: o.id,
        code: genOrderCode(o),
        status: feStatus, // FE dùng để hiển thị  dropdown
        rawStatus, // nếu cần debug
        totalAmount: Number(o.totalAmount || 0),
        createdAt: o.createdAt,
        note: o.note || null,
        customerName: o.customer?.fullName || o.customer?.email || "N/A",
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
    if (!userId)
      return res.status(401).json({ success: false, message: "Unauthorized" });

    const id = req.params.id;

    // ✅ Allow privileged (staff/admin/owner) to view any order by id
    const whereClause = { id };
    if (!isPrivileged(req.user)) whereClause.customerId = userId;

    const order = await db.Order.findOne({
      where: whereClause,
      // Trả thêm note (và có thể giữ subtotal nếu muốn hiển thị)
      attributes: [
        "id",
        "status",
        "note",
        "totalAmount",
        "createdAt",
        "updatedAt",
      ],
      include: [
        {
          model: db.User,
          as: "customer",
          attributes: ["id", "fullName", "email"],
        },
        // Đảm bảo có printType + extraOptions để FE Reorder
        {
          model: db.OrderItem,
          as: "items",
          attributes: [
            "id",
            "printType",
            "quantity",
            "unitPrice",
            "lineTotal",
            "extraOptions",
          ],
        },
      ],
      order: [[{ model: db.OrderItem, as: "items" }, "id", "ASC"]],
    });

    if (!order)
      return res
        .status(404)
        .json({ success: false, message: "Order not found" });

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
      cancellable: ["pending", "new"].includes(
        String(raw.status).toLowerCase()
      ),
    };
    return res.json({ success: true, data: payload });
  } catch (err) {
    console.error("getMyOrderById error:", err);
    return res
      .status(500)
      .json({ success: false, message: "Internal Server Error" });
  }
};

exports.confirmStorePayment = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId)
      return res.status(401).json({ success: false, message: "Unauthorized" });

    const id = Number(req.params.id);
    if (!id)
      return res
        .status(400)
        .json({ success: false, message: "Invalid order id" });

    // Chỉ cho chủ đơn
    const order = await db.Order.findOne({ where: { id, customerId: userId } });
    if (!order)
      return res
        .status(404)
        .json({ success: false, message: "Order not found" });

    // Tính số tiền phải thanh toán ngay (tiền cọc hoặc đủ)
    const amount = calcDeposit(order.totalAmount);

    await sequelize.transaction(async (t) => {
      // Tạo/đồng bộ bản ghi payments (CASH, PENDING) với amount hợp lệ
      await sequelize.query(
        `INSERT INTO ${T(
          "payments"
        )} (order_id, method, status, amount, currency, paid_at, created_at, updated_at)
         VALUES (:orderId, 'CASH', 'PENDING', :amount, 'VND', NULL, NOW(), NOW())
         ON DUPLICATE KEY UPDATE
           method = 'CASH',
           -- nếu đã SUCCESS thì giữ nguyên amount cũ, không ghi đè
           amount = IF(${T("payments")}.status='SUCCESS', ${T(
          "payments"
        )}.amount, VALUES(amount)),
           currency = 'VND',
           updated_at = NOW()`,
        {
          type: QueryTypes.INSERT,
          transaction: t,
          replacements: { orderId: id, amount },
        }
      );

      // Chỉ chuyển NEW/PENDING -> PROCESSING, tránh regress READY/COMPLETED
      await sequelize.query(
        `UPDATE ${T("orders")}
            SET status = CASE
                          WHEN LOWER(status) IN ('new','pending') THEN 'processing'
                          ELSE status
                        END,
                updatedAt = NOW()
          WHERE id = :orderId`,
        { type: QueryTypes.UPDATE, transaction: t, replacements: { orderId: id } }
      );
    });

    // Sau khi transaction xong: broadcast trạng thái mới cho UI khách
    // "Pay at store" -> đơn đã được xác nhận và đang trong trạng thái "Processing"
    const orderCode = genOrderCode(order); // cùng format với getMyOrderByCode
    const prog = mapFrontendStatusToProgress("in-progress");
    broadcastOrderStatus(orderCode, {
      status: "In-Progress",
      dbStatus: "processing", // trạng thái trong DB
      progress: prog.progress,
      currentStage: prog.currentStage,
      stages: ORDER_STAGES,
      updatedAt: new Date().toISOString(),
    });

    // Đọc lại payment để trả về cho FE (cần có id)
    const payment = await sequelize.query(
      `SELECT id, order_id AS orderId, method, status, amount, currency,
            paid_at AS paidAt, created_at AS createdAt, updated_at AS updatedAt
     FROM ${T("payments")}
     WHERE order_id = :orderId
     LIMIT 1`,
      { type: QueryTypes.SELECT, replacements: { orderId: id } }
    );
    // trả về object (không phải mảng) hoặc null
    res.json({ success: true, payment: payment?.[0] ?? null });

    // 📣 Dashboard: phát sự kiện cập nhật 1 đơn (đã chuyển sang processing)
    try {
      const [row] = await sequelize.query(
        `SELECT id, status, totalAmount, createdAt, note FROM ${T(
          "orders"
        )} WHERE id = :id LIMIT 1`,
        { type: QueryTypes.SELECT, replacements: { id } }
      );
      if (row) {
        RealtimeHub.publish({
          type: "orders.updated",
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
      console.error(
        "broadcastDashboardSummaries error (confirmStorePayment):",
        e
      );
    }
    return;
  } catch (e) {
    console.error("confirmStorePayment error:", e);
    return res
      .status(500)
      .json({ success: false, message: "Internal Server Error" });
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
  if (key === "this_week")
    return { from: startOfWeek(n), to: endOfWeek(n), prevKey: "last_week" };
  if (key === "last_week") {
    const d = new Date(n);
    d.setDate(d.getDate() - 7);
    return { from: startOfWeek(d), to: endOfWeek(d), prevKey: "prev_week" };
  }
  if (key === "this_month")
    return { from: startOfMonth(n), to: endOfMonth(n), prevKey: "last_month" };
  if (key === "last_month") {
    const d = new Date(n.getFullYear(), n.getMonth() - 1, 1);
    return { from: startOfMonth(d), to: endOfMonth(d), prevKey: "prev_month" };
  }
  if (key === "this_year")
    return { from: startOfYear(n), to: endOfYear(n), prevKey: "last_year" };
  if (key === "last_year") {
    const d = new Date(n.getFullYear() - 1, 0, 1);
    return { from: startOfYear(d), to: endOfYear(d), prevKey: "prev_year" };
  }
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
    const d = new Date(now);
    d.setDate(d.getDate() - 14);
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
  const c = Number(curr || 0),
    p = Number(prev || 0);
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
      FROM ${T("orders")}
      WHERE ${whereDate}
    `,
    { type: QueryTypes.SELECT, replacements: { from, to } }
  );
  const [cust] = await sequelize.query(
    `
      SELECT COUNT(DISTINCT customerId) AS customers
      FROM ${T("orders")}
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
    abandonedRate:
      Number(rows?.allCount || 0) === 0
        ? 0
        : Math.round(
          (100 * Number(rows?.canceledCount || 0)) /
          Number(rows?.allCount || 0)
        ),
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
    from,
    to,
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
    if (!isPrivileged(req.user))
      return res.status(403).json({ success: false, message: "Forbidden" });
    const range = String(req.query.range || "this_week");
    const payload = await buildSummaryPayload(range);
    return res.json({ success: true, summary: payload });
  } catch (e) {
    console.error("getOrdersSummary error:", e);
    return res
      .status(500)
      .json({ success: false, message: "Internal Server Error" });
  }
};

// GET /api/orders/summary-multi?ranges=this_week,this_month,this_year
exports.getOrdersSummaryMulti = async (req, res) => {
  try {
    if (!isPrivileged(req.user))
      return res.status(403).json({ success: false, message: "Forbidden" });
    const raw = String(req.query.ranges || "").trim();
    const keys = Array.from(
      new Set(
        (raw ? raw.split(",") : ["this_week"])
          .map((s) => s.trim())
          .filter(Boolean)
      )
    );
    const out = {};
    await Promise.all(
      keys.map(async (k) => {
        out[k] = await buildSummaryPayload(k);
      })
    );
    return res.json({ success: true, summaries: out });
  } catch (e) {
    console.error("getOrdersSummaryMulti error:", e);
    return res
      .status(500)
      .json({ success: false, message: "Internal Server Error" });
  }
};
module.exports.__runOverdueNow = checkAndNotifyOverdueOrders;
