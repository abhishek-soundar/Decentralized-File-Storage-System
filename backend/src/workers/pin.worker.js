// src/workers/pin.worker.js
const mongoose = require('mongoose');
const config = require('../config');
const { Worker } = require('bullmq');
const {
  pinQueue,
  unpinQueue,
  verifyQueue,
  thumbQueue,
  connection: redisConnection
} = require('../queue');
const pinataService = require('../services/pinata.service');
const FileModel = require('../models/file.model');
const { sha256OfFile } = require('../services/hash.service');
const logger = require('../utils/logger');
const path = require('path');
const fs = require('fs').promises;
const streamPipeline = require('stream').pipeline;
const { promisify } = require('util');
const pump = promisify(streamPipeline);
const sharp = require('sharp');

const PUB_CHANNEL = 'dfsd:jobs';

async function publishEvent(type, payload) {
  try {
    const message = JSON.stringify({ type, ...payload });
    logger.info('[worker.publish] publishing', { channel: PUB_CHANNEL, type, fileId: payload?.fileId });
    // publish returns number of clients that received the message (ioredis)
    const res = await redisConnection.publish(PUB_CHANNEL, message);
    logger.info('[worker.publish] publish result', { channel: PUB_CHANNEL, type, fileId: payload?.fileId, result: res });
  } catch (e) {
    logger.error('[worker.publish] publish failed', e && e.message);
  }
}


async function ensureTempDir() {
  try {
    await fs.mkdir(config.tempUploadDir, { recursive: true });
    const thumbs = path.join(config.tempUploadDir, 'thumbs');
    await fs.mkdir(thumbs, { recursive: true });
  } catch (e) {
    // ignore
  }
}

async function startWorkers() {
  // connect to MongoDB
  try {
    await mongoose.connect(config.mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    logger.info('Worker connected to MongoDB');
  } catch (err) {
    console.error('Worker failed to connect to MongoDB', err);
    process.exit(1);
  }

  await ensureTempDir();

  // PIN worker
  const pinWorker = new Worker(
    pinQueue.name,
    async (job) => {
      const { fileId, filePath } = job.data;
      logger.info('[pin.worker] Starting PIN job', job.id, fileId);

      const fileDoc = await FileModel.findById(fileId).lean();
      const ownerId = fileDoc ? String(fileDoc.owner) : null;
      await publishEvent('pin:start', { jobId: job.id, fileId, ownerId });

      try {
        const cid = await pinataService.pinFile(filePath);
        const pinMeta = { name: 'pinata', pinId: cid, pinnedAt: new Date() };

        await FileModel.findByIdAndUpdate(
          fileId,
          {
            cid,
            pinned: true,
            pinProviders: [pinMeta],
            status: 'available'
          },
          { new: true }
        );

        logger.info('[pin.worker] Pin successful', job.id, cid);
        await publishEvent('pin:success', { jobId: job.id, fileId, ownerId, cid });

        // if this is an image, enqueue thumbnail generation
        if (fileDoc && fileDoc.mimeType && fileDoc.mimeType.startsWith('image/')) {
          await thumbQueue.add(
            'generate-thumb',
            { fileId: String(fileId), cid, ownerId },
            { attempts: 3, backoff: { type: 'exponential', delay: 3000 } }
          );
          await publishEvent('thumb:queued', { fileId, ownerId });
        }

        if (filePath) {
          await fs.unlink(filePath).catch(() => {});
        }

        return { ok: true, cid };
      } catch (err) {
        logger.error('[pin.worker] Pin failed', job.id, err && err.message);
        if (fileId) {
          await FileModel.findByIdAndUpdate(fileId, { status: 'failed' });
        }
        await publishEvent('pin:failed', { jobId: job.id, fileId, ownerId, error: err.message || '' });
        throw err;
      }
    },
    { connection: pinQueue.client ? pinQueue.client : undefined, concurrency: 2 }
  );

  pinWorker.on('failed', (job, err) => {
    logger.error('[pin.worker] Job failed', job.id, err.message || err);
  });

  // UNPIN worker (unchanged behavior, publishes events)
  const unpinWorker = new Worker(
    unpinQueue.name,
    async (job) => {
      const { fileId, cid } = job.data;
      logger.info('[unpin.worker] Starting UNPIN job', job.id, cid);

      const fileDoc = await FileModel.findById(fileId).lean();
      const ownerId = fileDoc ? String(fileDoc.owner) : null;
      await publishEvent('unpin:start', { jobId: job.id, fileId, ownerId, cid });

      try {
        await pinataService.unpin(cid);

        await FileModel.findByIdAndUpdate(fileId, {
          $set: { pinned: false, status: 'available' },
          $pull: { pinProviders: { pinId: cid } }
        });

        logger.info('[unpin.worker] Unpin successful', job.id, cid);
        await publishEvent('unpin:success', { jobId: job.id, fileId, ownerId, cid });
        return { ok: true };
      } catch (err) {
        logger.error('[unpin.worker] Unpin failed', job.id, err && err.message);
        await publishEvent('unpin:failed', { jobId: job.id, fileId, ownerId, cid, error: err.message || '' });
        throw err;
      }
    },
    { connection: unpinQueue.client ? unpinQueue.client : undefined, concurrency: 2 }
  );

  unpinWorker.on('failed', (job, err) => {
    logger.error('[unpin.worker] Job failed', job.id, err.message || err);
  });

  // VERIFY worker (unchanged, publishes events)
  const verifyWorker = new Worker(
    verifyQueue.name,
    async (job) => {
      const { fileId } = job.data;
      logger.info('[verify.worker] Starting VERIFY job', job.id, fileId);

      const file = await FileModel.findById(fileId);
      const ownerId = file ? String(file.owner) : null;
      await publishEvent('verify:start', { jobId: job.id, fileId, ownerId });

      if (!file) {
        logger.error('[verify.worker] File not found', fileId);
        await publishEvent('verify:failed', { jobId: job.id, fileId, ownerId, error: 'File not found' });
        throw new Error('File not found');
      }

      const tmpName = `verify-${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${file.filename}`;
      const tmpPath = path.join(config.tempUploadDir, tmpName);

      try {
        const { stream } = await pinataService.fetchFileStream(file.cid);
        await pump(stream, require('fs').createWriteStream(tmpPath));

        const computed = await sha256OfFile(tmpPath);
        const ok = file.sha256 && file.sha256 === computed;

        await FileModel.findByIdAndUpdate(fileId, {
          lastVerifiedAt: new Date(),
          lastVerifiedSha256: computed,
          verified: !!ok,
          verificationPending: false
        });

        logger.info('[verify.worker] Verify done', job.id, { fileId, verified: ok });
        await publishEvent('verify:success', { jobId: job.id, fileId, ownerId, verified: !!ok, computedSha256: computed });

        await fs.unlink(tmpPath).catch(() => {});
        return { ok: true, verified: ok, computedSha256: computed };
      } catch (err) {
        try {
          await FileModel.findByIdAndUpdate(fileId, {
            verificationPending: false,
            lastVerifiedAt: new Date(),
            lastVerifiedSha256: null,
            verified: false
          });
        } catch (uerr) {
          logger.error('[verify.worker] Failed to update failure state', uerr && uerr.message);
        }

        try { await fs.unlink(tmpPath).catch(()=>{}); } catch(e){}

        logger.error('[verify.worker] Verify failed', job.id, err && err.message);
        await publishEvent('verify:failed', { jobId: job.id, fileId, ownerId, error: err.message || '' });
        throw err;
      }
    },
    { connection: verifyQueue.client ? verifyQueue.client : undefined, concurrency: 1 }
  );

  verifyWorker.on('failed', (job, err) => {
    logger.error('[verify.worker] Job failed', job.id, err.message || err);
  });

  // THUMBNAIL worker
  const thumbWorker = new Worker(
    thumbQueue.name,
    async (job) => {
      const { fileId, cid, ownerId } = job.data;
      logger.info('[thumb.worker] Starting THUMB job', job.id, fileId);
      await publishEvent('thumb:start', { jobId: job.id, fileId, ownerId });

      // build paths
      const tmpName = `thumb-${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${fileId}.webp`;
      const tmpPath = path.join(config.tempUploadDir, 'thumbs', tmpName);

      try {
        // Fetch original from Pinata (stream)
        const { stream } = await pinataService.fetchFileStream(cid);

        // Read into sharp directly via stream to avoid writing full original to disk
        // but pinataService gives us a stream; we can pipe into a temp file first (safer) then process.
        const originalPath = path.join(config.tempUploadDir, `orig-${fileId}-${Date.now()}`);
        await pump(stream, require('fs').createWriteStream(originalPath));

        // create thumbnail (resize to 400px wide max, keep aspect ratio) and convert to webp
        const image = sharp(originalPath);
        const metadata = await image.metadata();

        const thumbBuffer = await image
          .resize({ width: 400, withoutEnlargement: true })
          .webp({ quality: 70 })
          .toBuffer();

        // write thumbnail to tmpPath
        await fs.writeFile(tmpPath, thumbBuffer);

        // pin thumbnail to Pinata
        const thumbCid = await pinataService.pinFile(tmpPath);

        // update DB: add thumbnail info to file doc
        await FileModel.findByIdAndUpdate(fileId, {
          $set: {
            thumbnail: {
              cid: thumbCid,
              format: 'webp',
              width: metadata.width,
              height: metadata.height,
              generatedAt: new Date()
            }
          }
        });

        logger.info('[thumb.worker] Thumb successful', job.id, { fileId, thumbCid });
        await publishEvent('thumb:success', { jobId: job.id, fileId, ownerId, thumbCid });

        // cleanup
        await fs.unlink(originalPath).catch(() => {});
        await fs.unlink(tmpPath).catch(() => {});

        return { ok: true, thumbCid };
      } catch (err) {
        logger.error('[thumb.worker] Thumb failed', job.id, err && err.message);
        await publishEvent('thumb:failed', { jobId: job.id, fileId, ownerId, error: err.message || '' });
        // cleanup if any partial files
        try { await fs.unlink(tmpPath).catch(()=>{}); } catch(e){}
        throw err;
      }
    },
    { connection: thumbQueue.client ? thumbQueue.client : undefined, concurrency: 1 }
  );

  thumbWorker.on('failed', (job, err) => {
    logger.error('[thumb.worker] Job failed', job.id, err.message || err);
  });

  logger.info('Pin/Unpin/Verify/Thumb workers started');
}

startWorkers().catch((e) => {
  console.error('Worker startup error', e);
  process.exit(1);
});
