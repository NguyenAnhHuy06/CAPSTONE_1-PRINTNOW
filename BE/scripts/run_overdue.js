// cap1/BE/scripts/run_overdue.js
require("dotenv").config();
const { __runOverdueNow } = require("../controllers/orders.controller");

(async () => {
  await __runOverdueNow();
  console.log("OK: checkAndNotifyOverdueOrders() executed");
  process.exit(0);
})().catch((e) => {
  console.error("FAILED:", e);
  process.exit(1);
});
