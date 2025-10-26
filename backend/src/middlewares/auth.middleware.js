// src/middlewares/auth.middleware.js
const jwt = require('jsonwebtoken');
const config = require('../config');
const User = require('../models/user.model');

/**
 * Auth middleware:
 * - Accepts token from Authorization header (Bearer)
 * - Fallback: accepts ?token=... query parameter (useful for EventSource)
 * - Fallback: accepts cookie named "token" (if frontend sets it)
 * - Verifies token, finds user, attaches user to req.user
 */
async function authMiddleware(req, res, next) {
  try {
    // 1) Normal header
    let auth = req.headers && req.headers.authorization;

    // 2) Query param fallback (e.g. EventSource can't set headers reliably)
    if (!auth && req.query && req.query.token) {
      auth = `Bearer ${req.query.token}`;
      // also copy to headers for other middlewares expecting it
      req.headers.authorization = auth;
    }

    // 3) Cookie fallback (frontend sets document.cookie = `token=...`)
    if (!auth && req.cookies && req.cookies.token) {
      auth = `Bearer ${req.cookies.token}`;
      req.headers.authorization = auth;
    }

    if (!auth || !auth.startsWith('Bearer ')) {
      return res.status(401).json({ ok: false, error: 'Missing token' });
    }

    const token = auth.split(' ')[1];
    const payload = jwt.verify(token, config.jwtSecret);

    // payload may have sub, id, or userId depending on how token was created
    const userId = payload.sub || payload.id || payload.userId;
    if (!userId) return res.status(401).json({ ok: false, error: 'Invalid token payload' });

    // fetch user and remove sensitive fields
    const user = await User.findById(userId).select('-passwordHash');
    if (!user) return res.status(401).json({ ok: false, error: 'Invalid token' });

    req.user = user;
    next();
  } catch (err) {
    // token verify failure or DB error
    return res.status(401).json({ ok: false, error: 'Invalid token' });
  }
}

module.exports = authMiddleware;
