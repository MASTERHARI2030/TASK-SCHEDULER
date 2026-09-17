const { Pool } = require('pg');
require('dotenv').config();

const dbUrl = process.env.DATABASE_URL || '';

// Internal Render URL has no hostname suffix (ends with -a/dbname)
// External Render URL contains .render.com or .postgres.render.com
const needsSSL = dbUrl.includes('.render.com') || dbUrl.includes('ohio-postgres');

const pool = new Pool({
  connectionString: dbUrl,
  ssl: needsSSL ? { rejectUnauthorized: false } : false,
  connectionTimeoutMillis: 20000,
  idleTimeoutMillis: 30000,
  max: 5,
});

pool.on('connect', () => console.log('[PostgreSQL] Connected'));
pool.on('error', (err) => console.error('[PostgreSQL] Pool error:', err.message));

module.exports = pool;
