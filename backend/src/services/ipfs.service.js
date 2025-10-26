// src/services/ipfs.service.js
const logger = require('../utils/logger');
const config = require('../config');

let pinataService = null;
try {
  pinataService = require('./pinata.service');
} catch (e) {
  // no pinata.service available — we'll handle below
  pinataService = null;
}

/**
 * uploadFileFromPath(filePath)
 * - Uses Pinata when configured.
 * - Future: add other providers (web3.storage) as fallbacks here.
 */
async function uploadFileFromPath(filePath) {
  // prefer PINATA_JWT or PINATA_API_KEY+PINATA_API_SECRET
  const hasJwt = !!(config.pinataJwt && config.pinataJwt.length > 10);
  const hasKeySecret = !!(config.pinataApiKey && config.pinataApiSecret);

  if (pinataService && (hasJwt || hasKeySecret)) {
    logger.info('[ipfs.service] Using Pinata for upload. jwt?', hasJwt, 'key+secret?', hasKeySecret);
    return pinataService.pinFile(filePath);
  }

  // helpful diagnostic error
  const details = [
    `PINATA_JWT=${hasJwt ? 'SET' : 'NOT_SET'}`,
    `PINATA_API_KEY=${hasKeySecret ? 'SET' : 'NOT_SET'}`
  ].join(' | ');

  throw new Error(`No IPFS provider configured. Please set PINATA_JWT or PINATA_API_KEY & PINATA_API_SECRET. (${details})`);
}

async function getStatus() {
  return {
    pinata: !!(pinataService && (config.pinataJwt || (config.pinataApiKey && config.pinataApiSecret))),
    details: {
      pinataJwt: !!config.pinataJwt,
      pinataApiKey: !!config.pinataApiKey,
      pinataApiSecret: !!config.pinataApiSecret
    }
  };
}

module.exports = { uploadFileFromPath, getStatus };
