require('dotenv').config();
const db = require('../config/db');
const { enqueueTask } = require('../queues/taskQueue');

const MONITOR_INTERVAL  = parseInt(process.env.MONITOR_INTERVAL)  || 10000;
const STALE_THRESHOLD   = parseInt(process.env.STALE_THRESHOLD)   || 15000;

let io = null; // injected when running inside server process

function setIO(socketIO) {
  io = socketIO;
}

function emit(event, data) {
  if (io) io.emit(event, data);
}

function log(message) {
  const ts = new Date().toISOString();
  console.log(`[Monitor] ${ts} — ${message}`);
  emit('log:new', { source: 'MONITOR', message, timestamp: ts });
}

// ── 1. Detect stale workers and mark them DEAD ────────────
async function detectDeadWorkers() {
  const staleTime = new Date(Date.now() - STALE_THRESHOLD).toISOString();

  const res = await db.query(
    `UPDATE workers
     SET status = 'DEAD'
     WHERE status IN ('ALIVE', 'IDLE')
       AND last_heartbeat < $1
     RETURNING id, name, type, last_heartbeat`,
    [staleTime]
  );

  for (const worker of res.rows) {
    const age = Math.round((Date.now() - new Date(worker.last_heartbeat)) / 1000);
    log(`Worker ${worker.name} heartbeat stale (${age}s) — marked DEAD`);
    emit('worker:dead', { workerId: worker.id, workerName: worker.name });
  }

  return res.rows;
}

// ── 2. Reassign tasks stuck on dead workers ───────────────
async function reassignStaleTasks(deadWorkers) {
  if (deadWorkers.length === 0) return;

  const deadIds = deadWorkers.map((w) => w.id);

  // Find tasks that are PROCESSING but assigned to a dead worker
  const stuck = await db.query(
    `SELECT id, type, payload, attempts, max_attempts
     FROM tasks
     WHERE status = 'PROCESSING'
       AND worker_id = ANY($1::uuid[])`,
    [deadIds]
  );

  for (const task of stuck.rows) {
    if (task.attempts >= task.max_attempts) {
      // Exhausted — move to DLQ
      await db.query(
        `UPDATE tasks SET status = 'FAILED', updated_at = NOW() WHERE id = $1`,
        [task.id]
      );
      await db.query(
        `INSERT INTO dlq_tasks (original_task_id, type, payload, reason, attempts)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT DO NOTHING`,
        [task.id, task.type, task.payload, 'Worker died — max attempts reached', task.attempts]
      );
      await db.query(
        `INSERT INTO execution_logs (task_id, worker_name, event, message)
         VALUES ($1, 'MONITOR', 'DLQ', 'Moved to DLQ — worker died after max attempts')`,
        [task.id]
      );
      log(`Task ${task.id} (${task.type}) moved to DLQ — max attempts exhausted`);
      emit('dlq:new', { taskId: task.id, type: task.type, reason: 'Worker died — max attempts reached' });
    } else {
      // Re-queue back into BullMQ
      await db.query(
        `UPDATE tasks
         SET status = 'QUEUED', worker_id = NULL, attempts = attempts + 1, updated_at = NOW()
         WHERE id = $1`,
        [task.id]
      );
      await db.query(
        `INSERT INTO execution_logs (task_id, worker_name, event, message)
         VALUES ($1, 'MONITOR', 'REASSIGNED', 'Task re-queued after worker death')`,
        [task.id]
      );

      // Re-enqueue with a new jobId so BullMQ accepts it
      // task.payload is JSONB from PostgreSQL — parse if string
      const payload = typeof task.payload === 'string'
        ? JSON.parse(task.payload)
        : task.payload;

      await enqueueTask(
        `${task.id}-retry-${task.attempts + 1}`,
        task.type,
        payload,
        { priority: 1 }
      );

      log(`Task ${task.id} (${task.type}) reassigned — attempt ${task.attempts + 1}`);
      emit('task:reassigned', { taskId: task.id, type: task.type, attempt: task.attempts + 1 });
    }
  }
}

// ── 3. Sync BullMQ failed jobs → DLQ table ───────────────
async function syncBullMQFailedToDLQ() {
  const { emailQueue, fileQueue, reportQueue } = require('../queues/taskQueue');
  const queues = [emailQueue, fileQueue, reportQueue];

  for (const queue of queues) {
    const failedJobs = await queue.getFailed(0, 100);

    for (const job of failedJobs) {
      if (!job.data?.taskId) continue;

      // Only insert if not already in DLQ
      const exists = await db.query(
        `SELECT id FROM dlq_tasks WHERE original_task_id = $1`,
        [job.data.taskId]
      );
      if (exists.rows.length > 0) continue;

      const reason = job.failedReason || 'Unknown failure';
      await db.query(
        `INSERT INTO dlq_tasks (original_task_id, type, payload, reason, attempts)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT DO NOTHING`,
        [job.data.taskId, job.data.type, JSON.stringify(job.data.payload), reason, job.attemptsMade]
      );
      await db.query(
        `UPDATE tasks SET status = 'FAILED', updated_at = NOW() WHERE id = $1`,
        [job.data.taskId]
      );
      log(`Synced failed BullMQ job ${job.id} → DLQ (task: ${job.data.taskId})`);
      emit('dlq:new', { taskId: job.data.taskId, type: job.data.type, reason });
    }
  }
}

// ── 4. Emit live worker status snapshot ──────────────────
async function emitWorkerStatus() {
  const res = await db.query(
    `SELECT id, name, type, status, last_heartbeat, jobs_completed, jobs_failed,
            EXTRACT(EPOCH FROM (NOW() - last_heartbeat))::int AS heartbeat_age_seconds
     FROM workers
     ORDER BY name`
  );
  emit('worker:status', res.rows);
}

// ── Main monitor loop ─────────────────────────────────────
async function runMonitorCycle() {
  try {
    const deadWorkers = await detectDeadWorkers();
    await reassignStaleTasks(deadWorkers);
    await syncBullMQFailedToDLQ();
    await emitWorkerStatus();
  } catch (err) {
    console.error('[Monitor] Cycle error:', err.message);
  }
}

// ── Start monitor ─────────────────────────────────────────
function startMonitor(socketIO = null) {
  if (socketIO) io = socketIO;
  log(`Heartbeat monitor started — checking every ${MONITOR_INTERVAL / 1000}s, stale threshold: ${STALE_THRESHOLD / 1000}s`);
  runMonitorCycle(); // run immediately on start
  setInterval(runMonitorCycle, MONITOR_INTERVAL);
}

module.exports = { startMonitor, setIO };

// ── Standalone mode: node src/monitor/heartbeatMonitor.js ─
if (require.main === module) {
  startMonitor();
}
