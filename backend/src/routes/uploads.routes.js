// src/routes/uploads.routes.js
const express = require('express');
const fs = require('fs');
const path = require('path');
const config = require('../config');
const auth = require('../middlewares/auth.middleware');
const uploadsController = require('../controllers/uploads.controller');

const router = express.Router();

// ensure chunk temp dir exists
const chunkRoot = path.join(config.tempUploadDir, 'chunks');
if (!fs.existsSync(chunkRoot)) fs.mkdirSync(chunkRoot, { recursive: true });

// init upload
router.post('/init', auth, uploadsController.init);

// upload chunk (raw binary). Use express.raw middleware for this route only.
router.put('/:uploadId/chunk', auth, express.raw({ type: '*/*', limit: '2gb' }), uploadsController.uploadChunk);

// check status
router.get('/:uploadId/status', auth, uploadsController.status);

// complete upload (assemble)
router.post('/:uploadId/complete', auth, uploadsController.complete);

module.exports = router;
