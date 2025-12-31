const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const path = require('path');
const cookieParser = require('cookie-parser');

const config = require('./config');
const { requestLogger } = require('./utils/logger');
const authRoutes = require('./routes/auth.routes');
const filesRoutes = require('./routes/files.routes');
const errorHandler = require('./middlewares/error.middleware');
const adminRoutes = require('./routes/admin.routes');
const streamsRoutes = require('./routes/streams.routes');
const uploadsRoutes = require('./routes/uploads.routes');

const app = express();

// middlewares
app.use(helmet());

// Configure CORS using a whitelist from CORS_ORIGINS env var.
// Example:
// CORS_ORIGINS="http://localhost:5173,https://your-app.vercel.app"
const rawOrigins = process.env.CORS_ORIGINS || '';
const allowedOrigins = rawOrigins
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

// Fallback for local development
if (allowedOrigins.length === 0 && process.env.NODE_ENV !== 'production') {
  allowedOrigins.push('http://localhost:5173');
}

app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (Postman, curl, server-to-server)
      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      // IMPORTANT: do NOT throw an error here
      return callback(null, false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  })
);

// parse cookies (needed for token cookie fallback)
app.use(cookieParser());

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(requestLogger);

// static health route
app.get('/health', (req, res) => res.json({ ok: true, env: config.env }));

// routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/files', filesRoutes);
app.use('/admin', adminRoutes);
app.use('/api/v1/streams', streamsRoutes);
app.use('/api/v1/uploads', uploadsRoutes);

// catch-all 404
app.use((req, res, next) => {
  res.status(404).json({ ok: false, error: 'Not found' });
});

// error handler
app.use(errorHandler);

module.exports = app;
