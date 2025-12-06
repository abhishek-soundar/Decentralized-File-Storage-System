// backend/test-redis-connect.js
const IORedis = require('ioredis');

const host = 'redis-16803.crce182.ap-south-1-1.ec2.redns.redis-cloud.com';
const portTLS = 16803;    // your reported port (verify on dashboard)
const portPlain = 16802;  // try to guess alternative plain port (provider often lists neighboring port)
const user = 'default';
const password = 'VXy09zx5ktQEj2KBg6akZoctJKBVpV6P';

async function tryConnect(url, options = {}) {
  console.log('Trying ->', url, 'options:', Object.keys(options).length ? options : 'none');
  const client = new IORedis(url, options);
  client.on('error', (err) => {
    console.error('ERR from client:', err && err.message || err);
  });
  try {
    const pong = await client.ping();
    console.log('PONG ->', pong);
  } catch (e) {
    console.error('Connect attempt failed:', e && e.message);
  } finally {
    try { client.disconnect(); } catch(_) {}
  }
}

(async () => {
  // 1) Try TLS URL (expected if port is TLS)
  await tryConnect(`rediss://${user}:${encodeURIComponent(password)}@${host}:${portTLS}`, {
    tls: { servername: host, rejectUnauthorized: false } // rejectUnauthorized:false for debugging only
  });

  // 2) Try plain redis url on same port (to see mismatch)
  await tryConnect(`redis://${user}:${encodeURIComponent(password)}@${host}:${portTLS}`);

  // 3) Try plain redis on a guessed plain port (change if dashboard shows another port)
  await tryConnect(`redis://${user}:${encodeURIComponent(password)}@${host}:${portPlain}`);

  console.log('Finished tests.');
})();
