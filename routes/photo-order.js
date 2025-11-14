// routes/photo-orders.js
const express = require('express');
const router = express.Router();
const { sequelize } = require('../config/database'); // dùng instance Sequelize đang có
const { QueryTypes } = require('sequelize');

// ⚙️ Pricing: BÁM CHUẨN FE hiện tại
const SIZE_PRICE = { '10x15': 5500, '13x18': 8800, '15x20': 16500 };
const PAPER_EXTRA = { 'Glossy': 0, 'Matte': 2000, 'Premium': 4000 };
const BORDERLESS_RATE = 0.10;

// Utils
const fmtVND = n => Math.round(n);

// Map “size code” → paper_sizes.id  (bạn có thể seed 3 size này trong DB)
async function getPaperSizeId(sizeCode) {
  const row = await sequelize.query(
    'SELECT id FROM paper_sizes WHERE code = :code AND isActive = 1 LIMIT 1',
    { replacements: { code: sizeCode }, type: QueryTypes.SELECT }
  );
  if (row.length) return row[0].id;
  // fallback: tạo nhanh (tuỳ chọn)
  const dim = {
    '10x15': { name: '10 x 15 cm', w: 100, h: 150 },
    '13x18': { name: '13 x 18 cm', w: 130, h: 180 },
    '15x20': { name: '15 x 20 cm', w: 150, h: 200 }
  }[sizeCode];
  if (!dim) throw new Error(`Unsupported size code: ${sizeCode}`);
  const [result] = await sequelize.query(
    `INSERT INTO paper_sizes(code,name,widthMm,heightMm,isActive)
     VALUES(:code,:name,:w,:h,1)`,
    {
      replacements: { code: sizeCode, name: dim.name, w: dim.w, h: dim.h },
      type: QueryTypes.INSERT
    }
  );
  return result; // insertId
}

// Lấy id COLOR (ảnh luôn in màu)
async function getColorModeId() {
  const row = await sequelize.query(
    `SELECT id FROM color_modes WHERE code IN ('COLOR','COL','CL') AND isActive=1 LIMIT 1`,
    { type: QueryTypes.SELECT }
  );
  if (row.length) return row[0].id;
  // fallback: lấy bất kỳ bản ghi đang active
  const any = await sequelize.query(
    `SELECT id FROM color_modes WHERE isActive=1 LIMIT 1`,
    { type: QueryTypes.SELECT }
  );
  if (any.length) return any[0].id;
  // cuối cùng, seed “COLOR”
  const [id] = await sequelize.query(
    `INSERT INTO color_modes(code,description,isActive) VALUES('COLOR','Full color',1)`,
    { type: QueryTypes.INSERT }
  );
  return id;
}

// Lấy id 1-mặt
// Lấy id 1-mặt (khớp DB của bạn: code = 'SINGLE')
async function getSideId() {
  const row = await sequelize.query(
    `SELECT id FROM sides WHERE code IN ('SINGLE','ONE','1') AND isActive=1 LIMIT 1`,
    { type: QueryTypes.SELECT }
  );
  if (row.length) return row[0].id;

  // fallback: lấy bất kỳ đang active
  const any = await sequelize.query(
    `SELECT id FROM sides WHERE isActive=1 LIMIT 1`,
    { type: QueryTypes.SELECT }
  );
  if (any.length) return any[0].id;

  // seed nếu thiếu (hiếm khi xảy ra với DB của bạn)
  const [id] = await sequelize.query(
    `INSERT INTO sides(code,description,isActive) VALUES('SINGLE','Single-sided',1)`,
    { type: QueryTypes.INSERT }
  );
  return id;
}


// Tính giá từng ảnh — khớp FE
function calcUnitPrice(sizeCode, paper, borderless, copies) {
  const base = SIZE_PRICE[sizeCode] ?? SIZE_PRICE['10x15'];
  const extra = PAPER_EXTRA[paper] ?? 0;
  let unit = base + extra; // đơn giá 1 ảnh
  if (borderless) unit = Math.round(unit * (1 + BORDERLESS_RATE));
  // lineTotal sẽ do trigger * quantity; ở đây trả về unitPrice
  return unit;
}

/**
 * POST /api/orders/photo
 * Body:
 * {
 *   customerId: number,
 *   note?: string,
 *   files: [{
 *     name: string,
 *     sizeCode: '10x15'|'13x18'|'15x20',
 *     paper: 'Glossy'|'Matte'|'Premium',
 *     borderless: boolean,
 *     copies: number,
 *     uploadedFileId?: number   // nếu FE đã upload file qua /api/files, truyền id để gắn đơn
 *   }]
 * }
 */
router.post('/photo', async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { customerId, note, files } = req.body || {};
    if (!customerId || !Array.isArray(files) || files.length === 0) {
      return res.status(400).json({ error: 'customerId & files are required' });
    }

    const colorModeId = await getColorModeId();
    const sideId = await getSideId();

    // 1) Tạo đơn
    const [orderId] = await sequelize.query(
      `INSERT INTO orders(status,note,subtotal,discount,customerId,totalAmount,completedAt)
  VALUES('pending', :note, 0, 0, :customerId, 0, NULL)`,
      { replacements: { note: note || null, customerId }, type: QueryTypes.INSERT, transaction: t }
    );

    // 2) Thêm items
    let createdItems = [];
    for (const f of files) {
      const { name, sizeCode, paper, borderless, copies } = f;
      const qty = Math.max(1, parseInt(copies || 1));
      const paperSizeId = await getPaperSizeId(String(sizeCode || '10x15'));
      const unitPrice = calcUnitPrice(sizeCode, paper, !!borderless, qty);

      const extraOptions = {
        originalName: name,
        sizeCode,
        paper,
        borderless: !!borderless,
        type: 'PHOTO'
      };

      // pages = 1; pricingMode: PER_SHEET; printType: PHOTO
      const [orderItemId] = await sequelize.query(
        `INSERT INTO order_items(
           pages, quantity, note, orderId, printType, pricingMode,
           paperSizeId, colorModeId, sideId,
           setCount, pagesPerSet, unitPrice, lineTotal, extraOptions
         )
         VALUES(
           1, :quantity, NULL, :orderId, 'PHOTO', 'PER_SHEET',
           :paperSizeId, :colorModeId, :sideId,
           NULL, NULL, :unitPrice, 0, :extraOptions
         )`,
        {
          replacements: {
            quantity: qty,
            orderId,
            paperSizeId,
            colorModeId,
            sideId,
            unitPrice,
            extraOptions: JSON.stringify(extraOptions)
          },
          type: QueryTypes.INSERT, transaction: t
        }
      );

      // 3) (Tuỳ chọn) gắn file và tạo print_job
      if (f.uploadedFileId) {
        // update files → gắn orderId & orderItemId
        await sequelize.query(
          `UPDATE files SET orderId = :orderId, orderItemId = :itemId WHERE id = :fileId`,
          { replacements: { orderId, itemId: orderItemId, fileId: f.uploadedFileId }, type: QueryTypes.UPDATE, transaction: t }
        );

        // tạo job in
        await sequelize.query(
          `INSERT INTO print_jobs(order_item_id, file_id, status, attempts)
           VALUES(:itemId, :fileId, 'QUEUED', 0)`,
          { replacements: { itemId: orderItemId, fileId: f.uploadedFileId }, type: QueryTypes.INSERT, transaction: t }
        );
      }

      createdItems.push({ orderItemId, qty, unitPrice, name });
    }

    // 4) Triggers sẽ tự tính `lineTotal` & recalc `orders.subtotal/totalAmount`
    //    - BEFORE INSERT/UPDATE trên order_items tính lineTotal = unitPrice * quantity * setCount(=1)
    //    - AFTER INSERT/UPDATE/DELETE gọi sp_recalc_order_totals(orderId)
    //    (đã có sẵn trong schema)  :contentReference[oaicite:1]{index=1}

    // Lấy tổng tiền sau khi trigger chạy
    const [orderRow] = await sequelize.query(
      `SELECT id, status, subtotal, discount, totalAmount FROM orders WHERE id = :id`,
      { replacements: { id: orderId }, type: QueryTypes.SELECT, transaction: t }
    );

    await t.commit();

    return res.json({
      ok: true,
      order: orderRow,
      items: createdItems
    });
  } catch (err) {
    await t.rollback();
    console.error(err);
    return res.status(500).json({ error: 'Failed to create photo order', detail: String(err.message || err) });
  }
});

/**
 * GET /api/orders/:id
 * Trả lại chi tiết đơn + items (để trang Payment dùng)
 */
router.get('/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: 'Invalid id' });

  try {
    const order = await sequelize.query(
      `SELECT id, status, note, subtotal, discount, totalAmount, customerId
       FROM orders WHERE id = :id`,
      { replacements: { id }, type: QueryTypes.SELECT }
    );
    if (!order.length) return res.status(404).json({ error: 'Order not found' });

    const items = await sequelize.query(
      `SELECT id, pages, quantity, printType, pricingMode, unitPrice, lineTotal, extraOptions
       FROM order_items WHERE orderId = :id ORDER BY id`,
      { replacements: { id }, type: QueryTypes.SELECT }
    );

    return res.json({ ok: true, order: order[0], items });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Failed to load order' });
  }
});

module.exports = router;
