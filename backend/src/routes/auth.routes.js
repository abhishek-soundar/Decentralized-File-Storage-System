// src/routes/auth.routes.js
const express = require('express');
const controller = require('../controllers/auth.controller');
const validate = require('../middlewares/validate.middleware');
const { registerSchema, loginSchema } = require('../validators/auth.validator');
const { createLimiter } = require('../middlewares/rate.middleware');
const auth = require('../middlewares/auth.middleware');

const router = express.Router();

// stricter limiter for auth endpoints to prevent brute force
const authLimiter = createLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10 // 10 requests per 15 minutes per IP
});

// Register & Login
router.post('/register', authLimiter, validate(registerSchema), controller.register);
router.post('/login', authLimiter, validate(loginSchema), controller.login);

// ✅ New route: get current logged-in user info
router.get('/me', auth, controller.getMe);

module.exports = router;
