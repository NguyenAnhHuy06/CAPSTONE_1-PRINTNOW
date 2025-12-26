// scripts/migrate-files-table.js
// Migration script để cập nhật bảng files theo model File.js mới
const { sequelize } = require("../config/database");
const { QueryTypes } = require("sequelize");

async function migrateFilesTable() {
  try {
    console.log("Bắt đầu migration bảng files...");

    // Kiểm tra xem bảng files có tồn tại không
    const [tables] = await sequelize.query(
      `SELECT TABLE_NAME 
       FROM INFORMATION_SCHEMA.TABLES 
       WHERE TABLE_SCHEMA = DATABASE() 
       AND TABLE_NAME = 'files'`,
      { type: QueryTypes.SELECT }
    );

    if (tables.length === 0) {
      console.log("Tạo bảng files mới...");
      await sequelize.query(`
        CREATE TABLE IF NOT EXISTS files (
          id BIGINT AUTO_INCREMENT PRIMARY KEY,
          ownerId BIGINT NOT NULL COMMENT 'ID chủ sở hữu file',
          orderId BIGINT NULL COMMENT 'ID đơn hàng',
          orderItemId BIGINT NULL COMMENT 'ID item đơn hàng',
          originalName VARCHAR(255) NOT NULL COMMENT 'Tên file gốc',
          contentType VARCHAR(100) NOT NULL COMMENT 'Loại nội dung file',
          storageProvider ENUM('local', 'aws_s3', 'google_cloud', 'azure') NOT NULL DEFAULT 'local' COMMENT 'Nhà cung cấp lưu trữ',
          storageKey VARCHAR(500) NOT NULL COMMENT 'Khóa lưu trữ',
          storageUrl VARCHAR(500) NULL COMMENT 'URL lưu trữ',
          sizeBytes BIGINT NOT NULL COMMENT 'Kích thước file (bytes)',
          pages INT NOT NULL DEFAULT 0 COMMENT 'Số trang',
          uploadedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Thời gian upload',
          expiresAt DATETIME NULL COMMENT 'Thời gian hết hạn',
          isDeleted BOOLEAN NOT NULL DEFAULT FALSE COMMENT 'Đã xóa',
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);
      console.log("✅ Đã tạo bảng files mới");
    } else {
      console.log("Bảng files đã tồn tại, kiểm tra và cập nhật các cột...");

      // Kiểm tra và thêm các cột mới nếu chưa có
      const [columns] = await sequelize.query(
        `SELECT COLUMN_NAME 
         FROM INFORMATION_SCHEMA.COLUMNS 
         WHERE TABLE_SCHEMA = DATABASE() 
         AND TABLE_NAME = 'files'`,
        { type: QueryTypes.SELECT }
      );

      const existingColumns = columns.map((c) => c.COLUMN_NAME);

      // Thêm ownerId nếu chưa có (migrate từ userId)
      if (!existingColumns.includes("ownerId")) {
        if (existingColumns.includes("userId")) {
          console.log("Đổi tên cột userId thành ownerId...");
          await sequelize.query(`ALTER TABLE files CHANGE COLUMN userId ownerId BIGINT NOT NULL COMMENT 'ID chủ sở hữu file'`);
        } else {
          await sequelize.query(`ALTER TABLE files ADD COLUMN ownerId BIGINT NOT NULL COMMENT 'ID chủ sở hữu file' AFTER id`);
        }
        console.log("✅ Đã thêm/cập nhật cột ownerId");
      }

      // Thêm orderId nếu chưa có
      if (!existingColumns.includes("orderId")) {
        await sequelize.query(`ALTER TABLE files ADD COLUMN orderId BIGINT NULL COMMENT 'ID đơn hàng' AFTER ownerId`);
        console.log("✅ Đã thêm cột orderId");
      }

      // Thêm orderItemId nếu chưa có
      if (!existingColumns.includes("orderItemId")) {
        await sequelize.query(`ALTER TABLE files ADD COLUMN orderItemId BIGINT NULL COMMENT 'ID item đơn hàng' AFTER orderId`);
        console.log("✅ Đã thêm cột orderItemId");
      }

      // Thêm contentType nếu chưa có (migrate từ fileType)
      if (!existingColumns.includes("contentType")) {
        if (existingColumns.includes("fileType")) {
          console.log("Đổi tên cột fileType thành contentType...");
          await sequelize.query(`ALTER TABLE files CHANGE COLUMN fileType contentType VARCHAR(100) NOT NULL COMMENT 'Loại nội dung file'`);
        } else {
          await sequelize.query(`ALTER TABLE files ADD COLUMN contentType VARCHAR(100) NOT NULL COMMENT 'Loại nội dung file' AFTER originalName`);
        }
        console.log("✅ Đã thêm/cập nhật cột contentType");
      }

      // Thêm storageProvider nếu chưa có
      if (!existingColumns.includes("storageProvider")) {
        await sequelize.query(`ALTER TABLE files ADD COLUMN storageProvider ENUM('local', 'aws_s3', 'google_cloud', 'azure') NOT NULL DEFAULT 'local' COMMENT 'Nhà cung cấp lưu trữ' AFTER contentType`);
        console.log("✅ Đã thêm cột storageProvider");
      }

      // Thêm storageKey nếu chưa có (migrate từ filePath)
      if (!existingColumns.includes("storageKey")) {
        if (existingColumns.includes("filePath")) {
          console.log("Thêm cột storageKey từ filePath...");
          await sequelize.query(`ALTER TABLE files ADD COLUMN storageKey VARCHAR(500) NOT NULL COMMENT 'Khóa lưu trữ' AFTER storageProvider`);
          // Copy dữ liệu từ filePath sang storageKey
          await sequelize.query(`UPDATE files SET storageKey = filePath WHERE storageKey IS NULL OR storageKey = ''`);
        } else {
          await sequelize.query(`ALTER TABLE files ADD COLUMN storageKey VARCHAR(500) NOT NULL COMMENT 'Khóa lưu trữ' AFTER storageProvider`);
        }
        console.log("✅ Đã thêm cột storageKey");
      }

      // Thêm storageUrl nếu chưa có
      if (!existingColumns.includes("storageUrl")) {
        await sequelize.query(`ALTER TABLE files ADD COLUMN storageUrl VARCHAR(500) NULL COMMENT 'URL lưu trữ' AFTER storageKey`);
        console.log("✅ Đã thêm cột storageUrl");
      }

      // Thêm sizeBytes nếu chưa có (migrate từ fileSize)
      if (!existingColumns.includes("sizeBytes")) {
        if (existingColumns.includes("fileSize")) {
          console.log("Đổi tên cột fileSize thành sizeBytes...");
          await sequelize.query(`ALTER TABLE files CHANGE COLUMN fileSize sizeBytes BIGINT NOT NULL COMMENT 'Kích thước file (bytes)'`);
        } else {
          await sequelize.query(`ALTER TABLE files ADD COLUMN sizeBytes BIGINT NOT NULL COMMENT 'Kích thước file (bytes)' AFTER storageUrl`);
        }
        console.log("✅ Đã thêm/cập nhật cột sizeBytes");
      }

      // Thêm pages nếu chưa có
      if (!existingColumns.includes("pages")) {
        await sequelize.query(`ALTER TABLE files ADD COLUMN pages INT NOT NULL DEFAULT 0 COMMENT 'Số trang' AFTER sizeBytes`);
        console.log("✅ Đã thêm cột pages");
      }

      // Thêm uploadedAt nếu chưa có (migrate từ createdAt)
      if (!existingColumns.includes("uploadedAt")) {
        if (existingColumns.includes("createdAt")) {
          console.log("Thêm cột uploadedAt từ createdAt...");
          await sequelize.query(`ALTER TABLE files ADD COLUMN uploadedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Thời gian upload' AFTER pages`);
          await sequelize.query(`UPDATE files SET uploadedAt = createdAt WHERE uploadedAt IS NULL`);
        } else {
          await sequelize.query(`ALTER TABLE files ADD COLUMN uploadedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Thời gian upload' AFTER pages`);
        }
        console.log("✅ Đã thêm cột uploadedAt");
      }

      // Thêm expiresAt nếu chưa có
      if (!existingColumns.includes("expiresAt")) {
        await sequelize.query(`ALTER TABLE files ADD COLUMN expiresAt DATETIME NULL COMMENT 'Thời gian hết hạn' AFTER uploadedAt`);
        console.log("✅ Đã thêm cột expiresAt");
      }

      // Thêm isDeleted nếu chưa có
      if (!existingColumns.includes("isDeleted")) {
        await sequelize.query(`ALTER TABLE files ADD COLUMN isDeleted BOOLEAN NOT NULL DEFAULT FALSE COMMENT 'Đã xóa' AFTER expiresAt`);
        console.log("✅ Đã thêm cột isDeleted");
      }

      // Thêm indexes
      console.log("Thêm indexes...");
      try {
        await sequelize.query(`CREATE INDEX idx_files_owner_id ON files(ownerId)`);
      } catch (e) {
        // Index có thể đã tồn tại
      }
      try {
        await sequelize.query(`CREATE INDEX idx_files_order_id ON files(orderId)`);
      } catch (e) {
        // Index có thể đã tồn tại
      }
      try {
        await sequelize.query(`CREATE INDEX idx_files_order_item_id ON files(orderItemId)`);
      } catch (e) {
        // Index có thể đã tồn tại
      }
      try {
        await sequelize.query(`CREATE INDEX idx_files_is_deleted ON files(isDeleted)`);
      } catch (e) {
        // Index có thể đã tồn tại
      }
      console.log("✅ Đã thêm indexes");
    }

    console.log("✅ Migration bảng files hoàn tất!");
  } catch (error) {
    console.error("❌ Lỗi khi migration:", error);
    throw error;
  }
}

// Chạy migration nếu được gọi trực tiếp
if (require.main === module) {
  migrateFilesTable()
    .then(() => {
      console.log("Migration thành công!");
      process.exit(0);
    })
    .catch((error) => {
      console.error("Migration thất bại:", error);
      process.exit(1);
    });
}

module.exports = migrateFilesTable;

