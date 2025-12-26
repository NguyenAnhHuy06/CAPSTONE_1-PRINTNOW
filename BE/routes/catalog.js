// BE/routes/catalog.js
const express = require('express');
const { Op } = require("sequelize");
const {
    PaperSize,
    ColorMode,
    Side,
    PriceRule,
} = require("../models");
const auth = require("../middleware/auth");

const router = express.Router();

// ===== Quyền truy cập: admin/staff/owner (theo email env hoặc role nếu có) =====
function isPrivileged(user) {
    if (!user) return false;

    // role (nếu sau này bạn có)
    const role = String(user.role || user.roleCode || "").toLowerCase();
    if (role === "admin" || role === "staff" || role === "owner") return true;

    // email fallback (đang là chính với auth.js hiện tại)
    const email = String(user.email || "").trim().toLowerCase();
    const ADMIN_EMAIL = String(process.env.ADMIN_EMAIL || "").trim().toLowerCase();
    const STAFF_EMAIL = String(process.env.STAFF_EMAIL || "").trim().toLowerCase();
    const OWNER_EMAIL = String(process.env.OWNER_EMAIL || "").trim().toLowerCase();

    return (
        (!!ADMIN_EMAIL && email === ADMIN_EMAIL) ||
        (!!STAFF_EMAIL && email === STAFF_EMAIL) ||
        (!!OWNER_EMAIL && email === OWNER_EMAIL)
    );
}


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

        const includeInactive =
            String(req.query.includeInactive || "0").trim() === "1";

        const whereClause = {};
        if (!includeInactive) whereClause.isActive = true;

        if (paperSizeId) whereClause.paperSizeId = paperSizeId;
        if (colorModeId) whereClause.colorModeId = colorModeId;
        if (sideId) whereClause.sideId = sideId;

        const priceRules = await PriceRule.findAll({
            where: whereClause,
            include: [
                { model: PaperSize, as: 'paperSize', attributes: ['id', 'code', 'name'] },
                { model: ColorMode, as: 'colorMode', attributes: ['id', 'code', 'description'] },
                { model: Side, as: 'side', attributes: ['id', 'code', 'description'] },
            ],
            order: [
                [{ model: PaperSize, as: 'paperSize' }, 'code', 'ASC'],
                [{ model: ColorMode, as: 'colorMode' }, 'code', 'ASC'],
                [{ model: Side, as: 'side' }, 'code', 'ASC'],
                ['basePricePerPage', 'ASC'],
            ],
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

        // Tìm quy tắc giá phù hợp nhất:
        // - rule có minPages <= pages và minQty <= quantity
        // - ưu tiên minPages lớn hơn, rồi minQty lớn hơn (match sát nhất)
        const priceRule = await PriceRule.findOne({
            where: {
                paperSizeId,
                colorModeId,
                sideId,
                isActive: true,
                minPages: { [Op.lte]: Number(pages) },
                minQty: { [Op.lte]: Number(quantity) },
            },
            order: [
                ["minPages", "DESC"],
                ["minQty", "DESC"],
                ["basePricePerPage", "ASC"],
            ],
        });

        if (!priceRule) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy quy tắc giá phù hợp'
            });
        }

        // Tính giá
        const unitPrice = Number(priceRule.basePricePerPage);
        const lineTotal = unitPrice * Number(pages) * Number(quantity);

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

// ===== OWNER/STAFF: Cập nhật 1 rule giá =====
// PATCH /api/catalog/price-rules/:id
router.patch("/price-rules/:id", auth, async (req, res) => {
    try {
        if (!isPrivileged(req.user)) {
            return res.status(403).json({ success: false, message: "Forbidden" });
        }

        const id = Number(req.params.id);
        if (!id) return res.status(400).json({ success: false, message: "INVALID_ID" });

        const allow = ["basePricePerPage", "minPages", "minQty", "isActive", "pricingScope"];
        const patch = {};
        for (const k of allow) {
            if (typeof req.body?.[k] !== "undefined") patch[k] = req.body[k];
        }

        // Validate nhẹ
        if (typeof patch.basePricePerPage !== "undefined") {
            const v = Number(String(patch.basePricePerPage).replace(/,/g, ""));
            if (!Number.isFinite(v) || v < 0) {
                return res.status(400).json({ success: false, message: "INVALID_BASE_PRICE" });
            }
            patch.basePricePerPage = v;
        }
        if (typeof patch.minPages !== "undefined") {
            const v = Number(patch.minPages);
            if (!Number.isFinite(v) || v < 1) {
                return res.status(400).json({ success: false, message: "INVALID_MIN_PAGES" });
            }
            patch.minPages = v;
        }

        if (typeof patch.minQty !== "undefined") {
            const v = Number(patch.minQty);
            if (!Number.isFinite(v) || v < 1) {
                return res.status(400).json({ success: false, message: "INVALID_MIN_QTY" });
            }
            patch.minQty = v;
        }

        const rule = await PriceRule.findByPk(id);
        if (!rule) return res.status(404).json({ success: false, message: "RULE_NOT_FOUND" });

        await rule.update(patch);
        return res.json({ success: true, priceRule: rule });
    } catch (e) {
        console.error("PATCH /catalog/price-rules/:id error:", e);
        return res.status(500).json({ success: false, message: "Lỗi server" });
    }
});

module.exports = router;
