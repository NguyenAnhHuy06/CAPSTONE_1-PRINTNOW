const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const User = require('./User');
const Order = require('./Order');
const OrderItem = require('./OrderItem');

const File = sequelize.define('File', {
  id: {
    type: DataTypes.BIGINT,
    primaryKey: true,
    autoIncrement: true
  },
  ownerId: {
    type: DataTypes.BIGINT,
    allowNull: false,
    // Không có foreign key constraint do quyền hạn hạn chế
    comment: 'ID chủ sở hữu file'
  },
  orderId: {
    type: DataTypes.BIGINT,
    allowNull: true,
    // Không có foreign key constraint do quyền hạn hạn chế
    comment: 'ID đơn hàng'
  },
  orderItemId: {
    type: DataTypes.BIGINT,
    allowNull: true,
    // Không có foreign key constraint do quyền hạn hạn chế
    comment: 'ID item đơn hàng'
  },
  originalName: {
    type: DataTypes.STRING(255),
    allowNull: false,
    comment: 'Tên file gốc'
  },
  contentType: {
    type: DataTypes.STRING(100),
    allowNull: false,
    comment: 'Loại nội dung file'
  },
  storageProvider: {
    type: DataTypes.ENUM('local', 'aws_s3', 'google_cloud', 'azure'),
    allowNull: false,
    defaultValue: 'local',
    comment: 'Nhà cung cấp lưu trữ'
  },
  storageKey: {
    type: DataTypes.STRING(500),
    allowNull: false,
    comment: 'Khóa lưu trữ'
  },
  storageUrl: {
    type: DataTypes.STRING(500),
    allowNull: true,
    comment: 'URL lưu trữ'
  },
  sizeBytes: {
    type: DataTypes.BIGINT,
    allowNull: false,
    comment: 'Kích thước file (bytes)'
  },
  pages: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
    comment: 'Số trang'
  },
  uploadedAt: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
    comment: 'Thời gian upload'
  },
  expiresAt: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'Thời gian hết hạn'
  },
  isDeleted: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
    comment: 'Đã xóa'
  }
}, {
  tableName: 'files',
  timestamps: false // Tắt timestamps vì bảng đã có created_at, updated_at
});

// Associations bị tắt do quyền hạn hạn chế
// File.belongsTo(User, { foreignKey: 'ownerId', as: 'owner' });
// File.belongsTo(Order, { foreignKey: 'orderId', as: 'order' });
// File.belongsTo(OrderItem, { foreignKey: 'orderItemId', as: 'orderItem' });

// User.hasMany(File, { foreignKey: 'ownerId', as: 'files' });
// Order.hasMany(File, { foreignKey: 'orderId', as: 'files' });
// OrderItem.hasMany(File, { foreignKey: 'orderItemId', as: 'files' });

module.exports = File;