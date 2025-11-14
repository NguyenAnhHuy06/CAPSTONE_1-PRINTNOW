const express = require('express');
const PaperSize = require('../models/PaperSize');
const ColorMode = require('../models/ColorMode');
const Side = require('../models/Side');
const PriceRule = require('../models/PriceRule');

const router = express.Router();

// Lấy danh sách kích thước giấy
router.get('/paper-sizes', async (req, res) => {
    try {
        const paperSizes = await PaperSize.findAll({
            where: { isActive: true },
            order: [['name', 'ASC']]
        });

        res.json({
            success: true,
            paperSizes
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Lỗi server',
            error: error.message
        });
    }
});

// Lấy danh sách chế độ màu
router.get('/color-modes', async (req, res) => {
    try {
        const colorModes = await ColorMode.findAll({
            where: { isActive: true },
            order: [['description', 'ASC']]
        });

        res.json({
            success: true,
            colorModes
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Lỗi server',
            error: error.message
        });
    }
});

// Lấy danh sách chế độ in
router.get('/sides', async (req, res) => {
    try {
        const sides = await Side.findAll({
            where: { isActive: true },
            order: [['description', 'ASC']]
        });

        res.json({
            success: true,
            sides
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Lỗi server',
            error: error.message
        });
    }
});

// Lấy quy tắc giá
router.get('/price-rules', async (req, res) => {
    try {
        const { paperSizeId, colorModeId, sideId } = req.query;

        const whereClause = { isActive: true };
        if (paperSizeId) whereClause.paperSizeId = paperSizeId;
        if (colorModeId) whereClause.colorModeId = colorModeId;
        if (sideId) whereClause.sideId = sideId;

        const priceRules = await PriceRule.findAll({
            where: whereClause,
            order: [['basePricePerPage', 'ASC']]
        });

        res.json({
            success: true,
            priceRules
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Lỗi server',
            error: error.message
        });
    }
});

// Tính giá cho một item
router.post('/calculate-price', async (req, res) => {
    try {
        const { paperSizeId, colorModeId, sideId, pages, quantity } = req.body;

        if (!paperSizeId || !colorModeId || !sideId || !pages || !quantity) {
            return res.status(400).json({
                success: false,
                message: 'Thiếu thông tin cần thiết'
            });
        }

        // Tìm quy tắc giá phù hợp
        const priceRule = await PriceRule.findOne({
            where: {
                paperSizeId,
                colorModeId,
                sideId,
                isActive: true
            },
            order: [['basePricePerPage', 'ASC']]
        });

        if (!priceRule) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy quy tắc giá phù hợp'
            });
        }

        // Tính giá
        const unitPrice = priceRule.basePricePerPage;
        const lineTotal = unitPrice * pages * quantity;

        res.json({
            success: true,
            calculation: {
                unitPrice,
                pages,
                quantity,
                lineTotal,
                priceRule: {
                    id: priceRule.id,
                    minPages: priceRule.minPages,
                    minQty: priceRule.minQty,
                    basePricePerPage: priceRule.basePricePerPage
                }
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

// Lấy tất cả danh mục
router.get('/all', async (req, res) => {
    try {
        const [paperSizes, colorModes, sides] = await Promise.all([
            PaperSize.findAll({ where: { isActive: true }, order: [['name', 'ASC']] }),
            ColorMode.findAll({ where: { isActive: true }, order: [['description', 'ASC']] }),
            Side.findAll({ where: { isActive: true }, order: [['description', 'ASC']] })
        ]);

        res.json({
            success: true,
            catalog: {
                paperSizes,
                colorModes,
                sides
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

module.exports = router;
