// routes/profile.js
const router = require("express").Router();
const auth = require("../middleware/auth");
const upload = require("../middleware/upload");
const { body } = require("express-validator");
const { updateProfileRules } = require("../middleware/validators");
const ctrl = require("../controllers/profile.controller");

// Profile
router.get("/me", auth, ctrl.getMyProfile);
router.put("/me", auth, updateProfileRules, ctrl.updateMyProfile);
// đảm bảo form field là "avatar" như FE đang gửi
router.put("/avatar", auth, upload.single("avatar"), ctrl.updateMyAvatar);
router.get("/activity", auth, ctrl.getMyActivity); // + Realtime stats

// Change password (đưa tạm ở đây cho nhanh)
router.put(
  "/change-password",
  auth,
  [
    body("currentPassword")
      .notEmpty()
      .withMessage("Vui lòng nhập mật khẩu hiện tại"),
    body("newPassword")
      .isLength({ min: 6 })
      .withMessage("Mật khẩu mới phải có ít nhất 6 ký tự"),
  ],
  async (req, res) => {
    try {
      const { validationResult } = require("express-validator");
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }
      const { User } = require("../models");
      const user = await User.findByPk(req.user.id);
      if (!user)
        return res
          .status(404)
          .json({ success: false, message: "USER_NOT_FOUND" });

      const ok = await user.comparePassword(req.body.currentPassword);
      if (!ok)
        return res
          .status(400)
          .json({ success: false, message: "Mật khẩu hiện tại không đúng" });

      user.passwordHash = req.body.newPassword; // sẽ được hash tại hook beforeUpdate
      await user.save();

      res.json({ success: true, message: "Đổi mật khẩu thành công" });
    } catch (e) {
      console.error(e);
      res
        .status(500)
        .json({ success: false, message: "CHANGE_PASSWORD_FAILED" });
    }
  }
);

module.exports = router;
