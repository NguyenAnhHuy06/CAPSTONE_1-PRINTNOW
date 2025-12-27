// cap1/middleware/auth.js
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { JWT_SECRET } = require("../config/jwt");

const auth = async (req, res, next) => {
  try {
    // ✅ ƯU TIÊN Bearer token trong header (để hỗ trợ multi-role)
    // Nếu có Bearer token, bỏ qua cookie để mỗi tab có thể dùng token riêng
    const token =
      req.header("Authorization")?.replace("Bearer ", "") ||
      req.query?.token || // <--- chấp nhận token từ query cho SSE/EventSource
      req.cookies?.auth || // <--- fallback: chỉ dùng cookie nếu không có Bearer token
      null;

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Không có token, truy cập bị từ chối",
      });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
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
