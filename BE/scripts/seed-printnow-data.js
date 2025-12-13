// scripts/seed-printnow-data.js
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const User = require('../models/User');
const Order = require('../models/Order');
const OrderItem = require('../models/OrderItem');

const PaperSize = require('../models/PaperSize');
const ColorMode = require('../models/ColorMode');
const Side = require('../models/Side');
const PriceRule = require('../models/PriceRule');

const { sequelize } = require('../config/database');
const bcrypt = require('bcryptjs');

const TABLES_TRUNCATE_ORDER = [
  // BẢNG CON trước (có FK tới order_items / orders / catalog)
  'print_jobs',     // nếu có
  'files',          // nếu có
  'order_items',
  'orders',

  // Catalog / tham chiếu độc lập
  'price_rules',
  'paper_sizes',
  'color_modes',
  'sides',
];

async function truncateIfExists(tableName) {
  try {
    const [rows] = await sequelize.query(`SHOW TABLES LIKE :t`, {
      replacements: { t: tableName },
    });
    if (rows.length === 0) {
      console.log(`(skip) Table not found: ${tableName}`);
      return;
    }
    await sequelize.query(`TRUNCATE TABLE \`${tableName}\``);
    console.log(`TRUNCATE ${tableName} ✓`);
  } catch (err) {
    console.log(`(warn) TRUNCATE ${tableName} -> ${err.code || err.message}`);
  }
}

const seedPrintnowData = async () => {
  try {
    await sequelize.authenticate();
    console.log('Connected to MySQL for printnow data seeding.');

    // ===== Xoá dữ liệu cũ (tắt FK, truncate theo thứ tự) =====
    await sequelize.query('SET FOREIGN_KEY_CHECKS = 0');
    for (const t of TABLES_TRUNCATE_ORDER) {
      /* eslint-disable no-await-in-loop */
      await truncateIfExists(t);
    }
    await sequelize.query('SET FOREIGN_KEY_CHECKS = 1');
    console.log('Cleared existing printnow data.');

    // ===== Seed catalog =====
    const paperSizes = await Promise.all([
      PaperSize.create({ code: 'A4', name: 'A4 (210 x 297 mm)', widthMm: 210, heightMm: 297 }),
      PaperSize.create({ code: 'A3', name: 'A3 (297 x 420 mm)', widthMm: 297, heightMm: 420 }),
      PaperSize.create({ code: 'A5', name: 'A5 (148 x 210 mm)', widthMm: 148, heightMm: 210 }),
      PaperSize.create({ code: 'LETTER', name: 'Letter (8.5 x 11 inch)', widthMm: 215.9, heightMm: 279.4 }),
    ]);
    console.log('Created paper sizes');

    const colorModes = await Promise.all([
      ColorMode.create({ code: 'BW', description: 'Black & White' }),
      ColorMode.create({ code: 'COLOR', description: 'Full color' }),
    ]);
    console.log('Created color modes');

    const sides = await Promise.all([
      Side.create({ code: 'SINGLE', description: 'In một mặt' }),
      Side.create({ code: 'DOUBLE', description: 'In hai mặt' }),
    ]);
    console.log('Created sides');

    const priceRules = await Promise.all([
      PriceRule.create({ paperSizeId: paperSizes[0].id, colorModeId: colorModes[0].id, sideId: sides[0].id, pricingScope: 'GLOBAL', minPages: 1, minQty: 1, basePricePerPage: 1000 }),
      PriceRule.create({ paperSizeId: paperSizes[0].id, colorModeId: colorModes[0].id, sideId: sides[1].id, pricingScope: 'GLOBAL', minPages: 1, minQty: 1, basePricePerPage: 1500 }),
      PriceRule.create({ paperSizeId: paperSizes[0].id, colorModeId: colorModes[1].id, sideId: sides[0].id, pricingScope: 'GLOBAL', minPages: 1, minQty: 1, basePricePerPage: 5000 }),
      PriceRule.create({ paperSizeId: paperSizes[0].id, colorModeId: colorModes[1].id, sideId: sides[1].id, pricingScope: 'GLOBAL', minPages: 1, minQty: 1, basePricePerPage: 6000 }),
      PriceRule.create({ paperSizeId: paperSizes[1].id, colorModeId: colorModes[0].id, sideId: sides[0].id, pricingScope: 'GLOBAL', minPages: 1, minQty: 1, basePricePerPage: 2000 }),
    ]);
    console.log('Created price rules');

    // ===== User mẫu =====
    let customerUser = await User.findOne({ where: { email: 'customer@example.com' } });
    if (!customerUser) {
      const hash = await bcrypt.hash('customer123', 10);
      customerUser = await User.create({
        fullName: 'Customer User',
        email: 'customer@example.com',
        passwordHash: hash,
        phone: '0901234567',
        emailVerified: true,
        isActive: true,
      });
    }

    // ===== Đơn hàng 1 + items trong 1 transaction =====
    const order1 = await sequelize.transaction(async (t) => {
      const o1 = await Order.create({
        customerId: customerUser.id,
        status: 'pending',
        note: 'In gấp, giao trước 5h chiều',
        subtotal: 50000,
        discount: 0,
        totalAmount: 50000,
      }, { transaction: t });

      await OrderItem.bulkCreate([
        {
          orderId: o1.id,
          printType: 'DOCUMENT',
          pricingMode: 'PER_PAGE',
          paperSizeId: paperSizes[0].id,
          colorModeId: colorModes[0].id,
          sideId: sides[0].id,
          pages: 20,
          quantity: 2,
          unitPrice: 1000,
          lineTotal: 40000,
        },
        {
          orderId: o1.id,
          printType: 'DOCUMENT',
          pricingMode: 'PER_PAGE',
          paperSizeId: paperSizes[0].id,
          colorModeId: colorModes[1].id,
          sideId: sides[1].id,
          pages: 10,
          quantity: 1,
          unitPrice: 6000,
          lineTotal: 60000,
        },
      ], { transaction: t });

      return o1;
    });
    console.log(`Created Order 1 (ID: ${order1.id})`);

    // ===== Đơn hàng 2 + item trong 1 transaction =====
    await sequelize.transaction(async (t) => {
      const o2 = await Order.create({
        customerId: customerUser.id,
        status: 'completed',
        note: 'Đã giao hàng',
        subtotal: 30000,
        discount: 5000,
        totalAmount: 25000,
        completedAt: new Date(),
      }, { transaction: t });

      await OrderItem.create({
        orderId: o2.id,
        printType: 'DOCUMENT',
        pricingMode: 'PER_PAGE',
        paperSizeId: paperSizes[0].id,
        colorModeId: colorModes[0].id,
        sideId: sides[1].id,
        pages: 15,
        quantity: 2,
        unitPrice: 1500,
        lineTotal: 45000,
      }, { transaction: t });

      console.log(`Created Order 2 (ID: ${o2.id})`);
    });

    console.log('Printnow data seeding completed!');
    console.log('\n=== SUMMARY ===');
    console.log(`- Paper Sizes: ${paperSizes.length}`);
    console.log(`- Color Modes: ${colorModes.length}`);
    console.log(`- Sides: ${sides.length}`);
    console.log(`- Price Rules: ${priceRules.length}`);
    console.log(`- Orders: 2`);

    process.exit(0);
  } catch (error) {
    console.error('Error seeding printnow data:', error);
    process.exit(1);
  }
};

seedPrintnowData();
