// src/middlewares/error.middleware.js
const logger = require('../utils/logger');

function errorHandler(err, req, res, next) {
  logger.error(err && err.stack ? err.stack : err);
  const status = err.status || err.statusCode || 500;

  const payload = {
    ok: false,
    error: err.message || 'Internal server error'
  };

  // include validation details if present (from validate.middleware)
  if (err.details) {
    payload.details = err.details;
  }

  res.status(status).json(payload);
}

module.exports = errorHandler;
