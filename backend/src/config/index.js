const path = require('path');
require('dotenv').config();

const get = (k, fallback) => process.env[k] ?? fallback;

module.exports = {
  env: get('NODE_ENV', 'development'),
  port: Number(get('PORT', 4000)),
  mongoUri: get('MONGO_URI', 'mongodb://localhost:27017/dfs'),
  jwtSecret: get('JWT_SECRET', 'change_this_secret'),
  jwtExpiresIn: get('JWT_EXPIRES_IN', '1d'),

  // Pinata + Web3.Storage settings
  pinataApiKey: get('PINATA_API_KEY', ''),
  pinataApiSecret: get('PINATA_API_SECRET', ''),
  pinataJwt: get('PINATA_JWT', ''),

  web3StorageToken: get('WEB3_STORAGE_TOKEN', ''),

  maxUploadBytes: Number(get('MAX_UPLOAD_SIZE_BYTES', 524288000)),
  tempUploadDir: path.resolve(get('TEMP_UPLOAD_DIR', './tmp/uploads')),
  allowedMimeTypes: (get('ALLOWED_MIMETYPES', '')).split(',').map(s => s.trim()).filter(Boolean)
};
