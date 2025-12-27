// BE/routes/catalog.js
const express = require('express');
const { Op } = require("sequelize");
const {
    PaperSize,
    ColorMode,
    Side,
    PriceRule,
    sequelize,
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
        const includeInactive = String(req.query.includeInactive || "0").trim() === "1";

        // Build WHERE clause with safe replacements
        let whereConditions = [];
        const replacements = {};
        
        if (!includeInactive) {
            whereConditions.push('pr.isActive = 1');
        }
        if (paperSizeId) {
            whereConditions.push('pr.paperSizeId = :paperSizeId');
            replacements.paperSizeId = parseInt(paperSizeId);
        }
        if (colorModeId) {
            whereConditions.push('pr.colorModeId = :colorModeId');
            replacements.colorModeId = parseInt(colorModeId);
        }
        if (sideId) {
            whereConditions.push('pr.sideId = :sideId');
            replacements.sideId = parseInt(sideId);
        }
        const whereClause = whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : '';

        // Use raw SQL with JOINs
        const query = `
            SELECT 
                pr.id,
                pr.paperSizeId,
                pr.colorModeId,
                pr.sideId,
                pr.pricingScope,
                pr.minPages,
                pr.minQty,
                pr.basePricePerPage,
                pr.isActive,
                pr.created_at,
                pr.updated_at,
                ps.code as paperSizeCode,
                ps.name as paperSizeName,
                cm.code as colorModeCode,
                cm.description as colorModeDescription,
                s.code as sideCode,
                s.description as sideDescription
            FROM price_rules pr
            LEFT JOIN paper_sizes ps ON pr.paperSizeId = ps.id
            LEFT JOIN color_modes cm ON pr.colorModeId = cm.id
            LEFT JOIN sides s ON pr.sideId = s.id
            ${whereClause}
            ORDER BY ps.code ASC, cm.code ASC, s.code ASC, pr.basePricePerPage ASC
        `;

        const [priceRulesRows] = await sequelize.query(query, {
            replacements: Object.keys(replacements).length > 0 ? replacements : undefined
        });

        // Format response to match expected structure
        const priceRules = priceRulesRows.map(row => ({
            id: row.id,
            paperSizeId: row.paperSizeId,
            colorModeId: row.colorModeId,
            sideId: row.sideId,
            pricingScope: row.pricingScope,
            minPages: row.minPages,
            minQty: row.minQty,
            basePricePerPage: parseFloat(row.basePricePerPage),
            isActive: row.isActive === 1 || row.isActive === true,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
            paperSize: row.paperSizeCode ? {
                id: row.paperSizeId,
                code: row.paperSizeCode,
                name: row.paperSizeName
            } : null,
            colorMode: row.colorModeCode ? {
                id: row.colorModeId,
                code: row.colorModeCode,
                description: row.colorModeDescription
            } : null,
            side: row.sideCode ? {
                id: row.sideId,
                code: row.sideCode,
                description: row.sideDescription
            } : null
        }));

        res.json({
            success: true,
            priceRules: priceRules || []
        });
    } catch (error) {
        console.error('Error in GET /catalog/price-rules:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi server',
            error: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
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
        // Thử query với raw SQL để tránh vấn đề mapping column names
        const [paperSizesRows] = await sequelize.query(`
            SELECT id, code, name, widthMm, heightMm, isActive, created_at, updated_at 
            FROM paper_sizes 
            WHERE isActive = 1 
            ORDER BY name ASC
        `);
        
        const [colorModesRows] = await sequelize.query(`
            SELECT id, code, description, isActive, created_at, updated_at 
            FROM color_modes 
            WHERE isActive = 1 
            ORDER BY description ASC
        `);
        
        const [sidesRows] = await sequelize.query(`
            SELECT id, code, description, isActive, created_at, updated_at 
            FROM sides 
            WHERE isActive = 1 
            ORDER BY description ASC
        `);

        res.json({
            success: true,
            catalog: {
                paperSizes: paperSizesRows || [],
                colorModes: colorModesRows || [],
                sides: sidesRows || []
            }
        });
    } catch (error) {
        console.error('Error in GET /catalog/all:', error);
        // Fallback: thử query không có điều kiện isActive
        try {
            const [paperSizesRows] = await sequelize.query(`SELECT * FROM paper_sizes ORDER BY name ASC`);
            const [colorModesRows] = await sequelize.query(`SELECT * FROM color_modes ORDER BY description ASC`);
            const [sidesRows] = await sequelize.query(`SELECT * FROM sides ORDER BY description ASC`);
            
            res.json({
                success: true,
                catalog: {
                    paperSizes: paperSizesRows || [],
                    colorModes: colorModesRows || [],
                    sides: sidesRows || []
                }
            });
        } catch (fallbackError) {
            console.error('Fallback query also failed:', fallbackError);
            res.status(500).json({
                success: false,
                message: 'Lỗi server',
                error: error.message,
                stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
            });
        }
    }
});

// ===== OWNER/STAFF: Tạo PriceRule mới =====
// POST /api/catalog/price-rules
router.post("/price-rules", auth, async (req, res) => {
    try {
        if (!isPrivileged(req.user)) {
            return res.status(403).json({ success: false, message: "Forbidden" });
        }

        const { paperSizeId, colorModeId, sideId, basePricePerPage, minPages = 1, minQty = 1, pricingScope = "GLOBAL", isActive = true } = req.body;

        if (!paperSizeId || !colorModeId || !sideId || basePricePerPage === undefined) {
            return res.status(400).json({ success: false, message: "MISSING_REQUIRED_FIELDS" });
        }

        const price = Number(String(basePricePerPage).replace(/,/g, ""));
        if (!Number.isFinite(price) || price < 0) {
            return res.status(400).json({ success: false, message: "INVALID_BASE_PRICE" });
        }

        // Use raw SQL INSERT to avoid ORM mapping issues
        const insertQuery = `
            INSERT INTO price_rules 
            (paperSizeId, colorModeId, sideId, basePricePerPage, minPages, minQty, pricingScope, isActive, created_at, updated_at)
            VALUES 
            (:paperSizeId, :colorModeId, :sideId, :basePricePerPage, :minPages, :minQty, :pricingScope, :isActive, NOW(), NOW())
        `;
        
        const [result] = await sequelize.query(insertQuery, {
            replacements: {
                paperSizeId: Number(paperSizeId),
                colorModeId: Number(colorModeId),
                sideId: Number(sideId),
                basePricePerPage: price,
                minPages: Number(minPages) || 1,
                minQty: Number(minQty) || 1,
                pricingScope: pricingScope || "GLOBAL",
                isActive: !!isActive ? 1 : 0
            }
        });

        const insertId = result.insertId;
        
        // Fetch the created rule
        const [rows] = await sequelize.query(`
            SELECT 
                pr.id,
                pr.paperSizeId,
                pr.colorModeId,
                pr.sideId,
                pr.pricingScope,
                pr.minPages,
                pr.minQty,
                pr.basePricePerPage,
                pr.isActive,
                pr.created_at,
                pr.updated_at
            FROM price_rules pr
            WHERE pr.id = :id
        `, {
            replacements: { id: insertId }
        });

        const rule = rows[0] ? {
            id: rows[0].id,
            paperSizeId: rows[0].paperSizeId,
            colorModeId: rows[0].colorModeId,
            sideId: rows[0].sideId,
            pricingScope: rows[0].pricingScope,
            minPages: rows[0].minPages,
            minQty: rows[0].minQty,
            basePricePerPage: parseFloat(rows[0].basePricePerPage),
            isActive: rows[0].isActive === 1 || rows[0].isActive === true,
            createdAt: rows[0].created_at,
            updatedAt: rows[0].updated_at
        } : null;

        return res.status(201).json({ success: true, priceRule: rule });
    } catch (e) {
        console.error("POST /catalog/price-rules error:", e);
        return res.status(500).json({ success: false, message: "Lỗi server", error: e.message });
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

        // Check if rule exists
        const [existingRows] = await sequelize.query(`
            SELECT id FROM price_rules WHERE id = :id
        `, {
            replacements: { id }
        });

        if (!existingRows || existingRows.length === 0) {
            return res.status(404).json({ success: false, message: "RULE_NOT_FOUND" });
        }

        // Build UPDATE query
        const updateFields = [];
        const replacements = { id };
        
        if (typeof patch.basePricePerPage !== "undefined") {
            updateFields.push('basePricePerPage = :basePricePerPage');
            replacements.basePricePerPage = patch.basePricePerPage;
        }
        if (typeof patch.minPages !== "undefined") {
            updateFields.push('minPages = :minPages');
            replacements.minPages = patch.minPages;
        }
        if (typeof patch.minQty !== "undefined") {
            updateFields.push('minQty = :minQty');
            replacements.minQty = patch.minQty;
        }
        if (typeof patch.isActive !== "undefined") {
            updateFields.push('isActive = :isActive');
            replacements.isActive = patch.isActive === true || patch.isActive === 1 ? 1 : 0;
        }
        if (typeof patch.pricingScope !== "undefined") {
            updateFields.push('pricingScope = :pricingScope');
            replacements.pricingScope = patch.pricingScope;
        }

        if (updateFields.length === 0) {
            return res.status(400).json({ success: false, message: "NO_FIELDS_TO_UPDATE" });
        }

        updateFields.push('updated_at = NOW()');

        const updateQuery = `
            UPDATE price_rules 
            SET ${updateFields.join(', ')}
            WHERE id = :id
        `;

        await sequelize.query(updateQuery, { replacements });

        // Fetch updated rule
        const [updatedRows] = await sequelize.query(`
            SELECT 
                pr.id,
                pr.paperSizeId,
                pr.colorModeId,
                pr.sideId,
                pr.pricingScope,
                pr.minPages,
                pr.minQty,
                pr.basePricePerPage,
                pr.isActive,
                pr.created_at,
                pr.updated_at
            FROM price_rules pr
            WHERE pr.id = :id
        `, {
            replacements: { id }
        });

        const rule = updatedRows[0] ? {
            id: updatedRows[0].id,
            paperSizeId: updatedRows[0].paperSizeId,
            colorModeId: updatedRows[0].colorModeId,
            sideId: updatedRows[0].sideId,
            pricingScope: updatedRows[0].pricingScope,
            minPages: updatedRows[0].minPages,
            minQty: updatedRows[0].minQty,
            basePricePerPage: parseFloat(updatedRows[0].basePricePerPage),
            isActive: updatedRows[0].isActive === 1 || updatedRows[0].isActive === true,
            createdAt: updatedRows[0].created_at,
            updatedAt: updatedRows[0].updated_at
        } : null;

        return res.json({ success: true, priceRule: rule });
    } catch (e) {
        console.error("PATCH /catalog/price-rules/:id error:", e);
        return res.status(500).json({ success: false, message: "Lỗi server" });
    }
});

module.exports = router;
