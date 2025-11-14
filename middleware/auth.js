// cap1/middleware/auth.js
const jwt = require("jsonwebtoken");
const User = require("../models/User");

const auth = async (req, res, next) => {
  try {
    const token =
      req.header("Authorization")?.replace("Bearer ", "") || req.cookies?.auth; // <--- đọc từ cookie 'auth' nếu không có header

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Không có token, truy cập bị từ chối",
      });
    }

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || "fallback_secret"
    );
    const user = await User.findByPk(decoded.id);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Token không hợp lệ",
      });
    }

    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message: "Tài khoản đã bị vô hiệu hóa",
      });
    }

    if (!user.emailVerified) {
      return res.status(401).json({
        success: false,
        message:
          "Tài khoản chưa được xác thực. Vui lòng kiểm tra email để xác thực tài khoản.",
      });
    }

    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({
      success: false,
      message: "Token không hợp lệ",
    });
  }
};

module.exports = auth;
