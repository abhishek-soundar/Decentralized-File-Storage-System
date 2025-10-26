// src/middlewares/rate.middleware.js
const rateLimit = require('express-rate-limit');

const createLimiter = (opts) => {
  return rateLimit({
    windowMs: opts.windowMs || 15 * 60 * 1000, // default 15 minutes
    max: opts.max || 100, // default 100 requests per window per IP
    standardHeaders: true,
    legacyHeaders: false,
    message: { ok: false, error: 'Too many requests, please try again later.' },
    ...opts.extra
  });
};

module.exports = { createLimiter };
