require('dotenv').config();
const { Worker } = require('bullmq');
const db = require('../config/db');

const WORKER_NAME = 'emailWorker';
const WORKER_TYPE = 'send-email';
const QUEUE_NAME  = 'email-queue';
const HEARTBEAT_INTERVAL = parseInt(process.env.HEARTBEAT_INTERVAL) || 5000;

async function registerWorker() {
  const res = await db.query(
    `INSERT INTO workers (name, type, status, last_heartbeat)
     VALUES ($1, $2, 'ALIVE', NOW())
     ON CONFLICT (name) DO UPDATE
       SET status = 'ALIVE', last_heartbeat = NOW()
     RETURNING id`,
    [WORKER_NAME, WORKER_TYPE]
  );
  return res.rows[0].id;
}

function startHeartbeat(workerId) {
  setInterval(async () => {
    try {
      const active = await db.query(
        `SELECT COUNT(*) FROM tasks WHERE worker_id = $1 AND status = 'PROCESSING'`,
        [workerId]
      );
      const newStatus = parseInt(active.rows[0].count) > 0 ? 'ALIVE' : 'IDLE';
      await db.query(
        `UPDATE workers SET last_heartbeat = NOW(), status = $1 WHERE id = $2`,
        [newStatus, workerId]
      );
    } catch (err) {
      console.error(`[${WORKER_NAME}] Heartbeat error:`, err.message);
    }
  }, HEARTBEAT_INTERVAL);
}

async function logEvent(taskId, workerId, event, message) {
  await db.query(
    `INSERT INTO execution_logs (task_id, worker_id, worker_name, event, message)
     VALUES ($1, $2, $3, $4, $5)`,
    [taskId, workerId, WORKER_NAME, event, message]
  );
}

async function simulateSendEmail(payload) {
  await new Promise((resolve) => setTimeout(resolve, 2000));
  return {
    sent: true,
    to: payload.to || 'user@example.com',
    subject: payload.subject || 'No Subject',
    sentAt: new Date().toISOString(),
  };
}

function createEmailWorker(io) {
  let workerId = null;

  // Register + start heartbeat
  registerWorker().then((id) => {
    workerId = id;
    startHeartbeat(workerId);
    console.log(`[${WORKER_NAME}] Registered: ${workerId}`);
  }).catch((err) => console.error(`[${WORKER_NAME}] Registration error:`, err.message));

  const worker = new Worker(
    QUEUE_NAME,
    async (job) => {
      const { taskId, payload } = job.data;
      const start = Date.now();

      console.log(`[${WORKER_NAME}] Picked up job ${job.id} | task: ${taskId}`);

      await db.query(
        `UPDATE tasks SET status = 'PROCESSING', worker_id = $1, updated_at = NOW() WHERE id = $2`,
        [workerId, taskId]
      );
      await logEvent(taskId, workerId, 'PICKED_UP', `Job ${job.id} picked up by ${WORKER_NAME}`);
      if (io) {
        io.emit('task:update', { id: taskId, status: 'PROCESSING', worker_name: WORKER_NAME });
        io.emit('log:new', { source: WORKER_NAME, event: 'PICKED_UP', message: `Picked up job ${job.id}`, timestamp: new Date().toISOString() });
      }

      const result = await simulateSendEmail(payload);
      const duration = ((Date.now() - start) / 1000).toFixed(2);

      await db.query(
        `UPDATE tasks SET status = 'COMPLETED', updated_at = NOW() WHERE id = $1`,
        [taskId]
      );
      await db.query(
        `UPDATE workers SET jobs_completed = jobs_completed + 1 WHERE id = $1`,
        [workerId]
      );
      await logEvent(taskId, workerId, 'COMPLETED', `Completed in ${duration}s`);
      if (io) {
        io.emit('task:update', { id: taskId, status: 'COMPLETED', worker_name: WORKER_NAME });
        io.emit('log:new', { source: WORKER_NAME, event: 'COMPLETED', message: `Completed job ${job.id} in ${duration}s`, timestamp: new Date().toISOString() });
      }

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
      await logEvent(taskId, workerId, 'FAILED', `Attempt ${job.attemptsMade}: ${err.message}`);

      if (io) io.emit('task:update', { id: taskId, status: 'FAILED', worker_name: WORKER_NAME });
      if (job.attemptsMade >= job.opts.attempts) {
        await db.query(
          `INSERT INTO dlq_tasks (original_task_id, type, payload, reason, attempts)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (original_task_id) DO NOTHING`,
          [taskId, job.data.type, JSON.stringify(job.data.payload), err.message, job.attemptsMade]
        );
        await logEvent(taskId, workerId, 'DLQ', `Moved to DLQ after ${job.attemptsMade} attempts`);
        if (io) io.emit('dlq:new', { taskId, type: job.data.type, reason: err.message });
      }
    } catch (dbErr) {
      console.error(`[${WORKER_NAME}] DB error on failure:`, dbErr.message);
    }
  });

  worker.on('error', (err) => console.error(`[${WORKER_NAME}] Error:`, err.message));

  console.log(`[${WORKER_NAME}] Listening on queue: ${QUEUE_NAME}`);
  return worker;
}

module.exports = { createEmailWorker };
