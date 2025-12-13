const nodemailer = require('nodemailer');

// Tạo transporter (ưu tiên SMTP_*, fallback EMAIL_*)
const createTransporter = () => {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: Number(process.env.SMTP_PORT || process.env.EMAIL_PORT || 587),
    secure: String(process.env.SMTP_SECURE || 'false') === 'true',
    auth: {
      user: process.env.SMTP_USER || process.env.EMAIL_USER,
      pass: process.env.SMTP_PASS || process.env.EMAIL_PASS,
    }
  });
};

// Tạo OTP 6 chữ số
const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

// Gửi email OTP
const sendOTPEmail = async (email, otp, type = 'registration') => {
  try {
    const transporter = createTransporter();

    const isReset = (type === 'password_reset' || type === 'reset');
    const subject = isReset ? 'Đặt lại mật khẩu - Mã OTP' : 'Xác thực tài khoản - Mã OTP';
    const heading = isReset ? 'Đặt lại mật khẩu' : 'Xác thực tài khoản';
    const intro   = isReset
      ? 'Bạn vừa yêu cầu đặt lại mật khẩu. Vui lòng sử dụng mã OTP sau:'
      : 'Bạn đã đăng ký tài khoản. Vui lòng sử dụng mã OTP sau:';

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333; text-align: center;">${heading}</h2>
        <p>${intro}</p>
        <div style="background-color: #f4f4f4; padding: 20px; text-align: center; margin: 20px 0;">
          <h1 style="color: #007bff; font-size: 32px; margin: 0; letter-spacing: 5px;">${otp}</h1>
        </div>
        <p><strong>Lưu ý:</strong></p>
        <ul>
          <li>Mã OTP có hiệu lực trong 5 phút</li>
          <li>Không chia sẻ mã OTP với bất kỳ ai</li>
        </ul>
        <p>Trân trọng,<br>Đội ngũ hỗ trợ</p>
      </div>
    `;

    const info = await transporter.sendMail({
      from: process.env.SMTP_USER || process.env.EMAIL_USER,
      to: email,
      subject,
      html
    });

    console.log('OTP email sent successfully:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Error sending OTP email:', error);
    return { success: false, error: error.message };
  }
};

module.exports = { generateOTP, sendOTPEmail };
