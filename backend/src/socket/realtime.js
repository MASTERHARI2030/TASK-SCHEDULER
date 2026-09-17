const db = require('../config/db');
const { getQueueStats } = require('../queues/taskQueue');

let broadcastInterval = null;

// ── Push full metrics snapshot every 2s ──────────────────
async function broadcastMetrics(io) {
  try {
    const [queueStats, workers, dlqTasks, recentLogs] = await Promise.all([
      getQueueStats(),
      db.query(
        `SELECT id, name, type, status, last_heartbeat, jobs_completed, jobs_failed,
                EXTRACT(EPOCH FROM (NOW() - last_heartbeat))::int AS heartbeat_age_seconds
         FROM workers ORDER BY name`
      ),
      db.query(
        `SELECT d.id, d.original_task_id, d.type, d.reason, d.attempts, d.failed_at, d.retried
         FROM dlq_tasks d
         ORDER BY d.failed_at DESC
         LIMIT 20`
      ),
      db.query(
        `SELECT el.event, el.worker_name, el.message, el.created_at, t.type AS task_type
         FROM execution_logs el
         LEFT JOIN tasks t ON el.task_id = t.id
         ORDER BY el.created_at DESC
         LIMIT 30`
      ),
    ]);

    io.emit('queue:stats',   queueStats.totals);
    io.emit('worker:status', workers.rows);
    io.emit('dlq:update',    dlqTasks.rows);
    io.emit('log:feed',      recentLogs.rows);
  } catch (err) {
    console.error('[Realtime] Broadcast error:', err.message);
  }
}

// ── Push recent tasks on new client connect ───────────────
async function sendInitialState(socket) {
  try {
    const [tasks, workers, queueStats, dlqTasks, logs] = await Promise.all([
      db.query(
        `SELECT t.id, t.type, t.status, t.priority, t.delay_ms, t.attempts,
                t.created_at, t.updated_at, w.name AS worker_name
         FROM tasks t
         LEFT JOIN workers w ON t.worker_id = w.id
         ORDER BY t.created_at DESC LIMIT 50`
      ),
      db.query(
        `SELECT id, name, type, status, last_heartbeat, jobs_completed, jobs_failed,
                EXTRACT(EPOCH FROM (NOW() - last_heartbeat))::int AS heartbeat_age_seconds
         FROM workers ORDER BY name`
      ),
      getQueueStats(),
      db.query(
        `SELECT d.id, d.original_task_id, d.type, d.reason, d.attempts, d.failed_at, d.retried
         FROM dlq_tasks d ORDER BY d.failed_at DESC LIMIT 20`
      ),
      db.query(
        `SELECT el.event, el.worker_name, el.message, el.created_at, t.type AS task_type
         FROM execution_logs el
         LEFT JOIN tasks t ON el.task_id = t.id
         ORDER BY el.created_at DESC LIMIT 30`
      ),
    ]);

    socket.emit('init:state', {
      tasks:      tasks.rows,
      workers:    workers.rows,
      queueStats: queueStats.totals,
      dlqTasks:   dlqTasks.rows,
      logs:       logs.rows,
    });
  } catch (err) {
    console.error('[Realtime] Initial state error:', err.message);
  }
}

// ── Setup Socket.IO ───────────────────────────────────────
function setupRealtime(io) {
  io.on('connection', (socket) => {
    console.log(`[Socket.IO] Client connected: ${socket.id}`);

    // Send full state immediately on connect
    sendInitialState(socket);

    socket.on('disconnect', () => {
      console.log(`[Socket.IO] Client disconnected: ${socket.id}`);
    });
  });

  // Start broadcasting every 2s
  if (!broadcastInterval) {
    broadcastInterval = setInterval(() => broadcastMetrics(io), 2000);
    console.log('[Realtime] Broadcasting metrics every 2s');
  }
}

module.exports = { setupRealtime };
