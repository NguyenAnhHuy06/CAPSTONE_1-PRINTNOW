// middleware/requireRoles.js
module.exports = (...allowed) => {
  const allow = new Set(allowed.map(x => String(x).toLowerCase()));
  return (req, res, next) => {
    const role = String(req.user?.role || "").toLowerCase();
    if (!role) return res.status(401).json({ success: false, message: "UNAUTHORIZED" });
    if (!allow.has(role)) return res.status(403).json({ success: false, message: "FORBIDDEN" });
    next();
  };
};
