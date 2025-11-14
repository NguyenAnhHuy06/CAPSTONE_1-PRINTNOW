const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { getFileInfo, countFilePages } = require('../services/filePageCounter');

const router = express.Router();

// Cấu hình multer cho upload file
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = 'uploads/temp-analysis';
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const fileFilter = (req, file, cb) => {
    // Chỉ cho phép PDF, DOC, DOCX, PPT, PPTX
    const allowedTypes = [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-powerpoint',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    ];

    if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Chỉ hỗ trợ file PDF, DOC, DOCX, PPT, PPTX'), false);
    }
};

const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB
    }
});

// API phân tích file và đếm số trang
router.post('/analyze-file', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'Vui lòng chọn file để phân tích'
            });
        }

        // Lấy thông tin chi tiết về file
        const fileInfo = await getFileInfo(req.file.path);

        // Xóa file tạm sau khi phân tích
        try {
            fs.unlinkSync(req.file.path);
        } catch (error) {
            console.warn('Không thể xóa file tạm:', error.message);
        }

        res.json({
            success: true,
            data: {
                originalName: req.file.originalname,
                fileName: req.file.filename,
                fileSize: req.file.size,
                fileType: fileInfo.fileType,
                pageCount: fileInfo.pageCount,
                lastModified: fileInfo.lastModified,
                analysis: {
                    isSupported: ['pdf', 'docx', 'doc', 'pptx', 'ppt'].includes(fileInfo.fileType),
                    estimatedAccuracy: getAccuracyLevel(fileInfo.fileType),
                    recommendations: getRecommendations(fileInfo)
                }
            }
        });
    } catch (error) {
        // Xóa file nếu có lỗi
        if (req.file && fs.existsSync(req.file.path)) {
            try {
                fs.unlinkSync(req.file.path);
            } catch (deleteError) {
                console.warn('Không thể xóa file tạm:', deleteError.message);
            }
        }

        res.status(500).json({
            success: false,
            message: 'Lỗi khi phân tích file',
            error: error.message
        });
    }
});

// API đếm số trang cho nhiều file
router.post('/analyze-multiple-files', upload.array('files', 10), async (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Vui lòng chọn ít nhất 1 file để phân tích'
            });
        }

        const results = [];
        const errors = [];

        for (const file of req.files) {
            try {
                const fileInfo = await getFileInfo(file.path);

                results.push({
                    originalName: file.originalname,
                    fileName: file.filename,
                    fileSize: file.size,
                    fileType: fileInfo.fileType,
                    pageCount: fileInfo.pageCount,
                    lastModified: fileInfo.lastModified
                });

                // Xóa file tạm
                try {
                    fs.unlinkSync(file.path);
                } catch (error) {
                    console.warn(`Không thể xóa file tạm ${file.filename}:`, error.message);
                }
            } catch (error) {
                errors.push({
                    fileName: file.originalname,
                    error: error.message
                });
            }
        }

        res.json({
            success: true,
            data: {
                totalFiles: req.files.length,
                successful: results.length,
                failed: errors.length,
                results: results,
                errors: errors,
                summary: {
                    totalPages: results.reduce((sum, file) => sum + file.pageCount, 0),
                    totalSize: results.reduce((sum, file) => sum + file.fileSize, 0),
                    fileTypes: [...new Set(results.map(file => file.fileType))]
                }
            }
        });
    } catch (error) {
        // Xóa tất cả file tạm nếu có lỗi
        if (req.files) {
            req.files.forEach(file => {
                try {
                    if (fs.existsSync(file.path)) {
                        fs.unlinkSync(file.path);
                    }
                } catch (deleteError) {
                    console.warn(`Không thể xóa file tạm ${file.filename}:`, deleteError.message);
                }
            });
        }

        res.status(500).json({
            success: false,
            message: 'Lỗi khi phân tích nhiều file',
            error: error.message
        });
    }
});

// Hàm xác định độ chính xác của việc đếm trang
const getAccuracyLevel = (fileType) => {
    const accuracyLevels = {
        'pdf': 'Cao (95-98%)',
        'docx': 'Trung bình (80-90%)',
        'doc': 'Thấp (60-70%)',
        'pptx': 'Trung bình (75-85%)',
        'ppt': 'Thấp (50-60%)'
    };

    return accuracyLevels[fileType] || 'Không xác định';
};

// Hàm đưa ra khuyến nghị
const getRecommendations = (fileInfo) => {
    const recommendations = [];

    if (fileInfo.pageCount > 100) {
        recommendations.push('File có nhiều trang, có thể mất thời gian in lâu');
    }

    if (fileInfo.fileSize > 5 * 1024 * 1024) { // > 5MB
        recommendations.push('File có kích thước lớn, nên kiểm tra chất lượng in');
    }

    if (['doc', 'ppt'].includes(fileInfo.fileType)) {
        recommendations.push('File định dạng cũ, nên chuyển đổi sang định dạng mới để đảm bảo chất lượng');
    }

    if (fileInfo.pageCount === 1) {
        recommendations.push('File chỉ có 1 trang, phù hợp cho in nhanh');
    }

    return recommendations;
};

module.exports = router;
