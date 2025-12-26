````md
# PrintNow System

PrintNow là hệ thống quản lý dịch vụ in ấn trực tuyến (Capstone 1).  
Dự án gồm 2 phần:

- **Backend (BE)**: Node.js/Express + MySQL/Sequelize (cung cấp API)
- **Frontend (FE)**: HTML/CSS/Vanilla JS và được **serve trực tiếp bởi BE** (Express static)

---

## 1) Features

- ✅ OTP verification khi đăng ký / đăng nhập
- ✅ Quên mật khẩu / đặt lại mật khẩu / đổi mật khẩu
- ✅ Upload & phân tích file (PDF, DOCX, PPTX)
- ✅ Tự động đếm số trang
- ✅ Cấu hình in (màu, khổ giấy, 1/2 mặt, đóng gáy, bìa…)
- ✅ Tính giá tự động theo quy tắc
- ✅ Tạo & quản lý đơn hàng
- ✅ Thông báo (Notifications)
- ✅ Quản lý khách hàng (Customers - staff/admin)
- ✅ Dashboard (owner metrics)

---

## 2) Tech Stack

### Backend
- Node.js + Express.js
- MySQL + Sequelize ORM
- JWT authentication
- Nodemailer (Email OTP)
- poppler-utils (PDF processing)

### Frontend
- HTML5 + CSS3 + Vanilla JavaScript
- Fetch API
- **Frontend được serve bởi Backend** (không cần chạy FE server riêng)

---

## 3) Project Structure

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

---

## 4) Quick Start (Windows)

> Thực hiện các lệnh trong thư mục **BE/**.

### Step 1: Install dependencies

```bash
cd BE
npm install
```

### Step 2: Create `.env`

* Copy `BE/env.example` → `BE/.env`
* Chỉnh lại DB/JWT/EMAIL theo máy bạn

Chi tiết xem: `BE/HUONG_DAN_CHAY.md`

### Step 3: Import database schema

Nếu bạn đang ở thư mục `BE/`:

```bash
mysql -u your_db_user -p printnow < mysql-schema.sql
```

### Step 4 (Optional): Seed sample data

```bash
npm run seed-printnow
```

### Step 5: Run server

```bash
npm run dev
# hoặc
npm start
```

---

## 5) Access

* **Frontend** (served by BE): `http://localhost:5000/`
* **API root**: `http://localhost:5000/api`
* **Healthcheck**: `http://localhost:5000/api/health`

### FE Pretty URLs (mapped in `BE/server.js`)

* Login: `http://localhost:5000/login`
* Register: `http://localhost:5000/register`
* Forgot password: `http://localhost:5000/forgot-password`
* Verify OTP: `http://localhost:5000/verify-otp`
* Reset password: `http://localhost:5000/reset-password`

---

## 6) Common API Endpoints

Authentication:

* `POST /api/auth/register`
* `POST /api/auth/verify-otp`
* `POST /api/auth/login`
* `POST /api/auth/forgot-password`
* `POST /api/auth/reset-password`
* `POST /api/auth/change-password`

Catalog / Pricing:

* `GET /api/catalog/paper-sizes`
* `GET /api/catalog/color-modes`
* `GET /api/catalog/sides`
* `GET /api/catalog/price-rules`

Orders / Files:

* `POST /api/file-analyzer/analyze`
* `POST /api/orders/calculate-price`
* `POST /api/orders`

Other:

* `GET /api/profile`
* `GET /api/notifications`
* `GET /api/customers`
* `GET /api/dashboard`
* `GET /api/metrics/about`

---

## 7) Notes

* `uploads/` là dữ liệu runtime (avatars/files), **khuyến nghị không commit**.
* Nếu dùng Gmail để gửi OTP, hãy dùng **App Password** thay vì mật khẩu đăng nhập.

---

## 8) Documentation

* Hướng dẫn chi tiết: `BE/HUONG_DAN_CHAY.md`

---

## 9) License

MIT

```
```
