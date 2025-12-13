// services/streamAuth.js
const jwt = require('jsonwebtoken');
const User = require('../models/User');

module.exports = async function (req, res, next) {
    try {
        const token = req.query?.token || req.header('Authorization')?.replace('Bearer ', '') || req.cookies?.auth;
        if (!token) return res.status(401).end();
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret');
        const user = await User.findByPk(decoded.id);
        if (!user || !user.isActive || !user.emailVerified) return res.status(401).end();
        req.user = user;
        next();
    } catch {
        res.status(401).end();
    }
}
