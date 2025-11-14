const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const PriceRule = sequelize.define('PriceRule', {
    id: {
        type: DataTypes.BIGINT,
        primaryKey: true,
        autoIncrement: true
    },
    paperSizeId: {
        type: DataTypes.BIGINT,
        allowNull: false,
        comment: 'ID kích thước giấy'
    },
    colorModeId: {
        type: DataTypes.BIGINT,
        allowNull: false,
        comment: 'ID chế độ màu'
    },
    sideId: {
        type: DataTypes.BIGINT,
        allowNull: false,
        comment: 'ID chế độ in'
    },
    pricingScope: {
        type: DataTypes.ENUM('GLOBAL', 'CUSTOMER_GROUP', 'INDIVIDUAL'),
        allowNull: false,
        defaultValue: 'GLOBAL',
        comment: 'Phạm vi áp dụng giá'
    },
    minPages: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1,
        comment: 'Số trang tối thiểu'
    },
    minQty: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1,
        comment: 'Số lượng tối thiểu'
    },
    basePricePerPage: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        comment: 'Giá cơ bản mỗi trang'
    },
    isActive: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
        comment: 'Trạng thái hoạt động'
    }
}, {
    tableName: 'price_rules',
    timestamps: false // Tắt timestamps vì bảng đã có created_at, updated_at
});

module.exports = PriceRule;
