// config/database.js
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

// config/database.js
const { Sequelize } = require('sequelize');

const required = (name) => {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env: ${name}`);
  return v;
};

const isProd = process.env.NODE_ENV === 'production';

const sequelize = new Sequelize(
  required('DB_NAME'),
  required('DB_USER'),
  required('DB_PASSWORD'),
  {
    host: required('DB_HOST'),
    port: Number(process.env.DB_PORT || 3306),
    dialect: 'mysql',
    // Ghi log câu SQL khi DEV, tắt khi PROD
    logging: !isProd && process.env.SQL_LOG !== 'false' ? console.log : false,

    // Thiết lập pool kết nối
    pool: {
      max: Number(process.env.DB_POOL_MAX || 10),
      min: Number(process.env.DB_POOL_MIN || 0),
      acquire: Number(process.env.DB_POOL_ACQUIRE || 30000),
      idle: Number(process.env.DB_POOL_IDLE || 10000),
      evict: 1000 * 60, // thu hồi kết nối idle mỗi phút
    },

    // Đồng bộ charset/collation
    define: {
      charset: 'utf8mb4',
      collate: 'utf8mb4_unicode_ci',
      timestamps: true,
      underscored: false,
      freezeTableName: true,
    },

    dialectOptions: {
      charset: 'utf8mb4',
      supportBigNumbers: true,
      bigNumberStrings: true,
      // connectTimeout (ms) nếu cần: 10000
    },

    // Ghi/đọc DATETIME theo múi giờ VN (tùy bạn)
    timezone: '+07:00',
  }
);

// Kết nối + (chỉ dev) sync
const connectDB = async () => {
  // retry đơn giản: thử tối đa 5 lần
  const maxAttempts = Number(process.env.DB_CONNECT_RETRIES || 5);
  const delay = (ms) => new Promise((r) => setTimeout(r, ms));
  let attempt = 0;

  while (true) {
    try {
      attempt++;
      console.log(`🔌 Connecting to MySQL (attempt ${attempt}/${maxAttempts})…`);
      await sequelize.authenticate();
       console.log(`✅ MySQL connection established. Using DB: ${sequelize.config.database}`);

      if (!isProd && process.env.DB_AUTO_SYNC !== 'false') {
        console.log('🛠️  Dev mode: running sequelize.sync({ alter: true })…');
        await sequelize.sync({ alter: true });
        console.log('✅ Database synchronized (dev).');
      } else {
        console.log('ℹ️  Production mode: skipping sequelize.sync()');
      }
      break;
    } catch (err) {
      console.error('❌ DB connection failed:', err.message);
      if (attempt >= maxAttempts) {
        console.error('❌ Reached max retry attempts. Exiting.');
        process.exit(1);
      }
      const backoffMs = 2000 * attempt;
      console.log(`⏳ Retry in ${backoffMs}ms…`);
      await delay(backoffMs);
    }
  }
};

module.exports = { sequelize, connectDB };
