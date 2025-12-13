// models/UserSetting.js
module.exports = (sequelize, DataTypes) => {
  const UserSetting = sequelize.define(
    "UserSetting",
    {
      id: {
        type: DataTypes.BIGINT.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },  
      userId: {
        field: "user_id",
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: false,
        unique: true,
      },
      language: { type: DataTypes.STRING(10), defaultValue: "en" },
      notifyEmail: {
        field: "notify_email",
        type: DataTypes.BOOLEAN,
        defaultValue: true,
      },
      notifySms: {
        field: "notify_sms",
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },
    },
    {
      tableName: "user_settings",
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
      underscored: true,
    }
  );

  // UserSetting.associate = (models) => {
  //   UserSetting.belongsTo(models.User, {
  //     as: "user",
  //     foreignKey: "userId",
  //     targetKey: "id",
  //     onDelete: "CASCADE",
  //     onUpdate: "CASCADE",
  //   });
  // };

  return UserSetting;
};
