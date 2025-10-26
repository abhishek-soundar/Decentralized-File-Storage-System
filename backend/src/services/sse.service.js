// src/services/sse.service.js
const { EventEmitter } = require('events');
const { connection: redisConnection } = require('../queue');
const logger = require('../utils/logger');

const PUB_CHANNEL = 'dfsd:jobs';

// local event emitter to fan-out to connected SSE clients in this process
const sseBus = new EventEmitter();
sseBus.setMaxListeners(1000); // allow many clients in dev

// helper: safe JSON parse
function safeParse(raw) {
  try {
    if (typeof raw !== 'string') return null;
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

// normalize callback args from various ioredis versions / modes
function extractChannelAndRawFromArgs(args) {
  // args could be:
  //  - (message)                    -> raw message only (ioredis v5 subscribe listener)
  //  - (message, channel)           -> maybe (message, channel) or (channel, message)
  //  - (channel, message)           -> older `message` event order
  //  - (count)                      -> subscribe returned subscriber count (we should ignore)
  // We return { channel, raw } where raw is string or null.
  if (!args || args.length === 0) return { channel: null, raw: null };

  if (args.length === 1) {
    const a0 = args[0];
    if (typeof a0 === 'string') return { channel: PUB_CHANNEL, raw: a0 };
    return { channel: null, raw: null };
  }

  // length >= 2
  const [a0, a1] = args;
  // both strings -> decide by matching known channel name
  if (typeof a0 === 'string' && typeof a1 === 'string') {
    if (a0 === PUB_CHANNEL) return { channel: a0, raw: a1 };
    if (a1 === PUB_CHANNEL) return { channel: a1, raw: a0 };
    // if neither matches exactly, assume second is raw message (common case)
    return { channel: a0, raw: a1 };
  }

  // one string present -> pick string as raw
  if (typeof a0 === 'string') return { channel: PUB_CHANNEL, raw: a0 };
  if (typeof a1 === 'string') return { channel: PUB_CHANNEL, raw: a1 };

  // fallback: ignore non-string calls
  return { channel: null, raw: null };
}

(async function subscribe() {
  try {
    // create a dedicated subscriber
    const sub = redisConnection.duplicate();

    // connect if duplicate has connect() and it's not already connected
    if (typeof sub.connect === 'function') {
      try {
        await sub.connect();
        logger.info('[sse.service] duplicate subscriber connected');
      } catch (e) {
        // ignore connect failures if already connected
      }
    }

    // optional ping check on main connection
    try {
      const pong = await redisConnection.ping();
      logger.info('[sse.service] redis ping ->', pong);
    } catch (e) {
      logger.warn('[sse.service] redis ping failed', e && e.message);
    }

    // Use subscribe with a listener and also attach a fallback 'message' event handler.
    // This tries to be compatible with different ioredis versions and calling conventions.
    // Listener form (some ioredis versions call the provided listener for each message)
    await sub.subscribe(PUB_CHANNEL, (...listenerArgs) => {
      // extract channel & raw based on observed args
      const { channel, raw } = extractChannelAndRawFromArgs(listenerArgs);

      if (!raw || typeof raw !== 'string') {
        logger.info('[sse.service] subscribe-listener ignored non-string payload', {
          args: listenerArgs.length,
          sample: typeof raw === 'string' ? raw.slice(0, 200) : raw
        });
        return;
      }

      // parse payload safely
      const payload = safeParse(raw);
      if (!payload) {
        logger.warn('[sse.service] subscribe-listener received invalid json, ignoring', { channel, raw: raw.slice(0, 200) });
        return;
      }

      logger.info('[sse.service] parsed pubsub message', { channel, type: payload?.type, fileId: payload?.fileId });
      sseBus.emit('message', payload);
    });

    // Also attach a 'message' event just in case (covers older API shapes)
    sub.on('message', (...msgArgs) => {
      const { channel, raw } = extractChannelAndRawFromArgs(msgArgs);

      if (!raw || typeof raw !== 'string') {
        logger.debug('[sse.service] message-event ignored non-string payload', { args: msgArgs.length });
        return;
      }

      const payload = safeParse(raw);
      if (!payload) {
        logger.warn('[sse.service] message-event received invalid json, ignoring', { channel, sample: raw.slice(0, 200) });
        return;
      }

      logger.info('[sse.service] parsed pubsub message (on message)', { channel, type: payload?.type, fileId: payload?.fileId });
      sseBus.emit('message', payload);
    });

    logger.info('[sse.service] subscribed to', PUB_CHANNEL);
  } catch (e) {
    logger.error('[sse.service] subscribe failed', e && (e.message || e));
  }
})();

module.exports = { sseBus, PUB_CHANNEL };
