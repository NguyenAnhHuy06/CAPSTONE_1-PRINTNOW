// middleware/upload.js
// Middleware for handling avatar uploads using multer
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const AVATAR_DIR = path.join(__dirname, "..", "uploads", "avatars");
fs.mkdirSync(AVATAR_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, AVATAR_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase();
    const name = `u${req.user?.id || "x"}_${Date.now()}${ext}`;
    cb(null, name);
  },
});

const fileFilter = (_req, file, cb) => {
  const ok = [".png", ".jpg", ".jpeg", ".gif", ".webp"].includes(
    path.extname(file.originalname || "").toLowerCase()
  );
  cb(null, ok);
};

module.exports = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});
