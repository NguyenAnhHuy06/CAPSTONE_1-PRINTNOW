// models/Side.js
const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Side = sequelize.define('Side', {
    id: {
        type: DataTypes.BIGINT,
        primaryKey: true,
        autoIncrement: true
    },
    code: {
        type: DataTypes.STRING(10),
        allowNull: false,
        unique: true,
        comment: 'Mã chế độ in'
    },
    description: {
        type: DataTypes.STRING(100),
        allowNull: false,
        comment: 'Mô tả chế độ in'
    },
    isActive: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
        comment: 'Trạng thái hoạt động'
    }
}, {
    tableName: 'sides',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

module.exports = Side;
