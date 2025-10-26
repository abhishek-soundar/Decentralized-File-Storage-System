// src/queue/index.js
const { Queue } = require('bullmq');
const IORedis = require('ioredis');
const config = require('../config');

const redisUrl = process.env.REDIS_URL || config.redisUrl || 'redis://127.0.0.1:6379';
const ioredisOptions = { maxRetriesPerRequest: null };
const connection = new IORedis(redisUrl, ioredisOptions);

const PIN_QUEUE = 'pin-queue';
const UNPIN_QUEUE = 'unpin-queue';
const VERIFY_QUEUE = 'verify-queue';
const THUMB_QUEUE = 'thumb-queue';

const pinQueue = new Queue(PIN_QUEUE, { connection });
const unpinQueue = new Queue(UNPIN_QUEUE, { connection });
const verifyQueue = new Queue(VERIFY_QUEUE, { connection });
const thumbQueue = new Queue(THUMB_QUEUE, { connection });

module.exports = { connection, pinQueue, unpinQueue, verifyQueue, thumbQueue };
