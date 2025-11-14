const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { body, validationResult } = require('express-validator');
const File = require('../models/File');
const auth = require('../middleware/auth');

const router = express.Router();

// Create uploads directory if it doesn't exist
const uploadDir = 'uploads';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure multer for file upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const fileFilter = (req, file, cb) => {
  // Allow only PDF and DOCX files
  const allowedTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Chỉ cho phép tải lên file PDF và DOCX'), false);
  }
};

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: fileFilter
});

// PM06: Upload print file (Tải lên tệp in)
router.post('/upload', auth, upload.single('file'), [
  body('copies').optional().isInt({ min: 1, max: 10 }).withMessage('Số bản in phải từ 1 đến 10'),
  body('color').optional().isIn(['color', 'black-white']).withMessage('Loại màu không hợp lệ'),
  body('paperSize').optional().isIn(['A4', 'A3', 'Letter']).withMessage('Kích thước giấy không hợp lệ'),
  body('orientation').optional().isIn(['portrait', 'landscape']).withMessage('Hướng giấy không hợp lệ')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Dữ liệu không hợp lệ',
        errors: errors.array()
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng chọn file để tải lên'
      });
    }

    const { copies = 1, color = 'black-white', paperSize = 'A4', orientation = 'portrait', notes } = req.body;

    // Create file record
    const fileRecord = await File.create({
      user: req.user.id,
      originalName: req.file.originalname,
      fileName: req.file.filename,
      filePath: req.file.path,
      fileSize: req.file.size,
      fileType: req.file.mimetype,
      printSettings: {
        copies: parseInt(copies),
        color,
        paperSize,
        orientation
      },
      notes: notes || ''
    });

    res.status(201).json({
      success: true,
      message: 'Tải lên file thành công',
      file: {
        id: fileRecord._id,
        originalName: fileRecord.originalName,
        fileSize: fileRecord.fileSize,
        fileType: fileRecord.fileType,
        status: fileRecord.status,
        printSettings: fileRecord.printSettings,
        notes: fileRecord.notes,
        uploadedAt: fileRecord.createdAt
      }
    });
  } catch (error) {
    // Delete uploaded file if database operation fails
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    
    res.status(500).json({
      success: false,
      message: 'Lỗi server',
      error: error.message
    });
  }
});

// Get user's files
router.get('/my-files', auth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const files = await File.find({ user: req.user.id })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await File.countDocuments({ user: req.user.id });

    res.json({
      success: true,
      files: files.map(file => ({
        id: file._id,
        originalName: file.originalName,
        fileSize: file.fileSize,
        fileType: file.fileType,
        status: file.status,
        printSettings: file.printSettings,
        notes: file.notes,
        uploadedAt: file.createdAt,
        updatedAt: file.updatedAt
      })),
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalFiles: total,
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Lỗi server',
      error: error.message
    });
  }
});

// Get single file
router.get('/:id', auth, async (req, res) => {
  try {
    const file = await File.findOne({ _id: req.params.id, user: req.user.id });
    
    if (!file) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy file'
      });
    }

    res.json({
      success: true,
      file: {
        id: file._id,
        originalName: file.originalName,
        fileSize: file.fileSize,
        fileType: file.fileType,
        status: file.status,
        printSettings: file.printSettings,
        notes: file.notes,
        uploadedAt: file.createdAt,
        updatedAt: file.updatedAt
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Lỗi server',
      error: error.message
    });
  }
});

// Update file settings
router.put('/:id', auth, [
  body('copies').optional().isInt({ min: 1, max: 10 }).withMessage('Số bản in phải từ 1 đến 10'),
  body('color').optional().isIn(['color', 'black-white']).withMessage('Loại màu không hợp lệ'),
  body('paperSize').optional().isIn(['A4', 'A3', 'Letter']).withMessage('Kích thước giấy không hợp lệ'),
  body('orientation').optional().isIn(['portrait', 'landscape']).withMessage('Hướng giấy không hợp lệ')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Dữ liệu không hợp lệ',
        errors: errors.array()
      });
    }

    const { copies, color, paperSize, orientation, notes } = req.body;
    const updateData = {};

    if (copies !== undefined) updateData['printSettings.copies'] = parseInt(copies);
    if (color) updateData['printSettings.color'] = color;
    if (paperSize) updateData['printSettings.paperSize'] = paperSize;
    if (orientation) updateData['printSettings.orientation'] = orientation;
    if (notes !== undefined) updateData.notes = notes;

    const file = await File.findOneAndUpdate(
      { _id: req.params.id, user: req.user.id },
      updateData,
      { new: true }
    );

    if (!file) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy file'
      });
    }

    res.json({
      success: true,
      message: 'Cập nhật file thành công',
      file: {
        id: file._id,
        originalName: file.originalName,
        printSettings: file.printSettings,
        notes: file.notes
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Lỗi server',
      error: error.message
    });
  }
});

// Delete file
router.delete('/:id', auth, async (req, res) => {
  try {
    const file = await File.findOne({ _id: req.params.id, user: req.user.id });
    
    if (!file) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy file'
      });
    }

    // Delete physical file
    if (fs.existsSync(file.filePath)) {
      fs.unlinkSync(file.filePath);
    }

    // Delete database record
    await File.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: 'Xóa file thành công'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Lỗi server',
      error: error.message
    });
  }
});

module.exports = router;
