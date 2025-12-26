// middleware/uploadPrintFile.js
// Middleware for handling print file uploads using multer
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const PRINT_FILES_DIR = path.join(__dirname, "..", "uploads", "print-files");
fs.mkdirSync(PRINT_FILES_DIR, { recursive: true });

const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, PRINT_FILES_DIR),
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname || "").toLowerCase();
        const userId = req.user?.id || "anonymous";
        const timestamp = Date.now();
        const random = Math.round(Math.random() * 1E9);
        const name = `print_${userId}_${timestamp}_${random}${ext}`;
        cb(null, name);
    },
});

const fileFilter = (_req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase();
    const allowedExts = [
        // Documents
        ".pdf", ".doc", ".docx", ".ppt", ".pptx", ".xls", ".xlsx",
        // Images
        ".jpg", ".jpeg", ".png", ".gif", ".bmp", ".webp", ".tiff", ".tif"
    ];
    const allowedMimes = [
        // Documents
        "application/pdf",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/vnd.ms-powerpoint",
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "application/vnd.ms-excel",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        // Images
        "image/jpeg", "image/jpg", "image/png", "image/gif", "image/bmp",
        "image/webp", "image/tiff", "image/tif"
    ];

    const ok = allowedExts.includes(ext) || allowedMimes.includes(file.mimetype);
    if (!ok) {
        return cb(new Error("Chỉ cho phép file PDF, DOC, DOCX, PPT, PPTX, XLS, XLSX hoặc hình ảnh (JPG, PNG, GIF, etc.)"), false);
    }
    cb(null, true);
};

module.exports = multer({
    storage,
    fileFilter,
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
});

