const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 10000,
  idleTimeoutMillis: 30000,
  max: 10,
});

pool.on('connect', () => console.log('[PostgreSQL] Connected'));
pool.on('error', (err) => console.error('[PostgreSQL] Error:', err.message));

module.exports = pool;
