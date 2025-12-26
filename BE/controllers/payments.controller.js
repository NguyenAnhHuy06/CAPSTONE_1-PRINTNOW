// controllers/payments.controller.js
// Giả lập lưu trạng thái thanh toán trong bộ nhớ (đủ để FE chạy flow VNPay)
// Khi triển khai thật, thay bằng bảng 'payments' trong DB + verify IPN VNPay.

const memoryPayments = new Map(); // Map<id, {...}>
let autoId = 1000;

const { sequelize } = require("../config/database");
const { QueryTypes } = require("sequelize");
const ordersCtrl = require("./orders.controller"); // để phát SSE sau khi DB ok

// Dùng chung cách build tên bảng có db prefix như orders.controller
const DB = (sequelize.config && sequelize.config.database) || process.env.DB_NAME;
const T = (name) => `\`${DB}\`.\`${name}\``;

// helper local: tạo order code giống Orders controller
function genOrderCodeLocal(id, createdAt) {
  const d = createdAt ? new Date(createdAt) : new Date();
  const year = d.getFullYear();
  const pad = String(id || 0).padStart(3, "0");
  return `#ORD-${year}-${pad}`;
}

// Helper: lưu DB khi thanh toán thành công (không dùng top-level await!)
async function persistPaymentSuccess(orderId, amount) {
  return await sequelize.transaction(async (t) => {
    // 1) Upsert payment -> SUCCESS
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
      {
        type: QueryTypes.INSERT,
        transaction: t,
        replacements: { orderId, amount },
      }
    );

    // 2) Khóa & đọc tổng hiện tại để phản ánh giảm giá (nếu có)
    const [row] = await sequelize.query(
      `SELECT totalAmount, createdAt FROM ${T('orders')} WHERE id = :orderId FOR UPDATE`,
      { type: QueryTypes.SELECT, transaction: t, replacements: { orderId } }
    );
    const currentTotal = Number(row?.totalAmount ?? 0);
    const finalTotal = Math.min(currentTotal || amount, amount || currentTotal);

    // 3) KHÔNG tự động completed khi nhận tiền.
    //    Chỉ đẩy NEW/PENDING -> PROCESSING; READY/COMPLETED giữ nguyên.
    await sequelize.query(
      `UPDATE ${T('orders')}
         SET status = CASE
                       WHEN LOWER(status) IN ('new','pending') THEN 'processing'
                       ELSE status
                     END,
             totalAmount = :finalTotal,
             -- không đụng completedAt ở đây
             updatedAt = NOW()
       WHERE id = :orderId`,
      {
        type: QueryTypes.UPDATE,
        transaction: t,
        replacements: { orderId, finalTotal },
      }
    );

    // 4) Trả về dữ liệu dùng cho SSE
    return {
      createdAt: row?.createdAt || new Date(),
      finalTotal,
    };
  });
}

// Tạo phiên thanh toán VNPay (giả lập – trả về id & qrImageUrl)
exports.createVnpayPayment = async (req, res) => {
  try {
    const { orderId, amount, payType, returnUrl } = req.body || {};
        const amtNum = Number(amount);
    if (!orderId || !amtNum || amtNum <= 0) {
      return res
        .status(400)
        .json({ success: false, message: "Missing params" });
    }

    const id = ++autoId;
    const qrImageUrl = `https://placehold.co/180x180/000/fff?text=VNPAY%20${amount}`;
    const expireAt = new Date(Date.now() + 3 * 60 * 1000).toISOString(); // 3 phút

    memoryPayments.set(id, {
      id,
      orderId: Number(orderId),
      amount: Math.round(amtNum),
      status: "PENDING", // PENDING | SUCCESS | FAILED | EXPIRED | CANCELLED
      qrImageUrl,
      expireAt,
      returnUrl: String(returnUrl || ""),
      payType: payType === "DEPOSIT" ? "DEPOSIT" : "FULL",
    });

    return res.json({
      success: true,
      payment: {
        id,
        orderId: Number(orderId),
        amount: Math.round(amtNum),
        status: "PENDING",
        qrImageUrl,
        expireAt,
      },
    });
  } catch (e) {
    console.error("[payments.controller] createVnpayPayment error:", e);
    return res
      .status(500)
      .json({ success: false, message: "Create VNPay session failed" });
  }
};

// FE poll trạng thái
exports.getPaymentStatus = async (req, res) => {
  try {
    const id = Number(req.params.paymentId);
    const p = memoryPayments.get(id);
    if (!p)
      return res
        .status(404)
        .json({ success: false, message: "Payment not found" });

    if (
      p.status === "PENDING" &&
      p.expireAt &&
      Date.now() > Date.parse(p.expireAt)
    ) {
      p.status = "EXPIRED";
    }
    return res.json({ success: true, payment: { id: p.id, status: p.status } });
  } catch (e) {
    console.error("[payments.controller] getPaymentStatus error:", e);
    return res
      .status(500)
      .json({ success: false, message: "Get status failed" });
  }
};

// Huỷ phiên
exports.cancelPayment = async (req, res) => {
  try {
    const id = Number(req.params.paymentId);
    const p = memoryPayments.get(id);
    if (!p)
      return res
        .status(404)
        .json({ success: false, message: "Payment not found" });
    if (p.status === "PENDING") p.status = "CANCELLED";
    return res.json({ success: true });
  } catch (e) {
    console.error("[payments.controller] cancelPayment error:", e);
    return res.status(500).json({ success: false, message: "Cancel failed" });
  }
};

// IPN giả lập: GET /api/payments/vnpay/ipn?paymentId=XXXX
exports.vnpayIpn = async (req, res) => {
  try {
    const id = Number(req.query.paymentId);
    const p = memoryPayments.get(id);
    if (!p)
      return res
        .status(404)
        .json({ success: false, message: "Payment not found" });

    p.status = "SUCCESS";

    // ✅ cập nhật DB: payments + orders (không top-level await)
    try {
      const txInfo = await persistPaymentSuccess(p.orderId, p.amount);

      // Phát SSE "paid" cho đúng orderCode để FE QR nhận được
      // Lấy createdAt để gen #ORD-YYYY-XXX
      let orderRow = null;
      try {
        [orderRow] = await sequelize.query(
          `SELECT createdAt FROM ${T('orders')} WHERE id = :orderId`,
          { type: QueryTypes.SELECT, replacements: { orderId: p.orderId } }
        );
      } catch { }
      const orderCode =
        (typeof ordersCtrl._genOrderCode === "function")
          ? ordersCtrl._genOrderCode({ id: p.orderId, createdAt: orderRow?.createdAt || new Date() })
          : genOrderCodeLocal(p.orderId, orderRow?.createdAt);

      if (typeof ordersCtrl._broadcastPaid === "function") {
        ordersCtrl._broadcastPaid(orderCode, { paidAmount: Math.round(Number(p.amount) || 0) });
      }
      // ✅ Đồng bộ với webhook Casso: broadcast luôn "status" -> Successful (100%)
      try {
        // đọc status thật trong DB rồi broadcast đúng
        let dbSt = "processing";
        try {
          const [ord] = await sequelize.query(
            `SELECT status FROM ${T('orders')} WHERE id=:orderId LIMIT 1`,
            { type: QueryTypes.SELECT, replacements: { orderId: p.orderId } }
          );
          dbSt = String(ord?.status || "processing").toLowerCase();
        } catch { }

        const mapProg = ordersCtrl._mapFrontendStatusToProgress || ((s) => ({ progress: 60, currentStage: "Printing" }));
        const fe = (typeof ordersCtrl._mapDbStatusToFrontend === "function")
          ? ordersCtrl._mapDbStatusToFrontend(dbSt)
          : (dbSt === "processing" ? "In-Progress" : dbSt === "ready" ? "Ready" : dbSt === "completed" ? "Completed" : "Pending");

        const prog = mapProg(String(fe).toLowerCase() === "in-progress" ? "in-progress" : String(fe).toLowerCase());
        if (typeof ordersCtrl._broadcastStatus === "function") {
          ordersCtrl._broadcastStatus(orderCode, {
            type: "status",
            status: fe,
            dbStatus: dbSt,
            progress: prog.progress,
            currentStage: prog.currentStage,
            stages: ordersCtrl._ORDER_STAGES || [],
            updatedAt: new Date().toISOString(),
          });
        }
      } catch (e) {
        console.warn("[payments.controller] broadcast status after IPN failed:", e);
      }

      // 🔔 Sau khi DB & SSE ok: tạo Notification "Payment successful"
      try {
        if (typeof ordersCtrl._createPaymentNotification === "function") {
          await ordersCtrl._createPaymentNotification(p.orderId, p.amount, "VNPAY", orderCode);
        }
      } catch (e) {
        console.error("[payments.controller] createPaymentNotification error:", e);
      }

      // 🔔 STAFF/OWNER notification: payment success
      try {
        if (typeof ordersCtrl._notifyStaffPaymentSuccess === "function") {
          await ordersCtrl._notifyStaffPaymentSuccess(orderCode, p.amount, "VNPAY");
        }
      } catch (e) {
        console.error("[payments.controller] notifyStaffPaymentSuccess error:", e);
      }
    } catch (dbErr) {
      console.error(
        "[payments.controller] persistPaymentSuccess error:",
        dbErr
      );
      // vẫn trả 200 để mô phỏng IPN ok, nhưng log lỗi để xử lý sau
    }

    return res.json({ success: true });
  } catch (e) {
    console.error("[payments.controller] ipn error:", e);
    return res
      .status(500)
      .json({ success: false, message: "IPN handle failed" });
  }
};
