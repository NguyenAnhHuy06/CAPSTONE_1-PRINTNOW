// scripts/create-otps-table.js
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const { sequelize } = require('../config/database');
const OTP = require('../models/OTP'); // => đảm bảo file này nằm ở models/OTP.js

(async () => {
  try {
    console.log('🔧 Syncing OTP table...');
    await sequelize.authenticate();
    await OTP.sync({ alter: true });
    console.log('✅ OTP table is ready.');
    process.exit(0);
  } catch (err) {
    console.error('❌ Failed to create/sync OTP table:', err.message);
    process.exit(1);
  }
})();
