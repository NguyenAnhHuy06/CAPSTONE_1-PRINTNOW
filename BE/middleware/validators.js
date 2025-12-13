// middleware/validators.js
// Validation middleware for user settings and profile updates
const { body } = require("express-validator");

exports.updateSettingsRules = [
  body("language")
    .optional()
    .isIn(["en", "vi"])
    .withMessage("language must be en|vi"),
  body("notifyEmail")
    .optional()
    .isBoolean()
    .withMessage("notifyEmail must be boolean")
    .toBoolean(),
  body("notifySms")
    .optional()
    .isBoolean()
    .withMessage("notifySms must be boolean")
    .toBoolean(),
];

exports.updateProfileRules = [
  body("fullName")
    .optional()
    .isLength({ min: 1, max: 255 })
    .withMessage("fullName invalid"),
  body("phone")
    .optional()
    .matches(/^[0-9]{10,11}$/)
    .withMessage("phone must be 10-11 digits"),
  body("email").optional().isEmail().withMessage("email invalid"),
  body('address').optional().isLength({ max: 255 }).withMessage('Địa chỉ không được vượt quá 255 ký tự'),
];
