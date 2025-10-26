const express = require('express');
const multer = require('multer');
const fs = require('fs');
const config = require('../config');
const auth = require('../middlewares/auth.middleware');
const filesController = require('../controllers/files.controller');

const validate = require('../middlewares/validate.middleware');
const { verifyParamsSchema, idParamOnly } = require('../validators/files.validator');
const { createLimiter } = require('../middlewares/rate.middleware');

const router = express.Router();

if (!fs.existsSync(config.tempUploadDir)) {
  fs.mkdirSync(config.tempUploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, config.tempUploadDir),
  filename: (req, file, cb) => {
    const unique = `${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
    cb(null, `${unique}-${file.originalname}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: config.maxUploadBytes }
});

// rate limiters
const uploadLimiter = createLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 30 // 30 uploads per hour per IP
});

const verifyLimiter = createLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 10 // 10 verify requests per minute per IP
});

const statusLimiter = createLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 30 // polling allowed a bit more
});

// Upload: protected, rate-limited. multer runs after limiter so file is available to controller.
router.post('/upload', auth, uploadLimiter, upload.single('file'), filesController.upload);

// List user's files
router.get('/', auth, filesController.list);

// Routes that take :id parameter — validate id
router.get('/:id', auth, validate(idParamOnly), filesController.getMetadata);

// Authenticated download (existing)
router.get('/:id/download', auth, validate(idParamOnly), filesController.download);

// Public download via token (no auth)
router.get('/:id/download-public', validate(idParamOnly), filesController.downloadPublic);

// Delete (owner-only)
router.delete('/:id', auth, validate(idParamOnly), filesController.remove);

// Verify: enqueue verification job (rate-limited, validates :id)
router.post('/:id/verify', auth, verifyLimiter, validate(verifyParamsSchema), filesController.verify);

// Verify status: polling endpoint (rate-limited)
router.get('/:id/verify-status', auth, statusLimiter, validate(verifyParamsSchema), filesController.verifyStatus);

// Controlled sharing endpoints (owner-only)
router.post('/:id/share', auth, validate(idParamOnly), filesController.shareManage);

// Create or revoke public share token (owner-only)
// body: { expiresInSeconds } OR { revoke: true }
router.post('/:id/share/token', auth, validate(idParamOnly), filesController.createOrRevokeShareToken);

// Public token lookup (no auth) - returns metadata and gateway link if available
router.get('/token/:token', filesController.getByShareToken);

module.exports = router;
