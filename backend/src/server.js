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
    const schema = fs.readFileSync(path.join(__dirname, '../../schema.sql'), 'utf8');
    const statements = schema.split(';').map(s => s.trim()).filter(s => s.length > 0);
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
    process.exit(1);
  }

  try {
    await db.query('SELECT NOW()');
    console.log('[Server] PostgreSQL connection verified');
  } catch (err) {
    console.error('[Server] PostgreSQL connection failed:', err.message);
    process.exit(1);
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
