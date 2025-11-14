// models/index.js
// Centralized model exports and associations
const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");
const Order = require("./Order");
const OrderItem = require("./OrderItem");

const User = require("./User"); // User đã tự require sequelize từ config/database (ổn)
const UserSettingFactory = require("./UserSetting");

const UserSetting = UserSettingFactory(sequelize, DataTypes);

// Associations (đồng bộ với UserSetting.associate nếu cần)
UserSetting.belongsTo(User, {
  as: "user",
  foreignKey: "userId",
  targetKey: "id",
  onDelete: "CASCADE",
  onUpdate: "CASCADE",
});
User.hasOne(UserSetting, {
  as: "setting",
  foreignKey: "userId",
});

// Gắn quan hệ User ↔ Order theo cột customerId trong DB
if (!Order.associations?.customer) {
  Order.belongsTo(User, { as: "customer", foreignKey: "customerId" });
}
if (!User.associations?.orders) {
  User.hasMany(Order, { as: "orders", foreignKey: "customerId" });
}

// Gắn quan hệ Order ↔ OrderItem
if (!Order.associations?.items) {
  Order.hasMany(OrderItem, { as: "items", foreignKey: "orderId" });
}
if (!OrderItem.associations?.order) {
  OrderItem.belongsTo(Order, { as: "order", foreignKey: "orderId" });
}

module.exports = {
  sequelize,
  User,
  UserSetting,
  Order,
  OrderItem,
};
