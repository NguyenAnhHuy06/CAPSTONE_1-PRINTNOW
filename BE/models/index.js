// models/index.js
// Centralized model exports and associations
const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");
const Order = require("./Order");
const OrderItem = require("./OrderItem");

const User = require("./User"); // User đã tự require sequelize từ config/database (ổn)
const UserSettingFactory = require("./UserSetting");

// Catalog models
const PaperSize = require("./PaperSize");
const ColorMode = require("./ColorMode");
const Side = require("./Side");
const PriceRule = require("./PriceRule");

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

// ========= CATALOG ASSOCIATIONS =========
// PriceRule ↔ PaperSize
if (!PriceRule.associations?.paperSize) {
  PriceRule.belongsTo(PaperSize, {
    as: "paperSize",
    foreignKey: "paperSizeId",
    targetKey: "id",
    onDelete: "RESTRICT",
    onUpdate: "CASCADE",
  });
}
if (!PaperSize.associations?.priceRules) {
  PaperSize.hasMany(PriceRule, {
    as: "priceRules",
    foreignKey: "paperSizeId",
  });
}

// PriceRule ↔ ColorMode
if (!PriceRule.associations?.colorMode) {
  PriceRule.belongsTo(ColorMode, {
    as: "colorMode",
    foreignKey: "colorModeId",
    targetKey: "id",
    onDelete: "RESTRICT",
    onUpdate: "CASCADE",
  });
}
if (!ColorMode.associations?.priceRules) {
  ColorMode.hasMany(PriceRule, {
    as: "priceRules",
    foreignKey: "colorModeId",
  });
}

// PriceRule ↔ Side
if (!PriceRule.associations?.side) {
  PriceRule.belongsTo(Side, {
    as: "side",
    foreignKey: "sideId",
    targetKey: "id",
    onDelete: "RESTRICT",
    onUpdate: "CASCADE",
  });
}
if (!Side.associations?.priceRules) {
  Side.hasMany(PriceRule, {
    as: "priceRules",
    foreignKey: "sideId",
  });
}

module.exports = {
  sequelize,
  User,
  UserSetting,
  Order,
  OrderItem,
  PaperSize,
  ColorMode,
  Side,
  PriceRule,
};
