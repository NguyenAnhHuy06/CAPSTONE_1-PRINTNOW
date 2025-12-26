// config/jwt.js
function mustEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

module.exports = {
  JWT_SECRET: mustEnv("JWT_SECRET"),
  JWT_EXPIRE: process.env.JWT_EXPIRE || "7d",
};
