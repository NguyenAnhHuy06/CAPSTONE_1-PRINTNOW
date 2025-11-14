const { DataTypes } = require("sequelize");
const bcrypt = require("bcryptjs");
const { sequelize } = require("../config/database");

const User = sequelize.define(
  "User",
  {
    id: {
      type: DataTypes.BIGINT,
      primaryKey: true,
      autoIncrement: true,
    },
    fullName: {
      type: DataTypes.STRING(255),
      allowNull: false,
      field: "full_name",
      validate: {
        notEmpty: {
          msg: "Vui lòng nhập tên",
        },
        len: {
          args: [1, 255],
          msg: "Tên không được vượt quá 255 ký tự",
        },
      },
    },
    email: {
      type: DataTypes.STRING(255),
      allowNull: false,
      // unique: true, // Tắt để tránh tạo index
      validate: {
        isEmail: {
          msg: "Vui lòng nhập email hợp lệ",
        },
      },
    },
    phone: {
      type: DataTypes.STRING(50),
      allowNull: true,
      // unique: true, // Tắt để tránh tạo index
      validate: {
        is: {
          args: /^[0-9]{10,11}$/,
          msg: "Số điện thoại phải có 10-11 chữ số",
        },
      },
    },
    passwordHash: {
      type: DataTypes.STRING(255),
      allowNull: false,
      field: "password_hash",
      validate: {
        len: {
          args: [6, 255],
          msg: "Mật khẩu phải có ít nhất 6 ký tự",
        },
      },
    },
    emailVerified: {
      type: DataTypes.TINYINT(1),
      defaultValue: 0,
      field: "email_verified",
    },
    isActive: {
      type: DataTypes.TINYINT(1),
      defaultValue: 1,
      field: "is_active",
    },
    // failedLogins và lastLoginAt không có trong database thực tế
    // failedLogins: {
    //   type: DataTypes.INTEGER,
    //   defaultValue: 0,
    //   field: 'failed_logins'
    // },
    // lastLoginAt: {
    //   type: DataTypes.DATE,
    //   allowNull: true,
    //   field: 'last_login_at'
    // },
    externalUid: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: "external_uid",
    },
    avatarUrl: {
      type: DataTypes.STRING(500),
      allowNull: true,
      field: "avatar_url",
    },
    address: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: "address",
      validate: {
        len: {
          args: [0, 255],
          msg: "Địa chỉ không được vượt quá 255 ký tự",
        },
      },
    },
  },
  {
    tableName: "users",
    timestamps: true, // Bật timestamps vì database có created_at, updated_at
    indexes: [], // Tắt tất cả indexes để tránh lỗi "Too many keys"
    hooks: {
      beforeCreate: async (user) => {
        if (user.passwordHash) {
          const salt = await bcrypt.genSalt(10);
          user.passwordHash = await bcrypt.hash(user.passwordHash, salt);
        }
      },
      beforeUpdate: async (user) => {
        if (user.changed("passwordHash")) {
          const salt = await bcrypt.genSalt(10);
          user.passwordHash = await bcrypt.hash(user.passwordHash, salt);
        }
      },
    },
  }
);

// Phương thức instance để so sánh mật khẩu
User.prototype.comparePassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.passwordHash);
};

module.exports = User;
