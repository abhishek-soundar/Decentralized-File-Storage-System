// src/controllers/auth.controller.js
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('../models/user.model');
const config = require('../config');

async function register(req, res, next) {
  try {
    const { name, email, password } = req.body;
    if (!email || !password) return res.status(400).json({ ok: false, error: 'email and password required' });
    const existing = await User.findOne({ email });
    if (existing) return res.status(409).json({ ok: false, error: 'Email already in use' });
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({ name, email, passwordHash });
    const token = jwt.sign({ sub: user._id.toString() }, config.jwtSecret, { expiresIn: config.jwtExpiresIn });
    res.status(201).json({ ok: true, user: { id: user._id, email: user.email, name: user.name }, token });
  } catch (err) {
    next(err);
  }
}

async function login(req, res, next) {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ ok: false, error: 'email and password required' });
    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ ok: false, error: 'Invalid credentials' });
    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match) return res.status(401).json({ ok: false, error: 'Invalid credentials' });
    const token = jwt.sign({ sub: user._id.toString() }, config.jwtSecret, { expiresIn: config.jwtExpiresIn });
    res.json({ ok: true, user: { id: user._id, email: user.email, name: user.name }, token });
  } catch (err) {
    next(err);
  }
}

// ✅ New controller for /auth/me
async function getMe(req, res, next) {
  try {
    const user = await User.findById(req.user._id).select('-passwordHash');
    if (!user) return res.status(404).json({ ok: false, error: 'User not found' });
    res.json({ ok: true, user });
  } catch (err) {
    next(err);
  }
}

module.exports = { register, login, getMe };
