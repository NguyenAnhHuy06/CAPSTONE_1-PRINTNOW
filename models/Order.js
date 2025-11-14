// models/Order.js
const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Order = sequelize.define('Order', {
  id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
  customerId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false, comment: 'ID khách hàng' },
  status: {
    type: DataTypes.ENUM('NEW', 'pending', 'processing', 'ready', 'completed', 'cancelled'),
    defaultValue: 'NEW',
    comment: 'Trạng thái đơn hàng',
  },
  note: { type: DataTypes.TEXT, allowNull: true, comment: 'Ghi chú đơn hàng' },
  subtotal: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0.00 },
  discount: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0.00 },
  totalAmount: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0.00 },
  completedAt: { type: DataTypes.DATE, allowNull: true, comment: 'Thời gian hoàn thành' },
}, {
  tableName: 'orders',
  timestamps: true, // bảng của bạn không có createdAt/updatedAt
});

module.exports = Order;
