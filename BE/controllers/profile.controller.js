// controllers/profile.controller.js
// Controller for managing user profiles
const { validationResult } = require("express-validator");
const { Op } = require("sequelize"); // For advanced querying
const { User, Order } = require("../models"); // Import User and Order models

exports.getMyProfile = async (req, res) => {
  try {
    const u = await User.findByPk(req.user.id, {
      attributes: [
        "id",
        "fullName",
        "email",
        "phone",
        "address",
        "avatarUrl",
        "externalUid",
        "isActive",
        "emailVerified",
        "createdAt",
        "updatedAt",
      ],
    });
    if (!u)
      return res
        .status(404)
        .json({ success: false, message: "USER_NOT_FOUND" });
    res.json({ success: true, user: u });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, message: "GET_PROFILE_FAILED" });
  }
};

// + Realtime activity stats
exports.getMyActivity = async (req, res) => {
  try {
    const userId = req.user.id;
    const base = { customerId: userId }; // đúng cột trong bảng orders

    const [totalOrders, completed, cancelled, inProgress] = await Promise.all([
      Order.count({ where: base }),
      Order.count({ where: { ...base, status: "completed" } }),
      Order.count({ where: { ...base, status: "cancelled" } }),
      Order.count({
        where: {
          ...base,
          status: { [Op.in]: ["NEW", "pending", "processing", "ready"] },
        },
      }),
    ]);

    return res.json({
      success: true,
      stats: { totalOrders, completed, inProgress, cancelled },
    });
  } catch (e) {
    console.error(e);
    return res
      .status(500)
      .json({ success: false, message: "GET_ACTIVITY_FAILED" });
  }
};

exports.updateMyProfile = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty())
    return res.status(400).json({ success: false, errors: errors.array() });

  try {
    const u = await User.findByPk(req.user.id);
    if (!u)
      return res
        .status(404)
        .json({ success: false, message: "USER_NOT_FOUND" });

    const { fullName, phone, email, address } = req.body;

    if (fullName !== undefined) u.fullName = (fullName ?? "").trim();
    if (phone !== undefined) u.phone = (phone ?? "").trim();
    if (email !== undefined) u.email = (email ?? "").trim();
    if (address !== undefined) u.address = (address ?? "").trim() || null;

    await u.save();

    res.json({
      success: true,
      user: {
        id: u.id,
        fullName: u.fullName,
        email: u.email,
        phone: u.phone,
        address: u.address,
        avatarUrl: u.avatarUrl,
        externalUid: u.externalUid,
        isActive: u.isActive,
        emailVerified: u.emailVerified,
        createdAt: u.createdAt,
        updatedAt: u.updatedAt,
      },
    });
  } catch (e) {
    console.error(e);
    if (e.name === "SequelizeUniqueConstraintError") {
      return res
        .status(409)
        .json({ success: false, message: "EMAIL_ALREADY_EXISTS" });
    }
    res.status(500).json({ success: false, message: "UPDATE_PROFILE_FAILED" });
  }
};

exports.updateMyAvatar = async (req, res) => {
  try {
    if (!req.file)
      return res.status(400).json({ success: false, message: "NO_FILE" });
    const u = await User.findByPk(req.user.id);
    if (!u)
      return res
        .status(404)
        .json({ success: false, message: "USER_NOT_FOUND" });

    u.avatarUrl = `/uploads/avatars/${req.file.filename}`;
    await u.save();

    res.json({ success: true, avatarUrl: u.avatarUrl });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, message: "UPDATE_AVATAR_FAILED" });
  }
};
