// scripts/sync-files-db.js
// Script để kiểm tra và đồng bộ giữa database và filesystem
const { sequelize } = require("../config/database");
const File = require("../models/File");
const path = require("path");
const fs = require("fs");
require("dotenv").config();

// Đường dẫn thư mục lưu file
const PRINT_FILES_DIR = path.join(__dirname, "..", "uploads", "print-files");
const ROOT_UPLOADS_DIR = path.join(__dirname, "..", "..", "uploads", "print-files");

// Màu sắc cho console output
const colors = {
  reset: "\x1b[0m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
};

function log(message, color = "reset") {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// Tìm file trên disk từ storageKey hoặc storageUrl
function findFileOnDisk(file) {
  const attemptedPaths = [];

  // Ưu tiên 1: Dùng storageKey
  if (file.storageKey) {
    const normalizedKey = file.storageKey.replace(/\\/g, "/");
    // Nếu storageKey là relative path từ BE
    if (!normalizedKey.startsWith("/")) {
      const keyPath = path.resolve(path.join(__dirname, "..", normalizedKey));
      attemptedPaths.push(keyPath);
      if (fs.existsSync(keyPath)) {
        return { found: true, path: keyPath, method: "storageKey" };
      }
    } else {
      // Nếu storageKey là absolute path
      attemptedPaths.push(normalizedKey);
      if (fs.existsSync(normalizedKey)) {
        return { found: true, path: normalizedKey, method: "storageKey (absolute)" };
      }
    }
  }

  // Ưu tiên 2: Từ storageUrl, extract filename
  if (file.storageUrl) {
    const filename = path.basename(file.storageUrl);
    
    // Thử trong BE/uploads/print-files
    const bePath = path.resolve(path.join(__dirname, "..", "uploads", "print-files", filename));
    attemptedPaths.push(bePath);
    if (fs.existsSync(bePath)) {
      return { found: true, path: bePath, method: "storageUrl (BE/uploads)" };
    }

    // Thử trong root uploads
    const rootPath = path.resolve(path.join(__dirname, "..", "..", "uploads", "print-files", filename));
    attemptedPaths.push(rootPath);
    if (fs.existsSync(rootPath)) {
      return { found: true, path: rootPath, method: "storageUrl (root/uploads)" };
    }
  }

  return { found: false, attemptedPaths };
}

async function syncFiles() {
  try {
    log("=".repeat(60), "cyan");
    log("🔍 BẮT ĐẦU KIỂM TRA VÀ ĐỒNG BỘ FILES", "cyan");
    log("=".repeat(60), "cyan");
    console.log();

    // Kết nối database
    await sequelize.authenticate();
    log("✅ Đã kết nối database", "green");
    console.log();

    // Lấy tất cả files từ database (chưa bị xóa)
    const files = await File.findAll({
      where: {
        isDeleted: false,
      },
      order: [["uploadedAt", "DESC"]],
    });

    log(`📊 Tổng số files trong database: ${files.length}`, "blue");
    console.log();

    if (files.length === 0) {
      log("⚠️  Không có file nào trong database", "yellow");
      return;
    }

    // Thống kê
    let foundCount = 0;
    let missingCount = 0;
    const missingFiles = [];
    const foundFiles = [];

    log("🔍 Đang kiểm tra từng file...", "blue");
    console.log();

    for (const file of files) {
      const result = findFileOnDisk(file);
      
      if (result.found) {
        foundCount++;
        foundFiles.push({
          id: file.id,
          originalName: file.originalName,
          path: result.path,
          method: result.method,
        });
        log(`✅ [${file.id}] ${file.originalName}`, "green");
        log(`   📁 ${result.path}`, "reset");
      } else {
        missingCount++;
        missingFiles.push({
          id: file.id,
          originalName: file.originalName,
          storageKey: file.storageKey,
          storageUrl: file.storageUrl,
          sizeBytes: file.sizeBytes,
          uploadedAt: file.uploadedAt,
          attemptedPaths: result.attemptedPaths,
        });
        log(`❌ [${file.id}] ${file.originalName} - KHÔNG TÌM THẤY`, "red");
        if (file.storageKey) {
          log(`   🔑 storageKey: ${file.storageKey}`, "yellow");
        }
        if (file.storageUrl) {
          log(`   🔗 storageUrl: ${file.storageUrl}`, "yellow");
        }
        log(`   🔍 Đã thử: ${result.attemptedPaths.length} đường dẫn`, "yellow");
      }
    }

    console.log();
    log("=".repeat(60), "cyan");
    log("📊 KẾT QUẢ KIỂM TRA", "cyan");
    log("=".repeat(60), "cyan");
    log(`✅ Files tồn tại: ${foundCount}`, "green");
    log(`❌ Files bị mất: ${missingCount}`, missingCount > 0 ? "red" : "green");
    console.log();

    // Hiển thị chi tiết files bị mất
    if (missingFiles.length > 0) {
      log("=".repeat(60), "red");
      log("⚠️  DANH SÁCH FILES BỊ MẤT", "red");
      log("=".repeat(60), "red");
      console.log();

      missingFiles.forEach((file, index) => {
        log(`${index + 1}. File ID: ${file.id}`, "red");
        log(`   Tên: ${file.originalName}`, "yellow");
        log(`   Kích thước: ${(file.sizeBytes / 1024).toFixed(2)} KB`, "yellow");
        log(`   Upload lúc: ${new Date(file.uploadedAt).toLocaleString("vi-VN")}`, "yellow");
        if (file.storageKey) {
          log(`   storageKey: ${file.storageKey}`, "yellow");
        }
        if (file.storageUrl) {
          log(`   storageUrl: ${file.storageUrl}`, "yellow");
        }
        console.log();
      });

      // Kiểm tra có flag --auto không
      const autoMode = process.argv.includes("--auto") || process.argv.includes("-a");
      
      if (autoMode) {
        log("\n🔄 Chế độ tự động: Đang cập nhật database...", "blue");
        
        for (const file of missingFiles) {
          await File.update(
            { isDeleted: true },
            { where: { id: file.id } }
          );
          log(`   ✅ Đã đánh dấu file ID ${file.id} là deleted`, "green");
        }
        
        log(`\n✅ Đã cập nhật ${missingFiles.length} file(s)`, "green");
      } else {
        // Hỏi có muốn đánh dấu isDeleted không
        const readline = require("readline");
        const rl = readline.createInterface({
          input: process.stdin,
          output: process.stdout,
        });

        await new Promise((resolve) => {
          rl.question(
            `\n${colors.yellow}Bạn có muốn đánh dấu ${missingCount} file(s) này là isDeleted = true? (y/n): ${colors.reset}`,
            async (answer) => {
              try {
                if (answer.toLowerCase() === "y" || answer.toLowerCase() === "yes") {
                  log("\n🔄 Đang cập nhật database...", "blue");
                  
                  for (const file of missingFiles) {
                    await File.update(
                      { isDeleted: true },
                      { where: { id: file.id } }
                    );
                    log(`   ✅ Đã đánh dấu file ID ${file.id} là deleted`, "green");
                  }
                  
                  log(`\n✅ Đã cập nhật ${missingFiles.length} file(s)`, "green");
                } else {
                  log("\n⏭️  Bỏ qua, không cập nhật database", "yellow");
                  log(`💡 Tip: Chạy với flag --auto để tự động đánh dấu: npm run sync-files -- --auto`, "cyan");
                }
              } catch (err) {
                log(`\n❌ Lỗi khi cập nhật: ${err.message}`, "red");
              } finally {
                rl.close();
                resolve();
              }
            }
          );
        });
      }
    } else {
      log("🎉 Tất cả files đều tồn tại trên disk!", "green");
    }
  } catch (error) {
    log(`\n❌ Lỗi: ${error.message}`, "red");
    console.error(error);
    if (sequelize && sequelize.connectionManager) {
      try {
        await sequelize.close().catch(() => {});
      } catch (err) {
        // Ignore
      }
    }
    process.exit(1);
  } finally {
    // Chỉ đóng connection nếu vẫn còn mở
    if (sequelize && sequelize.connectionManager) {
      try {
        await sequelize.close();
        log("\n✅ Đã đóng kết nối database", "green");
      } catch (err) {
        // Ignore nếu đã đóng rồi
      }
    }
  }
}

// Chạy script
if (require.main === module) {
  syncFiles()
    .then(() => {
      log("\n✨ Hoàn thành!", "cyan");
      process.exit(0);
    })
    .catch((error) => {
      log(`\n❌ Lỗi: ${error.message}`, "red");
      console.error(error);
      process.exit(1);
    });
}

module.exports = { syncFiles, findFileOnDisk };

