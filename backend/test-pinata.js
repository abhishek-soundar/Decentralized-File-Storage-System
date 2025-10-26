// test-pinata.js
require('dotenv').config();
const axios = require('axios');

(async () => {
  try {
    const jwt = process.env.PINATA_JWT && process.env.PINATA_JWT.trim();
    const apiKey = process.env.PINATA_API_KEY && process.env.PINATA_API_KEY.trim();
    const apiSecret = process.env.PINATA_API_SECRET && process.env.PINATA_API_SECRET.trim();

    if (jwt) {
      // try JWT (recommended)
      const res = await axios.get('https://api.pinata.cloud/data/testAuthentication', {
        headers: { Authorization: `Bearer ${jwt}` },
        timeout: 10000
      });
      console.log('Pinata auth OK (JWT):', res.data);
      return;
    }

    if (apiKey && apiSecret) {
      // fallback to API key + secret in headers
      const res = await axios.get('https://api.pinata.cloud/data/testAuthentication', {
        headers: {
          pinata_api_key: apiKey,
          pinata_secret_api_key: apiSecret
        },
        timeout: 10000
      });
      console.log('Pinata auth OK (API key):', res.data);
      return;
    }

    console.error('No Pinata credentials found in environment. Set PINATA_JWT or PINATA_API_KEY + PINATA_API_SECRET in your .env.');
    process.exit(1);
  } catch (err) {
    // show helpful error info
    if (err.response && err.response.data) {
      console.error('Pinata auth failed:', JSON.stringify(err.response.data, null, 2));
    } else {
      console.error('Pinata auth failed:', err.message);
    }
    process.exit(1);
  }
})();
