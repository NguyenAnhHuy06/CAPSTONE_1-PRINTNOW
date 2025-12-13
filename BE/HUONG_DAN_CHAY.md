Ok, mình gửi lại nội dung **HUONG_DAN_CHAY.md** dưới dạng markdown thuần để bạn copy dán thẳng:

---

# HƯỚNG DẪN CHẠY DỰ ÁN PRINTNOW

## YÊU CẦU HỆ THỐNG

* **Node.js** v14 trở lên
* **MySQL** 5.7 trở lên
* **Poppler-utils** (cho PDF processing)

---

## CÀI ĐẶT

### 1. Cài đặt Dependencies

Trong thư mục gốc dự án (chứa `package.json`):

```bash
npm install
```

---

### 2. Cấu hình Environment (.env)

Dự án sử dụng file **`.env`** để cấu hình các biến môi trường (database, JWT, email,...).

1. **Copy** file `env.example` thành `.env`:

   ```bash
   cp env.example .env
   # hoặc tự tạo file .env mới và copy nội dung từ env.example
   ```

2. Mở file `.env` và cập nhật lại các giá trị **thật** cho môi trường của bạn.

Ví dụ nội dung `.env` (mô phỏng, KHÔNG dùng giá trị này cho production):

```env
# Cổng server
PORT=5000

# Thông tin MySQL Database
DB_HOST=localhost
DB_PORT=3306
DB_NAME=printnow
DB_USER=your_db_user
DB_PASSWORD=your_mysql_password

# JWT Secret
JWT_SECRET=your-very-secret-key-here-change-this-in-production
JWT_EXPIRE=7d

# Email Configuration (SMTP Gmail)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_app_password
EMAIL_FROM=PrintNow <your_email@gmail.com>

# Client URL (dùng cho link reset password)
CLIENT_URL=http://localhost:5000

# CORS
CORS_ORIGIN=http://localhost:5000

# Khác
NODE_ENV=development
DB_AUTO_SYNC=false
SQL_LOG=true
ADMIN_EMAIL=admin@example.com
STAFF_EMAIL=staff@example.com
```

> 🛑 **Lưu ý quan trọng**
>
> * Không commit file `.env` lên Git/GitHub (đã được cấu hình trong `.gitignore`).
> * Thay `your_mysql_password`, `your_jwt_secret_here`, `your_email@gmail.com`, `your_app_password` bằng thông tin thật trên máy bạn.
> * Nếu dùng Gmail, hãy dùng **App Password**, không dùng mật khẩu đăng nhập tài khoản.

---

### 3. Import Database Schema

Tạo database `printnow` trong MySQL, sau đó chạy:

```bash
mysql -u your_db_user -p printnow < mysql-schema.sql
```

Nhập đúng `your_db_user` và mật khẩu tương ứng với cấu hình trong `.env`.

---

### 4. Seed Database (Tùy chọn)

Để tạo dữ liệu mẫu:

```bash
node scripts/seed-printnow-data.js
```

---

## CHẠY ỨNG DỤNG

### Cách 1: Sử dụng Script (Khuyến nghị nếu đã cấu hình sẵn)

**Double-click** vào file `start-server.bat` hoặc chạy:

```bash
start-server.bat
```

### Cách 2: Chạy thủ công bằng Node

```bash
node server.js
```

Hoặc nếu bạn có script trong `package.json`:

```bash
npm run dev
```

---

## TRUY CẬP ỨNG DỤNG

Sau khi server khởi động thành công:

* **Frontend (Giao diện)**: `http://localhost:5000`
* **Backend API**: `http://localhost:5000/api`

### Một số trang chính (tùy cấu hình FE)

* Login: `http://localhost:5000/Login.html`
* Register: `http://localhost:5000/Register.html`
* Print Document: `http://localhost:5000/PrintDocument.html`

---

## CẤU TRÚC DỰ ÁN

```text
D:\cap1\
├── FE/                    # Frontend
│   ├── html/              # HTML pages
│   ├── css/               # CSS styles
│   └── js/                # JavaScript files
├── config/                # Database config
├── middleware/            # Express middleware
├── models/                # Sequelize models
├── routes/                # API routes
├── services/              # Business logic
├── uploads/               # Uploaded files (được .gitignore)
├── scripts/               # Scripts seed database, tạo bảng, v.v.
├── server.js              # Main server file
├── start-server.bat       # Startup script (Windows)
├── package.json           # Dependencies & scripts
└── env.example            # Mẫu cấu hình môi trường
```

---

## CHỨC NĂNG CHÍNH

### 1. Authentication

* Đăng ký với OTP verification qua email
* Đăng nhập
* Quên mật khẩu
* Đổi mật khẩu

### 2. Print Service

* Upload file (PDF, DOCX, DOC, PPTX, PPT)
* Tự động đếm số trang
* Chọn cấu hình in (màu, khổ giấy, 1/2 mặt, đóng gáy, bìa)
* Tính giá tự động
* Tạo đơn hàng

### 3. Profile Management

* Xem thông tin cá nhân
* Cập nhật thông tin

---

## TROUBLESHOOTING

### Lỗi: `connect ETIMEDOUT`

**Nguyên nhân**: Không kết nối được database.

**Giải pháp**:

1. Kiểm tra MySQL server có đang chạy không.
2. Kiểm tra thông tin trong file `.env` (DB_HOST, DB_USER, DB_PASSWORD, DB_NAME).
3. Kiểm tra firewall/network nếu DB không ở localhost.

---

### Lỗi: "Không thể phân tích file PDF"

**Nguyên nhân**: Poppler-utils chưa được cài đặt hoặc chưa có trong PATH.

**Giải pháp**:

1. Kiểm tra Poppler đã cài chưa: `pdftoppm -v`
2. Thêm thư mục cài Poppler vào PATH (đã có trong `start-server.bat` nếu bạn cấu hình).
3. Khởi động lại server.

---

### Lỗi: `Port 5000 already in use`

**Giải pháp**:

```bash
# Tìm process đang dùng port 5000
netstat -ano | findstr :5000

# Kill process
taskkill /PID <PID_NUMBER> /F
```

---

## PHÁT TRIỂN

### Một số endpoint API chính

* `POST /api/auth/register` - Đăng ký
* `POST /api/auth/verify-otp` - Verify OTP
* `POST /api/auth/login` - Đăng nhập
* `POST /api/auth/forgot-password` - Quên mật khẩu
* `POST /api/auth/reset-password` - Đặt lại mật khẩu
* `POST /api/auth/change-password` - Đổi mật khẩu
* `GET /api/profile` - Lấy thông tin profile
* `POST /api/file-analyzer/analyze` - Phân tích file
* `GET /api/catalog` - Lấy catalog (paper sizes, colors, sides)
* `POST /api/orders/calculate-price` - Tính giá
* `POST /api/orders` - Tạo đơn hàng

### Database Models

* `User` - Người dùng
* `OTP` - Mã OTP
* `Order` - Đơn hàng
* `OrderItem` - Chi tiết đơn hàng
* `File` - File đã upload
* `PaperSize` - Khổ giấy
* `ColorMode` - Màu in
* `Side` - 1 mặt/2 mặt
* `PriceRule` - Quy tắc tính giá

---

## LƯU Ý VỀ BẢO MẬT KHI ĐƯA LÊN GIT/GITHUB

1. **Không commit file `.env`** (đã có trong `.gitignore`).
2. Chỉ commit file `env.example` với giá trị giả.
3. Không ghi mật khẩu thật / app password / JWT secret thật vào tài liệu public.
4. Nếu lỡ để lộ mật khẩu / app password:

   * Đổi password DB
   * Thay JWT_SECRET mới
   * Revoke Gmail App Password cũ và tạo cái mới

---

**Chúc bạn sử dụng và phát triển dự án thành công! 🎉**
