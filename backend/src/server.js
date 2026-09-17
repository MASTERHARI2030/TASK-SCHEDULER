require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');

const redis = require('./config/redis');
const db = require('./config/db');
const { startMonitor } = require('./monitor/heartbeatMonitor');
const { setupRealtime } = require('./socket/realtime');
const taskRoutes = require('./routes/tasks');
const workerRoutes = require('./routes/workers');
const fs = require('fs');

// ── Auto-run schema on startup ────────────────────────────
async function runSchema() {
  try {
    const schema = fs.readFileSync(path.join(__dirname, '../schema.sql'), 'utf8');
    const statements = splitSQL(schema);
    for (const stmt of statements) {
      try { await db.query(stmt); } catch (e) {
        if (!e.message.includes('already exists')) console.warn('[Schema]', e.message);
      }
    }
    console.log('[Schema] Tables ready ✓');
  } catch (err) {
    console.error('[Schema] Failed to run schema:', err.message);
  }
}

// Split SQL respecting dollar-quoted blocks ($$...$$)
function splitSQL(sql) {
  const stmts = [];
  let current = '';
  let inDollar = false;
  let i = 0;
  while (i < sql.length) {
    if (!inDollar && sql[i] === '-' && sql[i+1] === '-') {
      // skip line comment
      while (i < sql.length && sql[i] !== '\n') i++;
      continue;
    }
    if (sql[i] === '$' && sql[i+1] === '$') {
      inDollar = !inDollar;
      current += '$$';
      i += 2;
      continue;
    }
    if (!inDollar && sql[i] === ';') {
      const s = current.trim();
      if (s) stmts.push(s);
      current = '';
      i++;
      continue;
    }
    current += sql[i++];
  }
  const s = current.trim();
  if (s) stmts.push(s);
  return stmts;
}

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: '*' }
});

app.use(cors());
app.use(express.json());

// ── Expose io to routes BEFORE registering routes ────────
app.set('io', io);

// ── Serve frontend ────────────────────────────────────────
app.use(express.static(path.join(__dirname, '../../frontend')));
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../../frontend/index.html'));
});

// ── Health check ──────────────────────────────────────────
app.get('/health', async (req, res) => {
  try {
    await redis.ping();
    await db.query('SELECT 1');
    res.json({
      status: 'ok',
      redis: 'connected',
      postgres: 'connected',
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// ── Routes ────────────────────────────────────────────────
app.use('/api/tasks', taskRoutes);
app.use('/api/workers', workerRoutes);

// ── Real-time broadcast ───────────────────────────────────
setupRealtime(io);

// ── Start server ──────────────────────────────────────────
const PORT = process.env.PORT || 3000;
server.listen(PORT, async () => {
  console.log(`[Server] Running on port ${PORT}`);

  try {
    await redis.ping();
    console.log('[Server] Redis connection verified');
  } catch (err) {
    console.error('[Server] Redis connection failed:', err.message);
  }

  // Log DB URL prefix for debugging (hide password)
  const dbUrl = process.env.DATABASE_URL || 'NOT SET';
  const dbPreview = dbUrl.length > 20 ? dbUrl.replace(/:([^@]+)@/, ':***@').substring(0, 80) : dbUrl;
  console.log(`[Server] DATABASE_URL: ${dbPreview}`);

  // Retry PostgreSQL connection up to 5 times
  let pgConnected = false;
  for (let i = 1; i <= 5; i++) {
    try {
      await db.query('SELECT NOW()');
      console.log('[Server] PostgreSQL connection verified');
      pgConnected = true;
      break;
    } catch (err) {
      console.error(`[Server] PostgreSQL attempt ${i}/5 failed: ${err.message}`);
      if (i < 5) await new Promise(r => setTimeout(r, 3000));
    }
  }
  if (!pgConnected) {
    console.error('[Server] PostgreSQL unavailable — check DATABASE_URL env var on Render');
  }

  // ── Run schema migrations on startup ───────────────────
  await runSchema();

  // ── Start heartbeat monitor ─────────────────────────────
  startMonitor(io);
  console.log('[Server] Heartbeat monitor started');

  // ── Start all 3 workers inline ──────────────────────────
  startWorkers(io);
});

// ── Inline worker launcher ────────────────────────────────
function startWorkers(io) {
  const { createEmailWorker }  = require('./workers/emailWorker');
  const { createFileWorker }   = require('./workers/fileWorker');
  const { createReportWorker } = require('./workers/reportWorker');

  createEmailWorker(io);
  createFileWorker(io);
  createReportWorker(io);

  console.log('[Server] All 3 workers started inline');
}

module.exports = { app, io };
