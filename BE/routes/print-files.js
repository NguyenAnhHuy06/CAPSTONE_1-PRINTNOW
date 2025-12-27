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

// Đảm bảo thư mục upload tồn tại
const PRINT_FILES_DIR = path.join(__dirname, "..", "uploads", "print-files");
if (!fs.existsSync(PRINT_FILES_DIR)) {
    fs.mkdirSync(PRINT_FILES_DIR, { recursive: true });
    console.log("[PRINT-FILES] Đã tạo thư mục upload:", PRINT_FILES_DIR);
}

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

        // Log thông tin file upload
        console.log("[UPLOAD] File received:", {
            originalName: req.file.originalname,
            filename: req.file.filename,
            path: req.file.path,
            size: req.file.size,
            mimetype: req.file.mimetype,
            exists: fs.existsSync(req.file.path),
        });

        const ownerId = req.user?.id;
        if (!ownerId) {
            // Xóa file đã upload nếu không có user
            if (fs.existsSync(req.file.path)) {
                console.log("[UPLOAD] Deleting file due to unauthorized:", req.file.path);
                fs.unlinkSync(req.file.path);
            }
            return res.status(401).json({
                success: false,
                message: "UNAUTHORIZED",
            });
        }

        // Kiểm tra file có tồn tại sau khi upload không
        if (!fs.existsSync(req.file.path)) {
            console.error("[UPLOAD] ERROR: File không tồn tại sau khi upload:", req.file.path);
            console.error("[UPLOAD] Multer destination:", PRINT_FILES_DIR);
            console.error("[UPLOAD] Checking directory:", fs.existsSync(PRINT_FILES_DIR));
            
            // Thử tạo lại thư mục nếu không tồn tại
            if (!fs.existsSync(PRINT_FILES_DIR)) {
                fs.mkdirSync(PRINT_FILES_DIR, { recursive: true });
                console.log("[UPLOAD] Đã tạo lại thư mục:", PRINT_FILES_DIR);
            }
            
            return res.status(500).json({
                success: false,
                message: "File không được lưu thành công. Vui lòng thử lại.",
            });
        }

        // Đảm bảo file thực sự tồn tại và có kích thước > 0
        const fileStats = fs.statSync(req.file.path);
        if (fileStats.size === 0) {
            console.error("[UPLOAD] ERROR: File có kích thước 0:", req.file.path);
            fs.unlinkSync(req.file.path); // Xóa file rỗng
            return res.status(500).json({
                success: false,
                message: "File upload không hợp lệ (kích thước 0)",
            });
        }

        console.log("[UPLOAD] ✅ File đã được lưu trên disk:", {
            path: req.file.path,
            size: fileStats.size,
            sizeKB: (fileStats.size / 1024).toFixed(2) + " KB",
        });

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

        // Log thông tin trước khi lưu DB
        console.log("[UPLOAD] Saving to database:", {
            storageKey,
            storageUrl,
            filePath: req.file.path,
            fileExists: fs.existsSync(req.file.path),
        });

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

        // Kiểm tra lại file sau khi lưu DB
        if (!fs.existsSync(req.file.path)) {
            console.error("[UPLOAD] WARNING: File bị mất sau khi lưu DB:", req.file.path);
            // Đánh dấu file là deleted vì không tìm thấy trên disk
            await fileRecord.update({ isDeleted: true });
            return res.status(500).json({
                success: false,
                message: "File không tồn tại sau khi lưu",
            });
        }

        console.log("[UPLOAD] ✅ File uploaded successfully:", {
            id: fileRecord.id,
            path: req.file.path,
            exists: fs.existsSync(req.file.path),
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

// GET /api/print-files/download/:id
// Download file với authentication và kiểm tra quyền
// Phải đặt TRƯỚC route /:id để tránh conflict
router.get("/download/:id", auth, async (req, res) => {
    try {
        const fileId = Number(req.params.id);
        const userId = req.user?.id;

        // Lấy thông tin file từ database
        const file = await File.findOne({
            where: {
                id: fileId,
                isDeleted: false,
            },
        });

        if (!file) {
            return res.status(404).json({
                success: false,
                message: "Không tìm thấy file",
            });
        }

        // Kiểm tra quyền: owner của file, owner của order, hoặc staff/admin/owner
        const isOwner = file.ownerId === userId;
        const isPrivileged = ["admin", "staff", "owner"].includes(
            String(req.user?.role || "").toLowerCase()
        );
        
        let hasOrderAccess = false;
        if (file.orderId) {
            // Kiểm tra xem user có phải là customer của order này không
            const { Order } = require("../models");
            const order = await Order.findOne({
                where: { id: file.orderId },
                attributes: ["customerId"],
            });
            hasOrderAccess = order && order.customerId === userId;
        }

        if (!isOwner && !isPrivileged && !hasOrderAccess) {
            return res.status(403).json({
                success: false,
                message: "Bạn không có quyền truy cập file này",
            });
        }

        // Tìm file thực tế trên disk
        // File được lưu ở: BE/uploads/print-files/filename
        let filePath = null;
        const attemptedPaths = [];

        // Ưu tiên 1: Dùng storageKey (relative path từ BE folder, đã normalize)
        if (file.storageKey) {
            // Normalize path separators (Windows có thể dùng \)
            const normalizedKey = file.storageKey.replace(/\\/g, "/");
            const keyPath = path.resolve(path.join(__dirname, "..", normalizedKey));
            attemptedPaths.push(keyPath);
            if (fs.existsSync(keyPath)) {
                filePath = keyPath;
            }
        }

        // Ưu tiên 2: Từ storageUrl, extract filename và tìm trong BE/uploads/print-files
        if (!filePath && file.storageUrl) {
            // storageUrl có dạng: /uploads/print-files/filename
            const filename = path.basename(file.storageUrl);
            const bePrintFilesPath = path.resolve(path.join(__dirname, "..", "uploads", "print-files", filename));
            attemptedPaths.push(bePrintFilesPath);
            if (fs.existsSync(bePrintFilesPath)) {
                filePath = bePrintFilesPath;
            }
        }

        // Ưu tiên 3: Thử tìm trong root uploads (nếu có)
        if (!filePath && file.storageUrl) {
            const filename = path.basename(file.storageUrl);
            const rootPrintFilesPath = path.resolve(path.join(__dirname, "..", "..", "uploads", "print-files", filename));
            attemptedPaths.push(rootPrintFilesPath);
            if (fs.existsSync(rootPrintFilesPath)) {
                filePath = rootPrintFilesPath;
            }
        }

        if (!filePath || !fs.existsSync(filePath)) {
            const bePrintFilesDir = path.resolve(path.join(__dirname, "..", "uploads", "print-files"));
            const dirExists = fs.existsSync(bePrintFilesDir);
            const dirContents = dirExists ? fs.readdirSync(bePrintFilesDir).slice(0, 10) : [];
            
            console.error("File not found on disk:", {
                fileId,
                storageUrl: file.storageUrl,
                storageKey: file.storageKey,
                attemptedPaths,
                bePrintFilesDir,
                dirExists,
                dirContents,
            });
            
            return res.status(404).json({
                success: false,
                message: "File không tồn tại trên server",
                debug: {
                    fileId,
                    storageUrl: file.storageUrl,
                    storageKey: file.storageKey,
                    attemptedPaths,
                    bePrintFilesDir,
                    dirExists,
                    dirContents,
                },
            });
        }

        // Set headers để force download (không mở trong browser)
        const encodedFilename = encodeURIComponent(file.originalName);
        res.setHeader("Content-Disposition", `attachment; filename="${encodedFilename}"; filename*=UTF-8''${encodedFilename}`);
        res.setHeader("Content-Type", file.contentType || "application/octet-stream");
        res.setHeader("Content-Length", fs.statSync(filePath).size);
        
        // Stream file về client
        return res.sendFile(path.resolve(filePath));
    } catch (error) {
        console.error("GET /api/print-files/download/:id error:", error);
        res.status(500).json({
            success: false,
            message: "Lỗi server",
            error: error.message,
        });
    }
});

// GET /api/print-files/my-files
// Lấy danh sách file của user
// Phải đặt TRƯỚC route /:id để tránh conflict
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

module.exports = router;

