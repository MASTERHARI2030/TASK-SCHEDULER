const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL && process.env.DATABASE_URL.includes('render.com')
    ? { rejectUnauthorized: false, checkServerIdentity: () => undefined }
    : false,
  connectionTimeoutMillis: 15000,
  idleTimeoutMillis: 30000,
  max: 5,
});

pool.on('connect', () => console.log('[PostgreSQL] Connected'));
pool.on('error', (err) => console.error('[PostgreSQL] Pool error:', err.message));

module.exports = pool;
