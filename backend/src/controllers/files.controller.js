const path = require('path');
const fs = require('fs').promises;
const fssync = require('fs');
const crypto = require('crypto');
const config = require('../config');
const logger = require('../utils/logger');
const File = require('../models/file.model');
const User = require('../models/user.model');
const { verifyQueue, unpinQueue, pinQueue } = require('../queue');
const pinataService = require('../services/pinata.service');
const { sha256OfFile } = require('../services/hash.service');

// SSE bus (optional) - used to notify connected clients in this process about deletions/shares
let sseBus;
try {
  sseBus = require('../services/sse.service').sseBus;
} catch (e) {
  sseBus = null;
  logger && logger.warn && logger.warn('[files.controller] sseBus not available, SSE notifications disabled');
}

/**
 * List files (simple pagination could be added but kept minimal)
 */
async function list(req, res, next) {
  try {
    const ownerId = req.user._id;
    // exclude any files that have been marked removed (removedAt set) or status deleted
    const files = await File.find({
      owner: ownerId,
      $and: [
        { $or: [{ removedAt: { $exists: false } }, { removedAt: null }] },
        { status: { $ne: 'deleted' } }
      ]
    })
      .sort({ createdAt: -1 })
      .lean();
    return res.json({ ok: true, items: files });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/files/:id
 * Owner or explicitly shared users only
 */
async function getMetadata(req, res, next) {
  try {
    const id = req.params.id;
    const file = await File.findById(id).lean();
    if (!file) return res.status(404).json({ ok: false, error: 'File not found' });

    const requesterId = req.user && req.user._id ? String(req.user._id) : null;
    const ownerId = String(file.owner);

    // owner -> ok
    if (requesterId && requesterId === ownerId) return res.json({ ok: true, file });

    // if file is public (isPublic true or visibility 'public') allow
    if (file.isPublic || file.visibility === 'public') return res.json({ ok: true, file });

    // sharedWith includes requester
    if (requesterId && Array.isArray(file.sharedWith) && file.sharedWith.map(String).includes(requesterId)) {
      return res.json({ ok: true, file });
    }

    return res.status(403).json({ ok: false, error: 'Forbidden' });
  } catch (err) {
    next(err);
  }
}

/**
 * Public token lookup
 * GET /api/v1/files/token/:token
 * No auth required
 */
async function getByShareToken(req, res, next) {
  try {
    const token = req.params.token;
    if (!token) return res.status(400).json({ ok: false, error: 'token required' });
    const file = await File.findOne({ shareToken: token }).lean();
    if (!file) return res.status(404).json({ ok: false, error: 'Invalid token or file not found' });

    // expiration check
    if (file.shareExpiresAt && new Date(file.shareExpiresAt) < new Date()) {
      return res.status(410).json({ ok: false, error: 'Share token expired' });
    }

    // Build a safe download/gateway link to return
    const downloadUrl = file.cid ? `https://gateway.pinata.cloud/ipfs/${file.cid}` : null;

    return res.json({
      ok: true,
      file,
      downloadUrl
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/files/:id/share
 * Body: { add: [userId|email], remove: [userId|email] }
 * Only owner can manage explicit shares
 */
async function shareManage(req, res, next) {
  try {
    const id = req.params.id;
    const { add = [], remove = [] } = req.body || {};
    const file = await File.findById(id);
    if (!file) return res.status(404).json({ ok: false, error: 'File not found' });

    if (String(file.owner) !== String(req.user._id)) return res.status(403).json({ ok: false, error: 'Forbidden' });

    // Helper to resolve list of ids/emails to ObjectId strings
    const resolvedToIds = async (items) => {
      const out = [];
      for (const it of (items || [])) {
        if (!it) continue;
        // treat as ObjectId if length looks like id
        if (String(it).match(/^[0-9a-fA-F]{24}$/)) {
          out.push(String(it));
          continue;
        }
        // otherwise try email lookup
        const u = await User.findOne({ email: String(it).toLowerCase().trim() }).select('_id').lean();
        if (u && u._id) out.push(String(u._id));
      }
      return out;
    };

    const addIds = await resolvedToIds(add);
    const removeIds = await resolvedToIds(remove);

    // merge addIds into sharedWith uniquely
    const current = (file.sharedWith || []).map(String);
    for (const a of addIds) {
      if (!current.includes(a)) current.push(a);
    }
    // remove removeIds
    const newShared = current.filter((x) => !removeIds.includes(x));

    file.sharedWith = newShared;
    await file.save();

    // SSE event so connected clients can refresh (owner or affected users)
    try {
      if (sseBus && typeof sseBus.emit === 'function') {
        sseBus.emit('message', { type: 'file:share:changed', fileId: String(file._id), sharedWith: newShared });
      }
    } catch (e) {
      logger.warn('[files.shareManage] sse emit failed', e && e.message);
    }

    return res.json({ ok: true, message: 'Share list updated', sharedWith: newShared });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/files/:id/share/token
 * Body: { expiresInSeconds, revoke: boolean }
 * Owner-only. Creates or revokes a share token.
 */
async function createOrRevokeShareToken(req, res, next) {
  try {
    const id = req.params.id;
    const { expiresInSeconds = null, revoke = false } = req.body || {};
    const file = await File.findById(id);
    if (!file) return res.status(404).json({ ok: false, error: 'File not found' });

    if (String(file.owner) !== String(req.user._id)) return res.status(403).json({ ok: false, error: 'Forbidden' });

    if (revoke) {
      file.shareToken = null;
      file.shareExpiresAt = null;
      file.isPublic = false;
      file.visibility = 'private';
      await file.save();
      return res.json({ ok: true, message: 'Share token revoked' });
    }

    // create token
    const token = crypto.randomBytes(32).toString('hex');
    let expiresAt = null;
    if (expiresInSeconds && Number(expiresInSeconds) > 0) {
      expiresAt = new Date(Date.now() + Number(expiresInSeconds) * 1000);
    }

    file.shareToken = token;
    file.shareExpiresAt = expiresAt;
    file.isPublic = true;
    file.visibility = 'public';
    await file.save();

    // provide gateway link if cid present
    const publicGateway = file.cid ? `https://gateway.pinata.cloud/ipfs/${file.cid}` : null;

    return res.json({
      ok: true,
      message: 'Share token created',
      shareToken: token,
      shareExpiresAt: expiresAt,
      publicGateway
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/files/:id/download-public?token=...
 * Public download using shareToken (no auth required)
 */
async function downloadPublic(req, res, next) {
  try {
    const id = req.params.id;
    const token = req.query.token;
    if (!token) return res.status(400).json({ ok: false, error: 'token required' });

    const file = await File.findById(id).lean();
    if (!file) return res.status(404).json({ ok: false, error: 'File not found' });

    if (!file.shareToken || String(file.shareToken) !== String(token)) {
      return res.status(403).json({ ok: false, error: 'Invalid share token' });
    }

    if (file.shareExpiresAt && new Date(file.shareExpiresAt) < new Date()) {
      return res.status(410).json({ ok: false, error: 'Share token expired' });
    }

    // behave just like download: prefer pinata stream if cid present
    if (file.cid) {
      try {
        const { stream, size, filename, contentType } = await pinataService.fetchFileStream(file.cid);
        res.setHeader('Content-Disposition', `attachment; filename="${file.filename || (filename || file.cid)}"`);
        if (contentType) res.setHeader('Content-Type', contentType);
        if (size) res.setHeader('Content-Length', String(size));
        stream.pipe(res);
        stream.on('error', (err) => {
          logger.error('[files.downloadPublic] stream error (pinata)', err && err.message);
          if (!res.headersSent) res.status(500).json({ ok: false, error: 'Failed to stream file' });
          else res.destroy();
        });
        return;
      } catch (err) {
        logger.warn('[files.downloadPublic] pinata stream failed, falling back to local', err && err.message);
      }
    }

    // fallback to local
    const tryLocalPaths = [];
    if (file.localPath) tryLocalPaths.push(file.localPath);
    tryLocalPaths.push(path.join(config.tempUploadDir, `${file._id}-${file.filename}`));
    tryLocalPaths.push(path.join(config.tempUploadDir, file.filename || ''));

    for (const p of tryLocalPaths) {
      try {
        if (!p) continue;
        if (fssync.existsSync(p)) {
          const stat = await fs.stat(p);
          res.setHeader('Content-Disposition', `attachment; filename="${file.filename || path.basename(p)}"`);
          res.setHeader('Content-Length', String(stat.size));
          res.setHeader('Content-Type', file.mimeType || 'application/octet-stream');
          const rs = fssync.createReadStream(p);
          rs.pipe(res);
          rs.on('error', (err) => {
            logger.error('[files.downloadPublic] local stream error', err && err.message);
            if (!res.headersSent) res.status(500).json({ ok: false, error: 'Failed to stream file' });
            else res.destroy();
          });
          return;
        }
      } catch (e) {
        logger.warn('[files.downloadPublic] local try path failed', p, e && e.message);
      }
    }

    return res.status(404).json({ ok: false, error: 'File content not available' });
  } catch (err) {
    next(err);
  }
}

/**
 * The rest of your existing upload/download/remove/verify handlers...
 * I will keep your current implementations for upload, download (authenticated),
 * remove, verify, verifyStatus unchanged below — but ensure they continue to work.
 */

/**
 * Upload endpoint used by multer route...
 */
async function upload(req, res, next) {
  try {
    const file = req.file;
    if (!file) return res.status(400).json({ ok: false, error: 'file required' });

    const owner = req.user._id;
    const originalName = file.originalname || file.filename || 'upload';
    const mimeType = file.mimetype || 'application/octet-stream';
    const size = file.size || 0;
    const filePath = file.path || path.join(config.tempUploadDir, file.filename || file.originalname);

    let sha256 = null;
    try {
      sha256 = await sha256OfFile(filePath);
    } catch (err) {
      logger.warn('[files.upload] sha256 compute failed (continuing)', err && err.message);
      sha256 = null;
    }

    const newFile = await File.create({
      filename: originalName,
      size,
      mimeType,
      owner,
      sha256,
      status: 'uploading',
      pinned: false
    });

    try {
      if (!pinQueue || !pinQueue.add) {
        throw new Error('pinQueue is not available');
      }
      await pinQueue.add('pin-file', {
        fileId: newFile._id.toString(),
        filePath
      }, { attempts: 3, backoff: { type: 'exponential', delay: 5000 } });
    } catch (err) {
      logger.error('[files.upload] failed to enqueue pin job', err && err.message);
      newFile.status = 'failed';
      await newFile.save();
      return res.status(500).json({ ok: false, error: 'Failed to enqueue pin job' });
    }

    return res.status(202).json({
      ok: true,
      message: 'File upload accepted and queued for pinning',
      file: {
        id: newFile._id.toString(),
        filename: newFile.filename,
        size: newFile.size,
        mimeType: newFile.mimeType,
        status: newFile.status
      }
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/files/:id/download (authenticated download)
 */
async function download(req, res, next) {
  try {
    const id = req.params.id;
    const file = await File.findById(id).lean();
    if (!file) return res.status(404).json({ ok: false, error: 'File not found' });
    if (String(file.owner) !== String(req.user._1?._id || req.user._id)) {
      // allow if sharedWith includes req.user
      const requesterId = req.user && req.user._id ? String(req.user._id) : null;
      if (!requesterId || !(Array.isArray(file.sharedWith) && file.sharedWith.map(String).includes(requesterId))) {
        return res.status(403).json({ ok: false, error: 'Forbidden' });
      }
    }

    if (file.cid) {
      try {
        const { stream, size, filename, contentType } = await pinataService.fetchFileStream(file.cid);
        res.setHeader('Content-Disposition', `attachment; filename="${file.filename || (filename || file.cid)}"`);
        if (contentType) res.setHeader('Content-Type', contentType);
        if (size) res.setHeader('Content-Length', String(size));
        stream.pipe(res);
        stream.on('error', (err) => {
          logger.error('[files.download] stream error (pinata)', err && err.message);
          if (!res.headersSent) res.status(500).json({ ok: false, error: 'Failed to stream file' });
          else res.destroy();
        });
        return;
      } catch (err) {
        logger.warn('[files.download] pinata stream failed, falling back to local', err && err.message);
      }
    }

    const tryLocalPaths = [];
    if (file.localPath) tryLocalPaths.push(file.localPath);
    tryLocalPaths.push(path.join(config.tempUploadDir, `${file._id}-${file.filename}`));
    tryLocalPaths.push(path.join(config.tempUploadDir, file.filename || ''));

    for (const p of tryLocalPaths) {
      try {
        if (!p) continue;
        if (fssync.existsSync(p)) {
          const stat = await fs.stat(p);
          res.setHeader('Content-Disposition', `attachment; filename="${file.filename || path.basename(p)}"`);
          res.setHeader('Content-Length', String(stat.size));
          res.setHeader('Content-Type', file.mimeType || 'application/octet-stream');
          const rs = fssync.createReadStream(p);
          rs.pipe(res);
          rs.on('error', (err) => {
            logger.error('[files.download] local stream error', err && err.message);
            if (!res.headersSent) res.status(500).json({ ok: false, error: 'Failed to stream file' });
            else res.destroy();
          });
          return;
        }
      } catch (e) {
        logger.warn('[files.download] local try path failed', p, e && e.message);
      }
    }

    return res.status(404).json({ ok: false, error: 'File content not available' });
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/v1/files/:id
 */
async function remove(req, res, next) {
  try {
    const id = req.params.id;
    const file = await File.findById(id);
    if (!file) return res.status(404).json({ ok: false, error: 'File not found' });
    if (String(file.owner) !== String(req.user._id)) return res.status(403).json({ ok: false, error: 'Forbidden' });

    // if pinned, enqueue unpin job (safe checks)
    if (file.pinned && file.cid) {
      try {
        if (!unpinQueue || !unpinQueue.add) {
          logger.warn('[files.remove] unpinQueue not available; skipping unpin enqueue');
        } else {
          await unpinQueue.add('unpin-file', { fileId: String(file._id), cid: file.cid }, { attempts: 3, backoff: { type: 'exponential', delay: 3000 } });
          logger.info('[files.remove] enqueued unpin job', { fileId: String(file._id), cid: file.cid });
        }
      } catch (e) {
        // log but continue to mark deletion to avoid leaving user stuck
        logger.error('[files.remove] failed to enqueue unpin', e && e.message);
      }
    }

    // mark file as removed (avoid using an invalid enum status)
    try {
      file.pinned = false;
      file.removedAt = new Date();
      file.status = "deleted"; // ✅ mark it for frontend exclusion
      await file.save();
    } catch (e) {
      logger.error('[files.remove] failed to update file doc status', e && e.message);
      // continue — we still attempt cleanup and notify clients
    }

    // attempt to delete any local assembled files if exist (best-effort)
    try {
      const maybePaths = [
        file.localPath,
        path.join(config.tempUploadDir, `${file._id}-${file.filename}`),
        path.join(config.tempUploadDir, file.filename || '')
      ];

      for (const p of maybePaths) {
        if (!p) continue;
        try {
          if (fssync.existsSync(p)) {
            await fs.unlink(p);
            logger.info('[files.remove] cleaned up local file', p);
          }
        } catch (e) {
          // If unlink fails (ENOENT etc), log and continue
          logger.warn('[files.remove] could not delete local file', p, e && e.message);
        }
      }
    } catch (e) {
      logger.warn('[files.remove] cleanup iteration failed', e && e.message);
    }

    // emit SSE so frontends can remove the card immediately
    try {
      if (sseBus && typeof sseBus.emit === 'function') {
        sseBus.emit('message', { type: 'file:deleted', fileId: String(file._id), ownerId: String(file.owner) });
      }
    } catch (e) {
      logger.warn('[files.remove] sse emit failed', e && e.message);
    }

    return res.json({ ok: true, message: 'Deletion requested; unpin/enqueue performed' });
  } catch (err) {
    logger.error('[files.remove] unexpected error', err && err.stack ? err.stack : err);
    return res.status(500).json({ ok: false, error: 'Internal server error' });
  }
}

/**
 * POST /api/v1/files/:id/verify
 */
async function verify(req, res, next) {
  try {
    const id = req.params.id;
    const file = await File.findById(id);
    if (!file) return res.status(404).json({ ok: false, error: 'File not found' });
    if (String(file.owner) !== String(req.user._id)) return res.status(403).json({ ok: false, error: 'Forbidden' });

    if (file.verificationPending) return res.status(202).json({ ok: true, message: 'Verification already pending' });

    file.verificationPending = true;
    await file.save();

    try {
      if (!verifyQueue || !verifyQueue.add) throw new Error('verifyQueue not available');
      await verifyQueue.add('verify-file', { fileId: String(file._id) }, { attempts: 3, backoff: { type: 'exponential', delay: 2000 } });
    } catch (e) {
      logger.error('[files.verify] enqueue failed', e && e.message);
      file.verificationPending = false;
      await file.save().catch(()=>{});
      return res.status(500).json({ ok: false, error: 'Failed to queue verification' });
    }

    return res.status(202).json({ ok: true, message: 'Verification queued' });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/files/:id/verify-status
 */
async function verifyStatus(req, res, next) {
  try {
    const id = req.params.id;
    const file = await File.findById(id).lean();
    if (!file) return res.status(404).json({ ok: false, error: 'File not found' });
    if (String(file.owner) !== String(req.user._id)) return res.status(403).json({ ok: false, error: 'Forbidden' });

    return res.json({
      ok: true,
      uploadId: file.uploadId || null,
      verificationPending: !!file.verificationPending,
      verified: !!file.verified,
      lastVerifiedAt: file.lastVerifiedAt || null,
      lastVerifiedSha256: file.lastVerifiedSha256 || null
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  list,
  getMetadata,
  getByShareToken,
  shareManage,
  createOrRevokeShareToken,
  downloadPublic,
  download,
  remove,
  verify,
  upload,
  verifyStatus
};
