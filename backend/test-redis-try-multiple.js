// backend/test-redis-try-multiple.js
const IORedis = require('ioredis');

const host = 'redis-16803.crce182.ap-south-1-1.ec2.redns.redis-cloud.com';
const portTls = 16803;
const portPlainGuess = 16802; // try the sibling port
const user = 'default';
const password = 'VXy09zx5ktQEj2KBg6akZoctJKBVpV6P';

async function tryConnect(url, opts = {}) {
  console.log('Trying ->', url, 'opts:', Object.keys(opts).length ? opts : 'none');
  const client = new IORedis(url, opts);
  client.on('error', (err) => {
    console.error('CLIENT ERROR:', err && err.message);
  });
  try {
    const pong = await client.ping();
    console.log('SUCCESS:', url, '->', pong);
  } catch (err) {
    console.error('FAIL:', url, '->', err && err.message);
  } finally {
    try { client.disconnect(); } catch(_) {}
  }
}

(async () => {
  // A: TLS attempt (with rejectUnauthorized:false for debugging)
  await tryConnect(
    `rediss://${user}:${encodeURIComponent(password)}@${host}:${portTls}`,
    { tls: { servername: host, rejectUnauthorized: false } }
  );

  // B: plain on the same port (to detect protocol mismatch)
  await tryConnect(`redis://${user}:${encodeURIComponent(password)}@${host}:${portTls}`);

  // C: plain on guessed sibling port (many providers use TLS on one port, plain on other)
  await tryConnect(`redis://${user}:${encodeURIComponent(password)}@${host}:${portPlainGuess}`);

  console.log('done');
})();
