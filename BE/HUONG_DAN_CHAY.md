````md
# HƯỚNG DẪN CHẠY DỰ ÁN PRINTNOW

Tài liệu này hướng dẫn chạy dự án PrintNow theo đúng cấu trúc repo hiện tại:  
**Backend (BE) serve trực tiếp Frontend static (FE)** bằng Express static (không cần chạy FE server riêng).

---

## 1) YÊU CẦU HỆ THỐNG

- **Node.js**: khuyến nghị **18+** (tối thiểu 14+)
- **MySQL**: 5.7+
- **poppler-utils**: dùng để xử lý PDF (pdftoppm, pdfinfo, ...)

### Kiểm tra nhanh
- Kiểm tra Node:
  ```bash
  node -v
```

* Kiểm tra MySQL:

  ```bash
  mysql --version
  ```
* Kiểm tra Poppler (PDF):

  ```bash
  pdftoppm -v
  ```

> Windows: đảm bảo Poppler đã cài và nằm trong PATH. Nếu vừa thêm PATH, hãy mở terminal mới rồi chạy lại.

---

## 2) CẤU TRÚC DỰ ÁN

```text
project-root/
├── BE/
│   ├── config/
│   ├── controllers/
│   ├── middleware/
│   ├── models/
│   ├── routes/
│   ├── services/
│   ├── scripts/
│   ├── mysql-schema.sql
│   ├── server.js
│   ├── start-server.bat
│   └── env.example
├── FE/
│   └── src/
│       ├── html/
│       ├── css/
│       └── js/
└── uploads/                 # runtime uploads (khuyến nghị ignore khi commit)
```

### FE được serve bởi BE như thế nào?

Trong `BE/server.js` đã cấu hình:

* Serve HTML từ: `FE/src/html` (root `/`)
* Serve CSS từ: `/css` → `FE/src/css`
* Serve JS từ: `/js` → `FE/src/js`
* Serve uploads từ: `/uploads` → `uploads/`

---

## 3) CÀI ĐẶT (BE)

> Thực hiện tất cả các bước dưới đây trong thư mục **BE/**.

### Bước 1: Cài dependencies

```bash
cd BE
npm install
```

---

## 4) CẤU HÌNH MÔI TRƯỜNG (.env)

### Bước 2: Tạo file `.env`

Copy `env.example` thành `.env`:

**Windows (PowerShell / CMD):**

```bash
copy env.example .env
```

Sau đó mở `BE/.env` và cập nhật theo máy bạn.

### Mẫu `.env` tham khảo

```env
# Server
PORT=5000
NODE_ENV=development

# Database
DB_HOST=localhost
DB_PORT=3306
DB_NAME=printnow
DB_USER=your_db_user
DB_PASSWORD=your_mysql_password

# JWT
JWT_SECRET=your-very-secret-key
JWT_EXPIRE=7d

# Email (OTP)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_app_password
EMAIL_FROM=PrintNow <your_email@gmail.com>

# Client URL (tạo link reset password)
CLIENT_URL=http://localhost:5000

# CORS (có thể nhiều origin, phân tách bằng dấu phẩy)
CORS_ORIGIN=http://localhost:5000

# Others
DB_AUTO_SYNC=false
SQL_LOG=true
ADMIN_EMAIL=admin@example.com
STAFF_EMAIL=staff@example.com
```

### Lưu ý bảo mật

* **Không commit `.env`** lên Git/GitHub.
* Nếu dùng Gmail để gửi OTP: dùng **App Password** (Google) thay vì mật khẩu đăng nhập.

---

## 5) TẠO DATABASE & IMPORT SCHEMA

### Bước 3: Tạo database `printnow`

Bạn có thể tạo DB bằng MySQL client:

```sql
CREATE DATABASE printnow CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

### Bước 4: Import schema (đang ở BE/)

```bash
mysql -u your_db_user -p printnow < mysql-schema.sql
```

> Nếu bạn muốn chắc chắn schema đã vào DB: đăng nhập mysql và kiểm tra `SHOW TABLES;`.

---

## 6) SEED DỮ LIỆU (TUỲ CHỌN)

### Bước 5: Seed dữ liệu mẫu

```bash
npm run seed-printnow
```

---

## 7) CHẠY ỨNG DỤNG

### Cách 1 (khuyến nghị): chạy bằng npm scripts

```bash
npm run dev
# hoặc
npm start
```

### Cách 2: chạy bằng BAT (Windows)

Double-click `BE/start-server.bat` hoặc chạy:

```bash
start-server.bat
```

Khi chạy thành công, terminal sẽ hiển thị đại loại:

* Server running on port 5000
* Frontend: [http://localhost:5000](http://localhost:5000)
* API: [http://localhost:5000/api](http://localhost:5000/api)

---

## 8) TRUY CẬP

* **Frontend**: `http://localhost:5000/`
* **API root**: `http://localhost:5000/api`
* **Healthcheck**: `http://localhost:5000/api/health`

### FE Pretty URLs (map sẵn trong `BE/server.js`)

* `/login` → Login.html
* `/register` → Register.html
* `/forgot-password` → Forgot_Password.html
* `/verify-otp` → Verify_OTP.html (server tự dò theo candidates)
* `/reset-password` → Set_New_Password.html
* Một số trang khác (nếu có file tương ứng):

  * `/home`, `/profile`, `/settings`, `/order/history`, `/owner/dashboard`, ...

---

## 9) KIỂM TRA NHANH SAU KHI CHẠY (RECOMMENDED)

Mở lần lượt:

1. Healthcheck:

* `http://localhost:5000/api/health`
  → phải trả JSON `{ ok: true, ... }`

2. API root:

* `http://localhost:5000/api`
  → trả danh sách endpoint gợi ý

3. FE assets:

* `http://localhost:5000/js/apiService.js`
* `http://localhost:5000/css/Login.css`

---

## 10) TROUBLESHOOTING

### 10.1 Port 5000 already in use

```bash
netstat -ano | findstr :5000
taskkill /PID <PID_NUMBER> /F
```

### 10.2 Lỗi DB: ETIMEDOUT / Access denied / Cannot connect

* Kiểm tra MySQL service có đang chạy không
* Kiểm tra `.env`: `DB_HOST, DB_USER, DB_PASSWORD, DB_NAME`
* Đảm bảo user MySQL có quyền với database `printnow`

Gợi ý test nhanh kết nối DB:

```bash
mysql -u your_db_user -p -h localhost -P 3306
```

### 10.3 Lỗi phân tích PDF / không đếm trang PDF

Nguyên nhân thường gặp: thiếu Poppler hoặc chưa vào PATH.

* Kiểm tra:

  ```bash
  pdftoppm -v
  ```
* Nếu không nhận lệnh: cài Poppler và thêm PATH, sau đó mở terminal mới và chạy lại.

### 10.4 Lỗi CORS khi mở từ domain khác

Nếu bạn mở FE từ domain/port khác (ví dụ Live Server `http://127.0.0.1:5500`) thì:

* Thêm origin đó vào `.env`:

  ```env
  CORS_ORIGIN=http://localhost:5000,http://127.0.0.1:5500
  ```
* Restart server.

---

## 11) GỢI Ý CHUẨN HOÁ KHI ĐƯA LÊN GIT/GITHUB

* Không commit `.env`
* Khuyến nghị ignore `uploads/` (runtime data)
* Không để lộ Gmail App Password / JWT secret trong tài liệu public
* Nếu lỡ lộ:

  * đổi DB password
  * đổi `JWT_SECRET`
  * revoke Gmail App Password cũ và tạo cái mới

```
```
