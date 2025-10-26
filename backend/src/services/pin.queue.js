// src/services/pin.queue.js
const { pinQueue } = require("../queue");
const logger = require("../utils/logger");

/**
 * Adds a pin job to the BullMQ pinQueue.
 * @param {string} fileId - The MongoDB _id of the file document.
 * @param {string} filePath - Absolute path of the assembled file to pin.
 */
async function enqueuePinJob(fileId, filePath) {
  try {
    await pinQueue.add(
      "pin-file",
      { fileId, filePath },
      {
        attempts: 3,
        backoff: { type: "exponential", delay: 5000 },
        removeOnComplete: true,
        removeOnFail: false,
      }
    );
    logger.info(`[pin.queue] Job enqueued for file ${fileId}`);
  } catch (err) {
    logger.error("[pin.queue] Failed to enqueue pin job", err);
    throw err;
  }
}

module.exports = { enqueuePinJob };
