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
// allow frontend origin and credentials (for cookies / SSE)
app.use(cors({ origin: 'http://localhost:5173', credentials: true }));
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
