// routes/auth-sequelize.js
const express = require("express");
const jwt = require("jsonwebtoken");
const { body, validationResult } = require("express-validator");
const { Op } = require("sequelize");
const bcrypt = require("bcryptjs");

const User = require("../models/User");
const OTP = require("../models/OTP");
const auth = require("../middleware/auth");
const { generateOTP, sendOTPEmail } = require("../services/emailService");

const router = express.Router();

/* Helpers */
const generateToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET || "fallback_secret", {
    expiresIn: process.env.JWT_EXPIRE || "7d",
  });

const ok = (res, payload = {}) => res.json({ success: true, ...payload });
const bad = (res, message, extra = {}, code = 400) =>
  res.status(code).json({ success: false, message, ...extra });

/** Chuẩn hóa avatarUrl
 * - Nếu đã là http/https ⇒ giữ nguyên
 * - Nếu là đường dẫn tương đối/filename ⇒ chuyển thành absolute /uploads/avatars/...
 */
function makeAvatarUrl(req, val) {
  if (!val) return null;
  try {
    const s = String(val).trim();
    if (/^https?:\/\//i.test(s)) return s;                      // absolute url
    const rel = s.startsWith("/uploads/") ? s : `/uploads/avatars/${s}`;
    return `${req.protocol}://${req.get("host")}${rel}`;
  } catch {
    return null;
  }
}

/** Cookie Options thống nhất cho auth cookie */
function cookieOptions(req) {
  // secure khi production HOẶC khi header nói đang qua HTTPS (x-proto)
  const isHttps =
    req.secure ||
    req.headers["x-forwarded-proto"] === "https" ||
    process.env.NODE_ENV === "production";
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: !!isHttps,
    path: "/",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  };
}

/* ---------------------- REGISTER ---------------------- */
router.post(
  "/register",
  [
    body("fullName").notEmpty().withMessage("Vui lòng nhập tên"),
    body("email").isEmail().withMessage("Vui lòng nhập email hợp lệ"),
    body("password")
      .isLength({ min: 6 })
      .withMessage("Mật khẩu phải có ít nhất 6 ký tự"),
    body("phone")
      .matches(/^[0-9]{10,11}$/)
      .withMessage("Số điện thoại phải có 10-11 chữ số"),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return bad(res, "Dữ liệu không hợp lệ", { errors: errors.array() });
      }

      const { fullName, email, password, phone } = req.body;

      if (await User.findOne({ where: { email } })) {
        return bad(res, "Email này đã được sử dụng");
      }
      if (await User.findOne({ where: { phone } })) {
        return bad(res, "Số điện thoại này đã được sử dụng");
      }

      const passwordHash = await bcrypt.hash(password, 10);

      const user = await User.create({
        fullName,
        email,
        passwordHash, // đồng bộ với reset
        phone,
        emailVerified: false,
        isActive: false,
      });

      const otpCode = generateOTP();
      const ttlMs = 5 * 60 * 1000;

      await OTP.create({
        userId: user.id,
        email,
        otp: String(otpCode),
        type: "registration",
        isUsed: false,
        attempts: 0,
        expiresAt: new Date(Date.now() + ttlMs),
        lastSentAt: new Date(),
        resendCount: 0,
      });

      const emailResult = await sendOTPEmail(email, otpCode, "registration");
      if (!emailResult.success) {
        return bad(
          res,
          "Không thể gửi email xác thực. Vui lòng thử lại sau.",
          {},
          500
        );
      }

      return res.status(201).json({
        success: true,
        message:
          "Đăng ký thành công. Vui lòng kiểm tra email để lấy mã OTP xác thực.",
        email,
        userId: user.id,
      });
    } catch (error) {
      console.error("register error:", error);
      return bad(res, "Lỗi server", { error: error.message }, 500);
    }
  }
);

/* ---------------------- LOGIN ---------------------- */
router.post(
  "/login",
  [
    body("email").isEmail().withMessage("Vui lòng nhập email hợp lệ"),
    body("password").notEmpty().withMessage("Vui lòng nhập mật khẩu"),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return bad(res, "Dữ liệu không hợp lệ", { errors: errors.array() });
      }

      const { email, password } = req.body;
      const user = await User.findOne({ where: { email } });
      if (!user) return bad(res, "Email hoặc mật khẩu không đúng", {}, 401);
      if (!user.isActive)
        return bad(res, "Tài khoản đã bị vô hiệu hóa", {}, 401);
      if (!user.emailVerified)
        return bad(
          res,
          "Tài khoản chưa được xác thực. Vui lòng kiểm tra email để xác thực tài khoản.",
          {},
          401
        );

      const okPassword = await user.comparePassword(password);
      if (!okPassword)
        return bad(res, "Email hoặc mật khẩu không đúng", {}, 401);

      const token = generateToken(user.id);
      // Gắn cookie JWT để FE không cần tự set header Authorization
      res.cookie("auth", token, cookieOptions(req));
      return ok(res, {
        message: "Đăng nhập thành công",
        token,
        user: {
          id: user.id,
          name: user.fullName,        // giữ trường cũ
          fullName: user.fullName,    // thêm cho nhất quán
          email: user.email,
          phone: user.phone,
          emailVerified: user.emailVerified,
          avatarUrl: makeAvatarUrl(req, user.avatarUrl || user.avatar || user.avatarPath),
        },
      });
    } catch (error) {
      console.error("login error:", error);
      return bad(res, "Lỗi server", { error: error.message }, 500);
    }
  }
);

/* ---------------------- LOGOUT ---------------------- */
router.post("/logout", auth, async (req, res) => {
  try {
    // Xóa cookie JWT phía client
    res.clearCookie("auth", { ...cookieOptions(req), maxAge: undefined });
    return ok(res, { message: "Đăng xuất thành công" });
  } catch (error) {
    console.error("logout error:", error);
    return bad(res, "Lỗi server", { error: error.message }, 500);
  }
});

/* ---------------------- FORGOT PASSWORD (send OTP) ---------------------- */
router.post(
  "/forgot-password",
  [body("email").isEmail().withMessage("Vui lòng nhập email hợp lệ")],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return bad(res, "Dữ liệu không hợp lệ", { errors: errors.array() });
      }

      const { email } = req.body;
      const user = await User.findOne({ where: { email } });
      if (!user)
        return bad(res, "Không tìm thấy tài khoản với email này", {}, 404);

      await OTP.update(
        { isUsed: true },
        { where: { email, type: "password_reset", isUsed: false } }
      );

      const otpCode = generateOTP();
      const ttlMs = 5 * 60 * 1000;
      await OTP.create({
        userId: user.id,
        email,
        otp: String(otpCode),
        type: "password_reset",
        isUsed: false,
        attempts: 0,
        expiresAt: new Date(Date.now() + ttlMs),
        lastSentAt: new Date(),
        resendCount: 0,
      });

      const sent = await sendOTPEmail(email, otpCode, "password_reset");
      if (!sent.success) {
        return bad(
          res,
          "Không thể gửi email OTP. Vui lòng thử lại sau.",
          {},
          500
        );
      }

      return ok(res, {
        message: "Đã gửi mã OTP đặt lại mật khẩu tới email của bạn.",
      });
    } catch (error) {
      console.error("forgot-password error:", error);
      return bad(res, "Lỗi server", { error: error.message }, 500);
    }
  }
);

/* -------- VERIFY RESET OTP -> cấp resetToken (10 phút) -------- */
router.post(
  "/verify-reset-otp",
  [
    body("email").isEmail().withMessage("Vui lòng nhập email hợp lệ"),
    body("otp")
      .isLength({ min: 6, max: 6 })
      .withMessage("Mã OTP phải có 6 chữ số"),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return bad(res, "Dữ liệu không hợp lệ", { errors: errors.array() });
      }

      const { email, otp } = req.body;
      const now = new Date();

      const otpRecord = await OTP.findOne({
        where: {
          email,
          otp: String(otp),
          type: "password_reset",
          isUsed: false,
          expiresAt: { [Op.gt]: now },
        },
        order: [["id", "DESC"]],
      });
      if (!otpRecord) {
        return bad(res, "Mã OTP không hợp lệ hoặc đã hết hạn");
      }

      // Đánh dấu đã dùng
      otpRecord.isUsed = true;
      otpRecord.consumedAt = now;
      await otpRecord.save();

      const user = await User.findOne({
        where: { id: otpRecord.userId, email },
      });
      if (!user) return bad(res, "Không tìm thấy tài khoản", {}, 404);

      // Cấp reset token 10 phút (KHÔNG ghi vào DB)
      const resetToken = jwt.sign(
        { id: user.id },
        process.env.JWT_SECRET || "fallback_secret",
        { expiresIn: "10m" }
      );

      return ok(res, { message: "Xác thực OTP thành công", resetToken });
    } catch (error) {
      console.error("verify-reset-otp error:", error);
      return bad(res, "Lỗi server", { error: error.message }, 500);
    }
  }
);

/* ---------------------- RESEND RESET OTP ---------------------- */
router.post(
  "/resend-reset-otp",
  [body("email").isEmail().withMessage("Vui lòng nhập email hợp lệ")],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return bad(res, "Dữ liệu không hợp lệ", { errors: errors.array() });
      }

      const { email } = req.body;
      const user = await User.findOne({ where: { email } });
      if (!user) return bad(res, "Không tìm thấy tài khoản", {}, 404);

      await OTP.update(
        { isUsed: true },
        { where: { email, type: "password_reset", isUsed: false } }
      );

      const otpCode = generateOTP();
      const ttlMs = 5 * 60 * 1000;
      await OTP.create({
        userId: user.id,
        email,
        otp: String(otpCode),
        type: "password_reset",
        isUsed: false,
        attempts: 0,
        expiresAt: new Date(Date.now() + ttlMs),
        lastSentAt: new Date(),
        resendCount: 0,
      });

      const sent = await sendOTPEmail(email, otpCode, "password_reset");
      if (!sent.success) {
        return bad(
          res,
          "Không thể gửi email OTP. Vui lòng thử lại sau.",
          {},
          500
        );
      }

      return ok(res, { message: "Đã gửi lại mã OTP đặt lại mật khẩu." });
    } catch (error) {
      console.error("resend-reset-otp error:", error);
      return bad(res, "Lỗi server", { error: error.message }, 500);
    }
  }
);

/* ---------------------- RESET PASSWORD (no DB token) ---------------------- */
router.post(
  "/reset-password",
  [
    body("token").notEmpty().withMessage("Token không hợp lệ"),
    body("password")
      .isLength({ min: 6 })
      .withMessage("Mật khẩu phải có ít nhất 6 ký tự"),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return bad(res, "Dữ liệu không hợp lệ", { errors: errors.array() });
      }

      const { token, password } = req.body;

      // 1) Verify JWT
      let decoded;
      try {
        decoded = jwt.verify(
          token,
          process.env.JWT_SECRET || "fallback_secret"
        );
      } catch (err) {
        const msg =
          err.name === "TokenExpiredError"
            ? "Token đã hết hạn. Vui lòng yêu cầu OTP mới."
            : "Token không hợp lệ.";
        return bad(res, msg);
      }

      // 2) Lấy user theo id (KHÔNG cần resetPasswordToken/Expire trong DB)
      const user = await User.findByPk(decoded.id);
      if (!user) return bad(res, "Không tìm thấy tài khoản", {}, 404);

      // 3) Cập nhật mật khẩu (hook beforeUpdate sẽ hash)
      user.passwordHash = password;
      await user.save();

      return ok(res, { message: "Mật khẩu đã được đặt lại thành công" });
    } catch (error) {
      console.error("reset-password error:", error);
      return bad(res, "Lỗi server", { error: error.message }, 500);
    }
  }
);

/* ---------------------- VERIFY REGISTER OTP ---------------------- */
router.post(
  "/verify-otp",
  [
    body("email").isEmail().withMessage("Vui lòng nhập email hợp lệ"),
    body("otp")
      .isLength({ min: 6, max: 6 })
      .withMessage("Mã OTP phải có 6 chữ số"),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return bad(res, "Dữ liệu không hợp lệ", { errors: errors.array() });
      }

      const { email, otp } = req.body;
      const now = new Date();

      const otpRecord = await OTP.findOne({
        where: {
          email,
          otp: String(otp),
          type: "registration",
          isUsed: false,
          expiresAt: { [Op.gt]: now },
        },
        order: [["id", "DESC"]],
      });

      if (!otpRecord) {
        return bad(res, "Mã OTP không hợp lệ hoặc đã hết hạn");
      }

      otpRecord.isUsed = true;
      otpRecord.consumedAt = now;
      await otpRecord.save();

      const user = await User.findOne({
        where: { id: otpRecord.userId, email },
      });
      if (!user)
        return bad(res, "Không tìm thấy tài khoản cần xác thực", {}, 404);

      if (!user.emailVerified) {
        user.emailVerified = true;
        user.isActive = true;
        await user.save();
      }

      const token = generateToken(user.id);
      // Gắn cookie JWT để FE không cần tự set header Authorization
      res.cookie("auth", token, {
        httpOnly: true,
        sameSite: "lax",
        secure: false, // CHỈ bật true khi deploy HTTPS
        path: "/", // quan trọng: để mọi /api/* đều gửi cookie
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });
      return ok(res, {
        message: "Xác thực tài khoản thành công",
        token,
        user: {
          id: user.id,
          name: user.fullName,
          fullName: user.fullName,
          email: user.email,
          phone: user.phone,
          emailVerified: user.emailVerified,
          avatarUrl: makeAvatarUrl(req, user.avatarUrl || user.avatar || user.avatarPath),
        },
      });
    } catch (error) {
      console.error("verify-otp error:", error);
      return bad(res, "Lỗi server", { error: error.message }, 500);
    }
  }
);

/* ---------------------- CURRENT USER ---------------------- */
router.get("/me", auth, async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id);
    return ok(res, {
      user: {
        id: user.id,
        name: user.fullName,
        fullName: user.fullName,
        email: user.email,
        phone: user.phone,
        emailVerified: user.emailVerified,
        avatarUrl: makeAvatarUrl(req, user.avatarUrl || user.avatar || user.avatarPath),
      },
    });
  } catch (error) {
    console.error("me error:", error);
    return bad(res, "Lỗi server", { error: error.message }, 500);
  }
});

module.exports = router;
