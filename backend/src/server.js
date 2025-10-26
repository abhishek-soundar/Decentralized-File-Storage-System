const fs = require('fs');
const mongoose = require('mongoose');
const app = require('./app');
const config = require('./config');
const logger = require('./utils/logger');

async function start() {
  // ensure temp upload dir exists
  if (!fs.existsSync(config.tempUploadDir)) {
    fs.mkdirSync(config.tempUploadDir, { recursive: true });
    logger.info('Created temp upload dir:', config.tempUploadDir);
  }

  // connect mongo
  try {
    await mongoose.connect(config.mongoUri, { autoIndex: true });
    logger.info('MongoDB connected');
  } catch (err) {
    logger.error('MongoDB connection error', err);
    process.exit(1);
  }

  app.listen(config.port, () => {
    logger.info(`Server running on port ${config.port} — env ${config.env}`);
  });
}

start();
