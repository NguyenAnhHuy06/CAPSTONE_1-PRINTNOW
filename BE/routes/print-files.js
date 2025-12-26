// routes/print-files.js
// Route để upload file in và lưu vào bảng files
const express = require("express");
const path = require("path");
const fs = require("fs");
const auth = require("../middleware/auth");
const uploadPrintFile = require("../middleware/uploadPrintFile");
const File = require("../models/File");
const { getFileInfo, countFilePages } = require("../services/filePageCounter");

const router = express.Router();

// POST /api/print-files/upload
// Upload file in và lưu vào bảng files (chưa gắn với order)
router.post("/upload", auth, uploadPrintFile.single("file"), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: "Vui lòng chọn file để tải lên",
            });
        }

        const ownerId = req.user?.id;
        if (!ownerId) {
            // Xóa file đã upload nếu không có user
            if (fs.existsSync(req.file.path)) {
                fs.unlinkSync(req.file.path);
            }
            return res.status(401).json({
                success: false,
                message: "UNAUTHORIZED",
            });
        }

        // Đếm số trang sử dụng logic từ file-analyzer
        let pages = 0;
        const ext = path.extname(req.file.originalname).toLowerCase();
        const isImage = [".jpg", ".jpeg", ".png", ".gif", ".bmp", ".webp", ".tiff", ".tif"].includes(ext);

        if (!isImage) {
            try {
                // Sử dụng getFileInfo từ filePageCounter (giống file-analyzer)
                const fileInfo = await getFileInfo(req.file.path);
                pages = fileInfo.pageCount || 0;
            } catch (error) {
                console.warn("Không thể đếm số trang, đặt mặc định là 0:", error.message);
                pages = 0;
            }
        } else {
            // Hình ảnh: 1 "trang" mỗi file
            pages = 1;
        }

        // Tạo bản ghi file trong database
        const relativePath = path.relative(path.join(__dirname, ".."), req.file.path);
        const storageKey = relativePath.replace(/\\/g, "/"); // Normalize path separators
        const storageUrl = `/uploads/print-files/${path.basename(req.file.path)}`;

        const fileRecord = await File.create({
            ownerId,
            orderId: null, // Chưa gắn với order
            orderItemId: null, // Chưa gắn với order item
            originalName: req.file.originalname,
            contentType: req.file.mimetype,
            storageProvider: "local",
            storageKey,
            storageUrl,
            sizeBytes: req.file.size,
            pages,
            uploadedAt: new Date(),
            expiresAt: null,
            isDeleted: false,
        });

        res.status(201).json({
            success: true,
            message: "Tải lên file thành công",
            file: {
                id: fileRecord.id,
                originalName: fileRecord.originalName,
                contentType: fileRecord.contentType,
                sizeBytes: fileRecord.sizeBytes,
                pages: fileRecord.pages,
                storageUrl: fileRecord.storageUrl,
                uploadedAt: fileRecord.uploadedAt,
            },
        });
    } catch (error) {
        // Xóa file đã upload nếu lỗi
        if (req.file && fs.existsSync(req.file.path)) {
            try {
                fs.unlinkSync(req.file.path);
            } catch (unlinkError) {
                console.error("Lỗi khi xóa file:", unlinkError);
            }
        }

        console.error("POST /api/print-files/upload error:", error);
        res.status(500).json({
            success: false,
            message: "Lỗi server",
            error: error.message,
        });
    }
});

// GET /api/print-files/:id
// Lấy thông tin file theo ID
router.get("/:id", auth, async (req, res) => {
    try {
        const fileId = Number(req.params.id);
        const userId = req.user?.id;

        const file = await File.findOne({
            where: {
                id: fileId,
                ownerId: userId,
                isDeleted: false,
            },
        });

        if (!file) {
            return res.status(404).json({
                success: false,
                message: "Không tìm thấy file",
            });
        }

        res.json({
            success: true,
            file: {
                id: file.id,
                originalName: file.originalName,
                contentType: file.contentType,
                sizeBytes: file.sizeBytes,
                pages: file.pages,
                storageUrl: file.storageUrl,
                orderId: file.orderId,
                orderItemId: file.orderItemId,
                uploadedAt: file.uploadedAt,
            },
        });
    } catch (error) {
        console.error("GET /api/print-files/:id error:", error);
        res.status(500).json({
            success: false,
            message: "Lỗi server",
            error: error.message,
        });
    }
});

// GET /api/print-files/my-files
// Lấy danh sách file của user
router.get("/my-files", auth, async (req, res) => {
    try {
        const userId = req.user?.id;
        const page = parseInt(req.query.page) || 1;
        const limit = Math.min(parseInt(req.query.limit) || 10, 100);
        const offset = (page - 1) * limit;

        const { count, rows } = await File.findAndCountAll({
            where: {
                ownerId: userId,
                isDeleted: false,
            },
            order: [["uploadedAt", "DESC"]],
            limit,
            offset,
        });

        res.json({
            success: true,
            files: rows.map((file) => ({
                id: file.id,
                originalName: file.originalName,
                contentType: file.contentType,
                sizeBytes: file.sizeBytes,
                pages: file.pages,
                storageUrl: file.storageUrl,
                orderId: file.orderId,
                orderItemId: file.orderItemId,
                uploadedAt: file.uploadedAt,
            })),
            pagination: {
                page,
                limit,
                total: count,
                totalPages: Math.ceil(count / limit),
            },
        });
    } catch (error) {
        console.error("GET /api/print-files/my-files error:", error);
        res.status(500).json({
            success: false,
            message: "Lỗi server",
            error: error.message,
        });
    }
});

module.exports = router;

