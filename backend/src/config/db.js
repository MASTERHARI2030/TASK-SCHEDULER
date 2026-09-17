const { Pool } = require('pg');
const tls = require('tls');
require('dotenv').config();

const isRemote = process.env.DATABASE_URL && !process.env.DATABASE_URL.includes('localhost');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: isRemote ? {
    rejectUnauthorized: false,
    secureProtocol: 'TLSv1_2_method',
  } : false,
  connectionTimeoutMillis: 20000,
  idleTimeoutMillis: 30000,
  max: 5,
});

pool.on('connect', () => console.log('[PostgreSQL] Connected'));
pool.on('error', (err) => console.error('[PostgreSQL] Pool error:', err.message));

module.exports = pool;
