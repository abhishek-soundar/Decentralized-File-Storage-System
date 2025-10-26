const morgan = require('morgan');

module.exports = {
  // simple request logger middleware wrapper:
  requestLogger: morgan('combined'),
  info: (...args) => console.log('[info]', ...args),
  error: (...args) => console.error('[error]', ...args)
};
