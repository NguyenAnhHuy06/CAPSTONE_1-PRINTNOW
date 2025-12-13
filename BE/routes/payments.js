// routes/payments.js
const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/payments.controller");
const auth = require("../middleware/auth");

// Tạo phiên thanh toán VNPay (giả lập – trả về id & qrImageUrl)
router.post("/vnpay/create", auth, ctrl.createVnpayPayment);

// FE poll trạng thái
router.get("/:paymentId/status", ctrl.getPaymentStatus);

// (tuỳ chọn) huỷ phiên
router.post("/:paymentId/cancel", ctrl.cancelPayment);

// IPN mô phỏng (dùng để đổi trạng thái sang SUCCESS khi test)
router.get("/vnpay/ipn", ctrl.vnpayIpn);

module.exports = router;