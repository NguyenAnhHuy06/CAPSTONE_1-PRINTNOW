const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const PaperSize = sequelize.define('PaperSize', {
    id: {
        type: DataTypes.BIGINT,
        primaryKey: true,
        autoIncrement: true
    },
    code: {
        type: DataTypes.STRING(10),
        allowNull: false,
        unique: true,
        comment: 'Mã kích thước giấy'
    },
    name: {
        type: DataTypes.STRING(50),
        allowNull: false,
        comment: 'Tên kích thước giấy'
    },
    widthMm: {
        type: DataTypes.DECIMAL(8, 2),
        allowNull: false,
        comment: 'Chiều rộng (mm)'
    },
    heightMm: {
        type: DataTypes.DECIMAL(8, 2),
        allowNull: false,
        comment: 'Chiều cao (mm)'
    },
    isActive: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
        comment: 'Trạng thái hoạt động'
    }
}, {
    tableName: 'paper_sizes',
    timestamps: false // Tắt timestamps vì bảng đã có created_at, updated_at
});

module.exports = PaperSize;
