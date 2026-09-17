require('dotenv').config();
const { Worker } = require('bullmq');
const { v4: uuidv4 } = require('uuid');
const db = require('../config/db');

const WORKER_NAME = 'emailWorker';
const WORKER_TYPE = 'send-email';
const QUEUE_NAME  = 'email-queue';
const HEARTBEAT_INTERVAL = parseInt(process.env.HEARTBEAT_INTERVAL) || 5000;

let workerId = null;

// ── Register worker in PostgreSQL ─────────────────────────
async function registerWorker() {
  const res = await db.query(
    `INSERT INTO workers (name, type, status, last_heartbeat)
     VALUES ($1, $2, 'ALIVE', NOW())
     ON CONFLICT (name) DO UPDATE
       SET status = 'ALIVE', last_heartbeat = NOW()
     RETURNING id`,
    [WORKER_NAME, WORKER_TYPE]
  );
  workerId = res.rows[0].id;
  console.log(`[${WORKER_NAME}] Registered with id: ${workerId}`);
}

// ── Heartbeat: write to PostgreSQL every 5s ───────────────
function startHeartbeat() {
  setInterval(async () => {
    try {
      await db.query(
        `UPDATE workers SET last_heartbeat = NOW(), status = 'ALIVE' WHERE id = $1`,
        [workerId]
      );
    } catch (err) {
      console.error(`[${WORKER_NAME}] Heartbeat error:`, err.message);
    }
  }, HEARTBEAT_INTERVAL);
}

// ── Log event to execution_logs ───────────────────────────
async function logEvent(taskId, event, message) {
  await db.query(
    `INSERT INTO execution_logs (task_id, worker_id, worker_name, event, message)
     VALUES ($1, $2, $3, $4, $5)`,
    [taskId, workerId, WORKER_NAME, event, message]
  );
}

// ── Simulate sending an email (2s work) ───────────────────
async function simulateSendEmail(payload) {
  await new Promise((resolve) => setTimeout(resolve, 2000));
  return {
    sent: true,
    to: payload.to || 'user@example.com',
    subject: payload.subject || 'No Subject',
    sentAt: new Date().toISOString(),
  };
}

// ── BullMQ Worker ─────────────────────────────────────────
const worker = new Worker(
  QUEUE_NAME,
  async (job) => {
    const { taskId, payload } = job.data;
    const start = Date.now();

    console.log(`[${WORKER_NAME}] Picked up job ${job.id} | task: ${taskId}`);

    // Mark task PROCESSING in PostgreSQL
    await db.query(
      `UPDATE tasks SET status = 'PROCESSING', worker_id = $1, updated_at = NOW() WHERE id = $2`,
      [workerId, taskId]
    );
    await logEvent(taskId, 'PICKED_UP', `Job ${job.id} picked up by ${WORKER_NAME}`);

    // Do the work
    const result = await simulateSendEmail(payload);
    const duration = ((Date.now() - start) / 1000).toFixed(2);

    // Mark task COMPLETED
    await db.query(
      `UPDATE tasks SET status = 'COMPLETED', updated_at = NOW() WHERE id = $1`,
      [taskId]
    );
    await db.query(
      `UPDATE workers SET jobs_completed = jobs_completed + 1 WHERE id = $1`,
      [workerId]
    );
    await logEvent(taskId, 'COMPLETED', `Completed in ${duration}s — ${JSON.stringify(result)}`);

    console.log(`[${WORKER_NAME}] Completed job ${job.id} in ${duration}s`);
    return result;
  },
  {
    connection: new (require('ioredis'))(process.env.REDIS_URL, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    }),
    concurrency: 2,
    stalledInterval: 10000,
    maxStalledCount: 1,
  }
);

// ── Handle job failure ────────────────────────────────────
worker.on('failed', async (job, err) => {
  console.error(`[${WORKER_NAME}] Job ${job.id} failed:`, err.message);
  try {
    const { taskId } = job.data;
    await db.query(
      `UPDATE tasks SET status = 'FAILED', attempts = $1, updated_at = NOW() WHERE id = $2`,
      [job.attemptsMade, taskId]
    );
    await db.query(
      `UPDATE workers SET jobs_failed = jobs_failed + 1 WHERE id = $1`,
      [workerId]
    );
    await logEvent(taskId, 'FAILED', `Attempt ${job.attemptsMade}: ${err.message}`);

    // Move to DLQ after max attempts exhausted
    if (job.attemptsMade >= job.opts.attempts) {
      await db.query(
        `INSERT INTO dlq_tasks (original_task_id, type, payload, reason, attempts)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT DO NOTHING`,
        [taskId, job.data.type, JSON.stringify(job.data.payload), err.message, job.attemptsMade]
      );
      await logEvent(taskId, 'DLQ', `Moved to DLQ after ${job.attemptsMade} attempts`);
      console.log(`[${WORKER_NAME}] Job ${job.id} moved to DLQ`);
    }
  } catch (dbErr) {
    console.error(`[${WORKER_NAME}] DB error on failure handler:`, dbErr.message);
  }
});

worker.on('error', (err) => console.error(`[${WORKER_NAME}] Worker error:`, err.message));

// ── Boot ──────────────────────────────────────────────────
(async () => {
  await registerWorker();
  startHeartbeat();
  console.log(`[${WORKER_NAME}] Listening on queue: ${QUEUE_NAME}`);
})();
