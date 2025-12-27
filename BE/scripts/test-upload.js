// scripts/test-upload.js
// Script để kiểm tra xem file upload có được lưu đúng không
const { sequelize } = require("../config/database");
const File = require("../models/File");
const path = require("path");
const fs = require("fs");
require("dotenv").config();

const PRINT_FILES_DIR = path.join(__dirname, "..", "uploads", "print-files");

async function testUpload() {
  try {
    console.log("=".repeat(60));
    console.log("🔍 KIỂM TRA UPLOAD FILES");
    console.log("=".repeat(60));
    console.log();

    // 1. Kiểm tra thư mục upload
    console.log("1️⃣  Kiểm tra thư mục upload:");
    console.log(`   📁 Thư mục: ${PRINT_FILES_DIR}`);
    const dirExists = fs.existsSync(PRINT_FILES_DIR);
    console.log(`   ${dirExists ? "✅" : "❌"} Thư mục ${dirExists ? "tồn tại" : "KHÔNG tồn tại"}`);
    
    if (dirExists) {
      const files = fs.readdirSync(PRINT_FILES_DIR);
      console.log(`   📊 Số file trên disk: ${files.length}`);
      if (files.length > 0) {
        console.log(`   📄 Files:`);
        files.slice(0, 5).forEach((f, i) => {
          const filePath = path.join(PRINT_FILES_DIR, f);
          const stats = fs.statSync(filePath);
          console.log(`      ${i + 1}. ${f} (${(stats.size / 1024).toFixed(2)} KB)`);
        });
        if (files.length > 5) {
          console.log(`      ... và ${files.length - 5} file khác`);
        }
      }
    } else {
      console.log("   ⚠️  Tạo thư mục...");
      fs.mkdirSync(PRINT_FILES_DIR, { recursive: true });
      console.log("   ✅ Đã tạo thư mục");
    }
    console.log();

    // 2. Kiểm tra database
    await sequelize.authenticate();
    console.log("2️⃣  Kiểm tra database:");
    console.log("   ✅ Đã kết nối database");

    const totalFiles = await File.count();
    console.log(`   📊 Tổng số files trong DB: ${totalFiles}`);

    const activeFiles = await File.count({ where: { isDeleted: false } });
    console.log(`   ✅ Files chưa bị xóa: ${activeFiles}`);

    const deletedFiles = await File.count({ where: { isDeleted: true } });
    console.log(`   🗑️  Files đã bị xóa: ${deletedFiles}`);
    console.log();

    // 3. Kiểm tra files gần đây
    if (activeFiles > 0) {
      console.log("3️⃣  Files gần đây nhất (5 files):");
      const recentFiles = await File.findAll({
        where: { isDeleted: false },
        order: [["uploadedAt", "DESC"]],
        limit: 5,
      });

      for (const file of recentFiles) {
        console.log(`   📄 File ID: ${file.id}`);
        console.log(`      Tên: ${file.originalName}`);
        console.log(`      storageKey: ${file.storageKey}`);
        console.log(`      storageUrl: ${file.storageUrl}`);
        
        // Kiểm tra file có tồn tại không
        let found = false;
        let foundPath = null;
        
        // Thử với storageKey
        if (file.storageKey) {
          const normalizedKey = file.storageKey.replace(/\\/g, "/");
          if (!normalizedKey.startsWith("/")) {
            const keyPath = path.resolve(path.join(__dirname, "..", normalizedKey));
            if (fs.existsSync(keyPath)) {
              found = true;
              foundPath = keyPath;
            }
          }
        }
        
        // Thử với storageUrl
        if (!found && file.storageUrl) {
          const filename = path.basename(file.storageUrl);
          const bePath = path.resolve(path.join(__dirname, "..", "uploads", "print-files", filename));
          if (fs.existsSync(bePath)) {
            found = true;
            foundPath = bePath;
          }
        }
        
        console.log(`      ${found ? "✅" : "❌"} File ${found ? "tồn tại" : "KHÔNG tồn tại"} trên disk`);
        if (found) {
          const stats = fs.statSync(foundPath);
          console.log(`      📁 Đường dẫn: ${foundPath}`);
          console.log(`      📏 Kích thước: ${(stats.size / 1024).toFixed(2)} KB`);
        }
        console.log();
      }
    }

    // 4. Thống kê
    console.log("4️⃣  Thống kê:");
    const filesWithOrder = await File.count({ where: { orderId: { [require("sequelize").Op.ne]: null } } });
    const filesWithoutOrder = await File.count({ where: { orderId: null } });
    console.log(`   📦 Files đã gắn với order: ${filesWithOrder}`);
    console.log(`   📄 Files chưa gắn với order: ${filesWithoutOrder}`);
    console.log();

    console.log("=".repeat(60));
    console.log("✅ Hoàn thành kiểm tra!");
    console.log("=".repeat(60));

  } catch (error) {
    console.error("❌ Lỗi:", error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

if (require.main === module) {
  testUpload()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = { testUpload };

