// src/routes/admin.routes.js
const express = require('express');
const auth = require('../middlewares/auth.middleware');
const { ExpressAdapter } = require('@bull-board/express');
const { createBullBoard } = require('@bull-board/api');
const { BullMQAdapter } = require('@bull-board/api/bullMQAdapter');
const { pinQueue, unpinQueue, verifyQueue } = require('../queue');

const router = express.Router();
const serverAdapter = new ExpressAdapter();

// set base path for the UI (mounted under /admin by app.js)
serverAdapter.setBasePath('/admin');

createBullBoard({
  queues: [
    new BullMQAdapter(pinQueue),
    new BullMQAdapter(unpinQueue),
    new BullMQAdapter(verifyQueue)
  ],
  serverAdapter
});

// mount UI at /admin (protected by auth)
router.use('/', auth, serverAdapter.getRouter());

// dev helper: if you'd like to bypass auth while developing, uncomment below
// if (process.env.NODE_ENV === 'production') {
//   router.use('/', auth, serverAdapter.getRouter());
// } else {
//   router.use('/', serverAdapter.getRouter());
// }

module.exports = router;
