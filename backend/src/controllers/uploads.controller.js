const path = require('path');
const fs = require('fs').promises;
const fssync = require('fs');
const { v4: uuidv4 } = require('uuid');
const config = require('../config');
const UploadModel = require('../models/upload.model');
const FileModel = require('../models/file.model');
const { sha256OfFile } = require('../services/hash.service');
const { pinQueue } = require('../queue');

/**
 * POST /api/v1/uploads/init
 * Body JSON: { filename, totalChunks, fileSize, mimeType, chunkSize }
 * Returns: { ok:true, uploadId }
 */
// inside src/controllers/uploads.controller.js — replace the init function with this

async function init(req, res, next) {
  try {
    const { filename, totalChunks, fileSize, mimeType, chunkSize, isFolderZip } = req.body;
    if (!filename || !totalChunks) return res.status(400).json({ ok: false, error: 'filename and totalChunks required' });

    // If client declares this is a zipped folder, enforce .zip extension / mime
    if (isFolderZip) {
      const lower = (filename || "").toLowerCase();
      if (!lower.endsWith('.zip') && !(mimeType && mimeType === 'application/zip')) {
        return res.status(400).json({ ok: false, error: 'isFolderZip specified but file is not a .zip' });
      }
    }

    const uploadId = uuidv4();
    const uploadDir = path.join(config.tempUploadDir, 'chunks', uploadId);

    // ensure dir
    await fs.mkdir(uploadDir, { recursive: true });

    const uploadDoc = await UploadModel.create({
      uploadId,
      owner: req.user._id,
      filename,
      mimeType: mimeType || null,
      totalChunks: Number(totalChunks),
      chunkSize: chunkSize ? Number(chunkSize) : null,
      fileSize: fileSize ? Number(fileSize) : null,
      receivedChunks: [],
      status: 'uploading'
    });

    return res.status(201).json({ ok: true, uploadId });
  } catch (err) {
    next(err);
  }
}


/**
 * PUT /api/v1/uploads/:uploadId/chunk
 * Headers or query:
 *  - x-chunk-index (0-based index)
 * Body: raw binary (send as binary body)
 */
async function uploadChunk(req, res, next) {
  try {
    const uploadId = req.params.uploadId;
    const chunkIndexHeader = req.header('x-chunk-index');
    const chunkIndex = chunkIndexHeader !== undefined ? Number(chunkIndexHeader) : (req.query.chunkIndex ? Number(req.query.chunkIndex) : null);

    if (chunkIndex === null || Number.isNaN(chunkIndex)) {
      return res.status(400).json({ ok: false, error: 'x-chunk-index header required (0-based)' });
    }

    const upload = await UploadModel.findOne({ uploadId });
    if (!upload) return res.status(404).json({ ok: false, error: 'upload not found' });
    if (String(upload.owner) !== String(req.user._id)) return res.status(403).json({ ok: false, error: 'forbidden' });
    if (upload.status !== 'uploading') return res.status(400).json({ ok: false, error: 'upload not accepting chunks' });

    // ensure chunk dir
    const chunkDir = path.join(config.tempUploadDir, 'chunks', uploadId);
    await fs.mkdir(chunkDir, { recursive: true });

    // Receive the raw body stream and write to file
    const chunkPath = path.join(chunkDir, `part.${chunkIndex}`);
    const writeStream = fssync.createWriteStream(chunkPath, { flags: 'w' });

    // handle stream errors so they don't crash the process
    writeStream.on('error', (err) => {
      console.error('[uploads.uploadChunk] writeStream error', err && err.message);
    });

    if (req.readable) {
      // stream mode
      await new Promise((resolve, reject) => {
        req.pipe(writeStream);
        req.on('end', resolve);
        req.on('error', reject);
        writeStream.on('error', reject);
      });
    } else {
      // fallback: check if req.body is Buffer/string
      if (req.body && (typeof req.body === 'string' || Buffer.isBuffer(req.body))) {
        await fs.writeFile(chunkPath, Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body, 'binary'));
      } else {
        // nothing to write
        return res.status(400).json({ ok:false, error:'no chunk body found' });
      }
    }

    // mark chunk as received (avoid dupes)
    if (!upload.receivedChunks.includes(chunkIndex)) {
      upload.receivedChunks.push(chunkIndex);
      await upload.save();
    }

    return res.json({ ok: true, chunkIndex });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/uploads/:uploadId/status
 * returns which chunks exist and status
 */
async function status(req, res, next) {
  try {
    const uploadId = req.params.uploadId;
    const upload = await UploadModel.findOne({ uploadId }).lean();
    if (!upload) return res.status(404).json({ ok: false, error: 'upload not found' });
    if (String(upload.owner) !== String(req.user._id)) return res.status(403).json({ ok: false, error: 'forbidden' });

    return res.json({ ok: true, upload: {
      uploadId: upload.uploadId,
      filename: upload.filename,
      totalChunks: upload.totalChunks,
      receivedChunks: upload.receivedChunks,
      status: upload.status
    }});
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/uploads/:uploadId/complete
 * Server concatenates parts in order, writes final file into tempUploadDir and then:
 * - compute sha256
 * - create File document
 * - enqueue pin job
 * - mark upload status done
 */
async function complete(req, res, next) {
  try {
    const uploadId = req.params.uploadId;
    const upload = await UploadModel.findOne({ uploadId });
    if (!upload) return res.status(404).json({ ok: false, error: 'upload not found' });
    if (String(upload.owner) !== String(req.user._id)) return res.status(403).json({ ok: false, error: 'forbidden' });

    if (upload.status !== 'uploading') return res.status(400).json({ ok: false, error: 'upload not in uploading state' });

    // verify all chunks present
    if (!upload.receivedChunks || upload.receivedChunks.length === 0) return res.status(400).json({ ok: false, error: 'no chunks uploaded' });

    if (upload.receivedChunks.length !== upload.totalChunks) {
      return res.status(400).json({ ok: false, error: 'not all chunks uploaded', received: upload.receivedChunks.length, total: upload.totalChunks });
    }

    const chunkDir = path.join(config.tempUploadDir, 'chunks', uploadId);

    // sanitize filename to avoid path traversal / unintended directories
    // keep only the basename (strip folder components) and replace path separators
    const rawFilename = upload.filename || 'upload';
    const safeBaseName = path.basename(rawFilename).replace(/[/\\]+/g, '_');
    const finalFilename = `${Date.now()}-${uploadId}-${safeBaseName}`;
    const finalPath = path.join(config.tempUploadDir, finalFilename);

    // ensure final directory exists (important on Windows if filename has directories)
    await fs.mkdir(path.dirname(finalPath), { recursive: true });

    // assemble: write parts in order to finalPath
    // create write stream and handle errors
    const writeStream = fssync.createWriteStream(finalPath, { flags: 'w' });

    // handle write errors to avoid unhandled exceptions
    writeStream.on('error', (err) => {
      console.error('[uploads.complete] writeStream error:', err && err.message);
    });

    for (let i = 0; i < upload.totalChunks; i++) {
      const partPath = path.join(chunkDir, `part.${i}`);
      if (!fssync.existsSync(partPath)) {
        // missing part
        writeStream.close();
        return res.status(500).json({ ok:false, error:`part ${i} is missing during assemble` });
      }
      // await pump for each part
      await new Promise((resolve, reject) => {
        const rs = fssync.createReadStream(partPath);
        rs.on('error', reject);
        rs.pipe(writeStream, { end: false });
        rs.on('end', resolve);
      });
    }

    // finish write
    await new Promise((resolve, reject) => {
      writeStream.end();
      writeStream.on('finish', resolve);
      writeStream.on('error', reject);
    });

    // compute sha256 (streaming, ensure hash.service is streaming)
    const sha256 = await sha256OfFile(finalPath);

    // create FileModel entry (similar to upload controller flow)
    const File = require('../models/file.model');
    const newFileDoc = await File.create({
      filename: upload.filename, // retain original filename (may contain path info in metadata)
      size: upload.fileSize || (await fs.stat(finalPath)).size,
      mimeType: upload.mimeType || 'application/octet-stream',
      owner: upload.owner,
      sha256,
      status: 'uploading', // pin will set to available
      pinned: false
    });

    // enqueue pin job
    await pinQueue.add('pin-file', {
      fileId: newFileDoc._id.toString(),
      filePath: finalPath
    }, { attempts: 3, backoff: { type: 'exponential', delay: 5000 } });

    // mark upload done
    upload.status = 'done';
    await upload.save();

    // cleanup chunk files & directory (async)
    (async () => {
      try {
        const files = await fs.readdir(chunkDir);
        for (const f of files) {
          await fs.unlink(path.join(chunkDir, f)).catch(()=>{});
        }
        await fs.rmdir(chunkDir).catch(()=>{});
      } catch (e) { /* ignore */ }
    })();

    return res.json({ ok: true, file: { id: newFileDoc._id, filename: newFileDoc.filename }});
  } catch (err) {
    // log and forward
    console.error('[uploads.complete] unexpected error:', err && (err.stack || err.message) );
    next(err);
  }
}

module.exports = { init, uploadChunk, status, complete };
