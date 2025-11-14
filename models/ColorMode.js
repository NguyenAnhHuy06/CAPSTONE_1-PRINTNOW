const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const ColorMode = sequelize.define('ColorMode', {
    id: {
        type: DataTypes.BIGINT,
        primaryKey: true,
        autoIncrement: true
    },
    code: {
        type: DataTypes.STRING(10),
        allowNull: false,
        unique: true,
        comment: 'Mã chế độ màu'
    },
    description: {
        type: DataTypes.STRING(100),
        allowNull: false,
        comment: 'Mô tả chế độ màu'
    },
    isActive: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
        comment: 'Trạng thái hoạt động'
    }
}, {
    tableName: 'color_modes',
    timestamps: false // Tắt timestamps vì bảng đã có created_at, updated_at
});

module.exports = ColorMode;
