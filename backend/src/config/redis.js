const Redis = require('ioredis');
require('dotenv').config();

const redisConfig = {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
};

// Upstash requires TLS — ioredis handles rediss:// automatically
const redis = new Redis(process.env.REDIS_URL, redisConfig);

redis.on('connect', () => console.log('[Redis] Connected'));
redis.on('error', (err) => console.error('[Redis] Error:', err.message));

module.exports = redis;
