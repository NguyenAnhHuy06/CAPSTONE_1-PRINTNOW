// models/User.js
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
          args: [1, 50],
          msg: "Tên đăng nhập không được vượt quá 50 ký tự",
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
        len: {
          args: [1, 50],
          msg: "Email không được vượt quá 50 ký tự",
        },
      },
    },
    phone: {
      type: DataTypes.STRING(50),
      allowNull: true,
      // unique: true, // Tắt để tránh tạo index
      validate: {
        // Chỉ validate nếu phone có giá trị (không null/undefined/empty)
        // Sequelize tự động skip null/undefined khi allowNull: true
        isPhone(value) {
          if (value && value.trim() !== '' && !/^[0-9]{10}$/.test(value)) {
            throw new Error("Số điện thoại phải có đúng 10 chữ số");
          }
        },
      },
    },
    passwordHash: {
      type: DataTypes.STRING(255),
      allowNull: false,
      field: "password_hash",
      // Lưu ý: Validation phức tạp (chữ hoa, ký tự đặc biệt, độ dài) được thực hiện ở route trước khi hash
      // Không validate ở đây vì khi tạo user, passwordHash được set từ plaintext password
      // và validation sẽ chạy trước hook beforeCreate (hash password)
      // Validation sẽ được thực hiện ở route level
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
    role: {
      type: DataTypes.ENUM("customer", "staff", "admin", "owner"),
      allowNull: false,
      defaultValue: "customer",
    },
  },
  {
    tableName: "users",
    timestamps: true, // Bật timestamps vì database có createdAt, updatedAt
    // Map đúng theo DB snake_case
    createdAt: "createdAt",
    updatedAt: "updatedAt",
    indexes: [], // Tắt tất cả indexes để tránh lỗi "Too many keys"
    hooks: {
      beforeCreate: async (user) => {
        if (user.passwordHash) {
          // tránh hash 2 lần nếu lỡ truyền vào chuỗi bcrypt hash
          const s = String(user.passwordHash);
          const looksBcrypt =
            s.startsWith("$2a$") || s.startsWith("$2b$") || s.startsWith("$2y$");
          if (looksBcrypt) return;
          const salt = await bcrypt.genSalt(10);
          user.passwordHash = await bcrypt.hash(user.passwordHash, salt);
        }
      },
      beforeUpdate: async (user) => {
        if (user.changed("passwordHash")) {
          const s = String(user.passwordHash);
          const looksBcrypt =
            s.startsWith("$2a$") || s.startsWith("$2b$") || s.startsWith("$2y$");
          if (looksBcrypt) return;
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
