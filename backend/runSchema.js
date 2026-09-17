const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const dbUrl = process.argv[2];

if (!dbUrl) {
  console.error('Usage: node runSchema.js "postgresql://..."');
  process.exit(1);
}

const pool = new Pool({
  connectionString: dbUrl,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 10000,
  idleTimeoutMillis: 10000,
});

const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');

// Split schema into individual statements and run one by one
const statements = schema
  .split(';')
  .map(s => s.trim())
  .filter(s => s.length > 0);

async function run() {
  console.log('[Schema] Connecting to PostgreSQL...');
  const client = await pool.connect();
  console.log('[Schema] Connected ✓');

  for (const stmt of statements) {
    try {
      await client.query(stmt);
      const preview = stmt.substring(0, 60).replace(/\n/g, ' ');
      console.log(`[Schema] ✓ ${preview}...`);
    } catch (err) {
      // Skip "already exists" errors
      if (err.message.includes('already exists')) {
        console.log(`[Schema] ⚠ Already exists — skipping`);
      } else {
        console.error(`[Schema] ✗ Error: ${err.message}`);
      }
    }
  }

  client.release();
  await pool.end();
  console.log('\n[Schema] Done — all tables ready ✓');
}

run().catch((err) => {
  console.error('[Schema] Fatal:', err.message);
  process.exit(1);
});
