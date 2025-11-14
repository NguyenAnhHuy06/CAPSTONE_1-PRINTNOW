# PrintNow System

Hệ thống quản lý dịch vụ in ấn trực tuyến.

## Tính năng chính

- ✅ Đăng ký/Đăng nhập với OTP verification
- ✅ Upload và phân tích file (PDF, DOCX, PPTX)
- ✅ Tự động đếm số trang
- ✅ Cấu hình in (màu, khổ giấy, 1/2 mặt, đóng gáy, bìa)
- ✅ Tính giá tự động
- ✅ Quản lý đơn hàng

## Công nghệ sử dụng

### Backend
- **Node.js** + **Express.js**
- **MySQL** + **Sequelize ORM**
- **JWT** authentication
- **Nodemailer** cho email OTP
- **Poppler-utils** cho PDF processing

### Frontend
- **HTML5** + **CSS3** + **Vanilla JavaScript**
- **Fetch API** cho HTTP requests

## Cài đặt nhanh

```bash
# 1. Cài đặt dependencies
npm install

# 2. Tạo file .env (xem hướng dẫn trong HUONG_DAN_CHAY.md)
# 3. Import database schema
mysql -u kien -p printnow < mysql-schema.sql

# 4. Chạy server
start-server.bat
```

## Truy cập

- Frontend: http://localhost:5000
- API: http://localhost:5000/api

## Tài liệu

Xem file `HUONG_DAN_CHAY.md` để biết hướng dẫn chi tiết.

## License

MIT
