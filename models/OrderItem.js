// models/OrderItem.js
const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const OrderItem = sequelize.define('OrderItem', {
  id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
  orderId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false, comment: 'ID đơn hàng' },
  printType: { type: DataTypes.ENUM('DOCUMENT', 'PHOTO', 'BANNER'), allowNull: false, defaultValue: 'DOCUMENT' },
  pricingMode: { type: DataTypes.ENUM('PER_PAGE', 'PER_SHEET', 'FIXED'), allowNull: false, defaultValue: 'PER_PAGE' },
  paperSizeId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
  colorModeId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
  sideId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
  pages: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  quantity: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
  setCount: { type: DataTypes.INTEGER, allowNull: true },
  pagesPerSet: { type: DataTypes.INTEGER, allowNull: true },
  unitPrice: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0.00 },
  lineTotal: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0.00 },
  extraOptions: { type: DataTypes.JSON, allowNull: true },
  note: { type: DataTypes.TEXT, allowNull: true },
}, {
  tableName: 'order_items',
  timestamps: false,
});

// Không khai báo belongsTo ở đây để tránh circular require; include sẽ dùng alias 'items' từ Order.hasMany

module.exports = OrderItem;
