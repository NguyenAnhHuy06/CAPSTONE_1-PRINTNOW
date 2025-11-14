// server.js
require("dotenv").config(); // nạp .env thật sớm

const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const cookieParser = require("cookie-parser");
const { connectDB } = require("./config/database");

const feHtml = (name) => path.join(__dirname, "FE/html", name);

const app = express();
const PORT = process.env.PORT || 5000;

/* =======================
   Middlewares
======================= */
// tin cậy proxy để req.protocol phản ánh đúng (HTTP/HTTPS) sau Nginx/Proxy
app.set("trust proxy", 1);

const corsOrigin = process.env.CORS_ORIGIN
  ? { origin: [process.env.CORS_ORIGIN], credentials: true }
  : { origin: true, credentials: true }; // dev: cho mọi origin + gửi cookie

app.use(cors(corsOrigin));
// Bắt OPTIONS cho preflight (đặc biệt khi FE gọi fetch kèm credentials)
app.options("*", cors(corsOrigin));

app.use(express.json({ limit: "1mb" }));
//app.post('/api/orders/webhooks/casso', orders.webhookCassoLike);
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser()); // để đọc cookie từ request

/* =======================
   Static (uploads & FE)
======================= */
app.use(
  "/uploads",
  express.static(path.join(__dirname, "uploads"), {
    etag: true,
    lastModified: true,
    setHeaders: (res, filePath) => {
      if (filePath.includes(path.sep + "avatars" + path.sep)) {
        res.setHeader("Cache-Control", "no-cache, must-revalidate");
      } else {
        // cho phép các file uploads KHÁC cache tốt hơn
        res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      }
    },
  })
);
app.use("/css", express.static(path.join(__dirname, "FE/css")));
app.use("/js", express.static(path.join(__dirname, "FE/js")));
app.use(express.static(path.join(__dirname, "FE/html")));
// ở gần chỗ bạn dùng express.static cho FE/html
app.use('/service', express.static(path.join(__dirname, 'FE', 'html')));

/* Helper: gửi file HTML với no-cache để tránh dính cache khi dev/OTP */
function sendHtmlNoCache(res, absPath) {
  res.set({
    "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
    Pragma: "no-cache",
    Expires: "0",
    "Surrogate-Control": "no-store",
  });
  return res.sendFile(absPath);
}

/* =======================
   Pretty URLs cho FE
   - Login.html
   - Register.html
   - Forgot_Password.html
======================= */
app.get("/", (req, res) => sendHtmlNoCache(res, feHtml("Login.html")));
app.get("/login", (req, res) => sendHtmlNoCache(res, feHtml("Login.html")));
app.get("/register", (req, res) =>
  sendHtmlNoCache(res, feHtml("Register.html"))
);
app.get("/forgot-password", (req, res) =>
  sendHtmlNoCache(res, feHtml("Forgot_Password.html"))
);

/* verify-otp page: tìm file phù hợp để không cần đổi tên trong FE/html */
const otpHtmlCandidates = [
  "VerifyOTP.html",
  "verify-otp.html",
  "Verify_OTP.html",
  "OTP_Verify.html",
];

app.get("/verify-otp", (req, res) => {
  const found = otpHtmlCandidates.find((name) => fs.existsSync(feHtml(name)));
  if (found) return sendHtmlNoCache(res, feHtml(found));
  return res
    .status(404)
    .send(
      "OTP page not found. Expecting one of: " +
      otpHtmlCandidates.join(", ") +
      " inside FE/html/"
    );
});

/* reset password page (file của bạn là Set_New_Password.html) */
app.get("/reset-password", (req, res) =>
  sendHtmlNoCache(res, feHtml("Set_New_Password.html"))
);

/* =======================
   Pretty URLs cho các trang mới (ZIP)
   - Không cần đổi tên file trong FE/html
   - Ưu tiên no-cache khi dev
======================= */
const pageMap = [
  // path                // các file ứng viên trong FE/html
  ["/about-us", ["About_us.html", "AboutUs.html"]],
  ["/home", ["Home_customer.html", "Home.html"]],
  ["/notifications", ["Notification.html", "Notifications.html"]],

  // nhóm order
  ["/order/details", ["Oder_Details.html", "Order_Details.html"]],
  ["/order/history", ["Oder_History.html", "Order_History.html"]],
  ["/order/payment", ["Oder_Payment.html", "Order_Payment.html"]],
  ["/order/status", ["Oder_Status.html", "Order_Status.html"]],
  [
    "/order/confirm",
    ["Print_Order_Confirmation.html", "Order_Confirmation.html"],
  ],

  // profile / settings
  ["/profile", ["Personal_Profile.html", "Profile.html"]],
  ["/settings", ["Setting.html", "Settings.html"]],

  // dịch vụ in / trang in
  ["/service/print", ["Service_Print.html"]],
  ["/print/document", ["PrintDocument.html"]],
  ["/print/photo", ["PrintPhoto.html"]],
];

// Tạo route cho từng path: tìm file có sẵn rồi trả về
for (const [routePath, candidates] of pageMap) {
  app.get(routePath, (req, res) => {
    const found = candidates.find((name) => fs.existsSync(feHtml(name)));
    if (found) return sendHtmlNoCache(res, feHtml(found));
    return res
      .status(404)
      .send(
        `Page not found for "${routePath}". Expecting one of: ${candidates.join(
          ", "
        )} inside FE/html/`
      );
  });
}

/* --------- Redirect các deep-link cũ về pretty URL --------- */
app.get("/profile/Personal_Profile.html", (req, res) => res.redirect(301, "/profile"));
app.get("/settings/Setting.html", (req, res) => res.redirect(301, "/settings"));
// (tuỳ chọn) nếu bạn từng trỏ về /service/Order_History.html thì điều hướng về pretty URL
app.get("/service/Order_History.html", (req, res) => res.redirect(302, "/order/history"));
app.get("/PrintPhoto.html", (req, res) => res.redirect(302, "/print/photo"));

/* =======================
   API Routes
======================= */
app.use("/api/auth", require("./routes/auth-sequelize"));
app.use("/api/profile", require("./routes/profile"));
app.use("/api/settings", require("./routes/settings.routes"));
app.use("/api/files", require("./routes/files"));
app.use("/api/file-analyzer", require("./routes/file-analyzer"));
app.use("/api/orders", require("./routes/orders"));
app.use("/api/catalog", require("./routes/catalog"));
// NEW: Payments (VNPay demo/polling)
app.use("/api/payments", require("./routes/payments"));
// NEW: Notifications
app.use("/api/notifications", require("./routes/notifications"));

/* =======================
   API Root & Healthcheck
======================= */
app.get("/api", (req, res) => {
  res.json({
    ok: true,
    message: "API root",
    try: [
      "/api/health",
      "/api/catalog/paper-sizes",
      "/api/catalog/color-modes",
      "/api/catalog/sides",
      "/api/catalog/price-rules",
      "/api/orders",
      "/api/auth/login",
    ],
  });
});

app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    status: "healthy",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV || "development",
  });
});

/* =======================
   404 cho API (đặt SAU tất cả routes /api)
======================= */
app.use("/api", (req, res) => {
  res.status(404).json({ error: "Not found" });
});

/* =======================
   Start server sau khi DB sẵn sàng
======================= */
(async () => {
  try {
    await connectDB();
    app.listen(PORT, () => {
      console.log(`🚀 Server đang chạy trên cổng ${PORT}`);
      console.log(`📱 Frontend: http://localhost:${PORT}`);
      console.log(`🔌 API: http://localhost:${PORT}/api`);
    });
  } catch (err) {
    console.error("Không thể khởi động server do lỗi DB:", err);
    process.exit(1);
  }
})();
