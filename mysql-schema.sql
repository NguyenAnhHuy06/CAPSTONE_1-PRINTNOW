-- =============================================
-- Schema MySQL cho hệ thống in ấn
-- =============================================

-- Tạo database
CREATE DATABASE IF NOT EXISTS printing_system 
CHARACTER SET utf8mb4 
COLLATE utf8mb4_unicode_ci;

USE printing_system;

-- ======================
-- A. USERS (tài khoản)
-- ======================
CREATE TABLE IF NOT EXISTS users (
  id              BIGINT AUTO_INCREMENT PRIMARY KEY,
  name            VARCHAR(255)       NOT NULL,
  email           VARCHAR(255)       NOT NULL UNIQUE,
  phone           VARCHAR(50),
  password        VARCHAR(255)       NOT NULL,
  role            ENUM('customer', 'staff', 'admin') NOT NULL DEFAULT 'customer',
  address         TEXT,
  avatar          VARCHAR(255)       DEFAULT '',
  isActive        TINYINT(1)         NOT NULL DEFAULT 1,
  isVerified      TINYINT(1)         NOT NULL DEFAULT 0,
  resetPasswordToken VARCHAR(255),
  resetPasswordExpire DATETIME,
  failedLogins    INT                NOT NULL DEFAULT 0,
  lastLoginAt     DATETIME           NULL,
  createdAt       DATETIME           NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt       DATETIME           NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Indexes cho users
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_phone ON users(phone);
CREATE INDEX idx_users_isActive ON users(isActive);
CREATE INDEX idx_users_isVerified ON users(isVerified);

-- ===========================================
-- B. EMAIL_OTPS (mã OTP xác minh qua email)
-- ===========================================
CREATE TABLE IF NOT EXISTS email_otps (
  id              BIGINT AUTO_INCREMENT PRIMARY KEY,
  userId          BIGINT NOT NULL,
  email           VARCHAR(255) NOT NULL,
  otp             CHAR(6)     NOT NULL,
  type            ENUM('registration', 'password_reset') NOT NULL DEFAULT 'registration',
  expiresAt       DATETIME    NOT NULL,
  isUsed          TINYINT(1)  NOT NULL DEFAULT 0,
  attempts        INT         NOT NULL DEFAULT 0,
  consumedAt      DATETIME    NULL,
  resendCount     INT         NOT NULL DEFAULT 0,
  lastSentAt      DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  purpose         ENUM('SIGN_UP','FORGOT_PASSWORD','CHANGE_EMAIL') NOT NULL DEFAULT 'SIGN_UP',
  createdAt       DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt       DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_email_otps_user FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Indexes cho email_otps
CREATE INDEX idx_email_otps_user_expires ON email_otps(userId, expiresAt);
CREATE INDEX idx_email_otps_email ON email_otps(email);
CREATE INDEX idx_email_otps_purpose ON email_otps(purpose);

-- ===========================================
-- C. FILES (quản lý file upload)
-- ===========================================
CREATE TABLE IF NOT EXISTS files (
  id              BIGINT AUTO_INCREMENT PRIMARY KEY,
  userId          BIGINT NOT NULL,
  originalName    VARCHAR(255) NOT NULL,
  fileName        VARCHAR(255) NOT NULL,
  filePath        VARCHAR(500) NOT NULL,
  fileSize        BIGINT NOT NULL,
  fileType        VARCHAR(100) NOT NULL,
  status          ENUM('uploaded', 'processing', 'ready', 'printed', 'cancelled') NOT NULL DEFAULT 'uploaded',
  copies          INT NOT NULL DEFAULT 1,
  color           ENUM('color', 'black-white') NOT NULL DEFAULT 'black-white',
  paperSize       ENUM('A4', 'A3', 'Letter') NOT NULL DEFAULT 'A4',
  orientation     ENUM('portrait', 'landscape') NOT NULL DEFAULT 'portrait',
  notes           TEXT,
  createdAt       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_files_user FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Indexes cho files
CREATE INDEX idx_files_user_id ON files(userId);
CREATE INDEX idx_files_status ON files(status);
CREATE INDEX idx_files_created_at ON files(createdAt);

-- ===========================================
-- D. INSERT DỮ LIỆU MẪU
-- ===========================================

-- Insert sample users
INSERT INTO users (name, email, phone, password, role, address, isVerified, isActive) VALUES
('Admin User', 'admin@example.com', '0123456789', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'admin', '123 Admin Street, District 1, HCMC', 1, 1),
('Staff User', 'staff@example.com', '0987654321', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'staff', '456 Staff Avenue, District 2, HCMC', 1, 1),
('Customer User', 'customer@example.com', '0555666777', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'customer', '789 Customer Road, District 3, HCMC', 1, 1);

-- ===========================================
-- E. STORED PROCEDURES
-- ===========================================

-- Procedure để cleanup OTP hết hạn
DELIMITER //
CREATE PROCEDURE SP_CleanupExpiredOTPs()
BEGIN
    DELETE FROM email_otps 
    WHERE expiresAt < NOW() AND consumedAt IS NOT NULL;
END //
DELIMITER ;

-- Procedure để get user by email
DELIMITER //
CREATE PROCEDURE SP_GetUserByEmail(IN user_email VARCHAR(255))
BEGIN
    SELECT 
        id,
        name,
        email,
        role,
        phone,
        address,
        avatar,
        isActive,
        isVerified,
        createdAt
    FROM users 
    WHERE email = user_email;
END //
DELIMITER ;

-- Procedure để get user files với pagination
DELIMITER //
CREATE PROCEDURE SP_GetUserFiles(
    IN user_id BIGINT,
    IN page_num INT,
    IN page_size INT
)
BEGIN
    DECLARE offset_val INT;
    SET offset_val = (page_num - 1) * page_size;
    
    SELECT 
        f.id,
        f.originalName,
        f.fileSize,
        f.fileType,
        f.status,
        f.copies,
        f.color,
        f.paperSize,
        f.orientation,
        f.notes,
        f.createdAt,
        f.updatedAt
    FROM files f
    WHERE f.userId = user_id
    ORDER BY f.createdAt DESC
    LIMIT page_size OFFSET offset_val;
END //
DELIMITER ;

-- ===========================================
-- F. VIEWS
-- ===========================================

-- View để thống kê user files
CREATE VIEW vw_user_files AS
SELECT 
    u.id AS UserId,
    u.name AS UserName,
    u.email AS UserEmail,
    u.role AS UserRole,
    COUNT(f.id) AS TotalFiles,
    SUM(f.fileSize) AS TotalFileSize,
    MAX(f.createdAt) AS LastFileUpload
FROM users u
LEFT JOIN files f ON u.id = f.userId
GROUP BY u.id, u.name, u.email, u.role;

-- View để thống kê OTP
CREATE VIEW vw_otp_stats AS
SELECT 
    purpose,
    COUNT(*) AS TotalOTPs,
    COUNT(CASE WHEN consumedAt IS NOT NULL THEN 1 END) AS UsedOTPs,
    COUNT(CASE WHEN consumedAt IS NULL AND expiresAt > NOW() THEN 1 END) AS ActiveOTPs,
    COUNT(CASE WHEN consumedAt IS NULL AND expiresAt <= NOW() THEN 1 END) AS ExpiredOTPs
FROM email_otps
GROUP BY purpose;

-- ===========================================
-- G. TRIGGERS
-- ===========================================

-- Trigger để tự động cập nhật updated_at
DELIMITER //
CREATE TRIGGER tr_users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW
BEGIN
    SET NEW.updatedAt = NOW();
END //
DELIMITER ;

DELIMITER //
CREATE TRIGGER tr_files_updated_at
BEFORE UPDATE ON files
FOR EACH ROW
BEGIN
    SET NEW.updatedAt = NOW();
END //
DELIMITER ;

DELIMITER //
CREATE TRIGGER tr_email_otps_updated_at
BEFORE UPDATE ON email_otps
FOR EACH ROW
BEGIN
    SET NEW.updatedAt = NOW();
END //
DELIMITER ;

-- ===========================================
-- H. EVENTS (tự động cleanup)
-- ===========================================

-- Event để cleanup OTP hết hạn hàng ngày
DELIMITER //
CREATE EVENT IF NOT EXISTS evt_cleanup_expired_otps
ON SCHEDULE EVERY 1 DAY
STARTS CURRENT_TIMESTAMP
DO
BEGIN
    CALL SP_CleanupExpiredOTPs();
END //
DELIMITER ;

-- Bật event scheduler
SET GLOBAL event_scheduler = ON;

SELECT 'MySQL database setup completed successfully!' AS message;
SELECT 'Database: printing_system' AS info;
SELECT 'Tables: users, email_otps, files' AS info;
SELECT 'Sample data: 3 users created' AS info;
SELECT 'Password for all sample users: password' AS info;