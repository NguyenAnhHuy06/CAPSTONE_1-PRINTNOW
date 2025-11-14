// routes/settings.routes.js
// Routes for user settings management
const router = require('express').Router();
const auth = require('../middleware/auth');
const { updateSettingsRules } = require('../middleware/validators');
const ctrl = require('../controllers/settings.controller');

router.get('/me', auth, ctrl.getMySettings);
router.put('/me', auth, updateSettingsRules, ctrl.updateMySettings);

module.exports = router;
