// services/test-email.js
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { sendOTPEmail } = require('./emailService');

sendOTPEmail('YOUR_RECEIVER_EMAIL@gmail.com', '123456', 'registration')
  .then(console.log)
  .catch(console.error);