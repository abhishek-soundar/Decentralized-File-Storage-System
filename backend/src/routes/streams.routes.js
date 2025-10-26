// src/routes/streams.routes.js
const express = require('express');
const auth = require('../middlewares/auth.middleware');
const { sseBus } = require('../services/sse.service');
const logger = require('../utils/logger');


const router = express.Router();

// SSE endpoint for authenticated users to receive job events.
router.get('/jobs', auth, (req, res) => {
  // set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  // send a comment to keep connection open and a small welcome message
  res.write(': connected\n\n');
  res.write(`data: ${JSON.stringify({ type: 'connected', message: 'SSE connected' })}\n\n`);

  // listener function
    const onMessage = (payload) => {
    try {
      // server-side filtering:
      const ownerId = payload && (payload.ownerId || payload.owner || payload.file?.owner);
      if (ownerId) {
        // normalize and compare as strings
        if (String(ownerId) !== String(req.user && req.user._id)) {
          logger.info('[streams.routes] skipping event for different owner', { sendTo: req.user && String(req.user._id), ownerId });
          return; // not for this client
        }
      }

      // Log which event we are sending to client (truncate large payloads)
      logger.info('[streams.routes] sending event to client', {
        forUser: req.user && String(req.user._id),
        type: payload?.type,
        fileId: payload?.fileId
      });

      // Always send as generic message (EventSource.onmessage)
      res.write(`data: ${JSON.stringify(payload)}\n\n`);
    } catch (e) {
      logger.error('[streams.routes] failed to write event', e && e.message);
    }
  };


  // attach listener
  sseBus.on('message', onMessage);

  // cleanup on client disconnect
  req.on('close', () => {
    sseBus.removeListener('message', onMessage);
  });
});

module.exports = router;
