// controllers/settings.controller.js
// Controller for managing user settings
const { validationResult } = require('express-validator');
const { UserSetting } = require('../models');

exports.getMySettings = async (req, res) => {
  try {
    const userId = req.user.id;

    let setting = await UserSetting.findOne({ where: { userId } });
    if (!setting) {
      setting = await UserSetting.create({
        userId,
        language: 'en',
        notifyEmail: true,
        notifySms: false,
      });
    }
    res.json({ success: true, setting: setting.toJSON() });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, message: 'GET_SETTINGS_FAILED' });
  }
};

exports.updateMySettings = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty())
    return res.status(400).json({ success: false, errors: errors.array() });

  try {
    const userId = req.user.id;
    const { language, notifyEmail, notifySms } = req.body;

    const [setting, created] = await UserSetting.findOrCreate({
      where: { userId },
      defaults: { userId, language: 'en', notifyEmail: true, notifySms: false },
    });

    if (!created) {
      if (language !== undefined) setting.language = language;
      if (notifyEmail !== undefined) setting.notifyEmail = !!notifyEmail;
      if (notifySms !== undefined) setting.notifySms = !!notifySms;
      await setting.save();
    }

    res.json({ success: true, setting: setting.toJSON() });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, message: 'UPDATE_SETTINGS_FAILED' });
  }
};
