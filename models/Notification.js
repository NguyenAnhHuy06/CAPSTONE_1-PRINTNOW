// models/Notification.js
const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Notification = sequelize.define('Notification', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  userId: { type: DataTypes.INTEGER, allowNull: false, field: 'user_id' },

  title:   { type: DataTypes.STRING(255), allowNull: false },
  message: { type: DataTypes.TEXT, allowNull: false },          // <— khớp DB
  type:    {                                                     // <— ENUM khớp DB
    type: DataTypes.ENUM('success', 'processing', 'info', 'neutral', 'error'),
    allowNull: true,
    defaultValue: 'info'
  },
  tag: {
    type: DataTypes.ENUM('important', 'none'),
    allowNull: false,
    defaultValue: 'none'
  },
  link:   { type: DataTypes.STRING(255), allowNull: true },
  isRead: { type: DataTypes.TINYINT, defaultValue: 0, field: 'is_read' },
  created_at: { type: DataTypes.DATE, allowNull: true }         // để có thể truy xuất raw
}, {
  tableName: 'notifications',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: false,                      // bảng không có updated_at
  underscored: true,                     // an toàn với snake_case
});

module.exports = Notification;
