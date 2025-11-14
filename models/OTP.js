const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const OTP = sequelize.define('OTP', {
    id: {
        type: DataTypes.BIGINT,
        primaryKey: true,
        autoIncrement: true
    },
    userId: {
        type: DataTypes.BIGINT,
        allowNull: false
        // Không có foreign key constraint do quyền hạn hạn chế
    },
    email: {
        type: DataTypes.STRING(255),
        allowNull: false,
        validate: {
            isEmail: true
        }
    },
    otp: {
        type: DataTypes.CHAR(6),
        allowNull: false,
        validate: {
            len: [6, 6]
        }
    },
    type: {
        type: DataTypes.ENUM('registration', 'password_reset'),
        defaultValue: 'registration'
    },
    expiresAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
    },
    isUsed: {
        type: DataTypes.TINYINT(1),
        defaultValue: 0
    },
    attempts: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        validate: {
            max: 3
        }
    },
    consumedAt: {
        type: DataTypes.DATE,
        allowNull: true
    },
    resendCount: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    lastSentAt: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    },
    purpose: {
        type: DataTypes.ENUM('SIGN_UP', 'FORGOT_PASSWORD', 'CHANGE_EMAIL'),
        defaultValue: 'SIGN_UP'
    }
}, {
    tableName: 'email_otps',
    timestamps: true,
    indexes: [
        {
            fields: ['userId', 'expiresAt']
        },
        {
            fields: ['email']
        },
        {
            fields: ['purpose']
        }
    ]
});

// Associations bị tắt do quyền hạn hạn chế
// const User = require('./User');
// OTP.belongsTo(User, { foreignKey: 'userId', as: 'user' });
// User.hasMany(OTP, { foreignKey: 'userId', as: 'otps' });

module.exports = OTP;