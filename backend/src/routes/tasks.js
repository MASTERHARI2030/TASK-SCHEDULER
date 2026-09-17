require('dotenv').config();
const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../config/db');
const { enqueueTask } = require('../queues/taskQueue');

const router = express.Router();

const VALID_TYPES = ['send-email', 'process-file', 'generate-report'];

// ── POST /api/tasks — create and enqueue a task ───────────
router.post('/', async (req, res) => {
  try {
    const { type, payload = {}, priority = 1, delay = 0 } = req.body;

    if (!type) return res.status(400).json({ error: 'type is required' });
    if (!VALID_TYPES.includes(type))
      return res.status(400).json({ error: `type must be one of: ${VALID_TYPES.join(', ')}` });

    const id = uuidv4();
    const status = delay > 0 ? 'DELAYED' : 'QUEUED';

    await db.query(
      `INSERT INTO tasks (id, type, payload, status, priority, delay_ms)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [id, type, JSON.stringify(payload), status, priority, delay]
    );

    // If delayed, also record in scheduled_tasks
    if (delay > 0) {
      const runAt = new Date(Date.now() + delay).toISOString();
      await db.query(
        `INSERT INTO scheduled_tasks (task_id, run_at) VALUES ($1, $2)`,
        [id, runAt]
      );
    }

    const job = await enqueueTask(id, type, payload, { priority, delay });

    // Update bullmq_job_id
    await db.query(
      `UPDATE tasks SET bullmq_job_id = $1 WHERE id = $2`,
      [job.id, id]
    );

    // Emit to dashboard
    const io = req.app.get('io');
    if (io) io.emit('task:new', { id, type, status, priority, delay, createdAt: new Date().toISOString() });

    res.status(201).json({ id, type, status, priority, delay, bullmqJobId: job.id });
  } catch (err) {
    console.error('[Tasks] POST error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/tasks — list all tasks ──────────────────────
router.get('/', async (req, res) => {
  try {
    const { status, type, limit = 50, offset = 0 } = req.query;

    let query = `
      SELECT t.id, t.type, t.payload, t.status, t.priority, t.delay_ms,
             t.attempts, t.max_attempts, t.bullmq_job_id,
             t.created_at, t.updated_at,
             w.name AS worker_name
      FROM tasks t
      LEFT JOIN workers w ON t.worker_id = w.id
    `;
    const params = [];
    const conditions = [];

    if (status) { params.push(status); conditions.push(`t.status = $${params.length}`); }
    if (type)   { params.push(type);   conditions.push(`t.type = $${params.length}`); }

    if (conditions.length) query += ` WHERE ${conditions.join(' AND ')}`;
    query += ` ORDER BY t.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(parseInt(limit), parseInt(offset));

    const result = await db.query(query, params);
    const countRes = await db.query(`SELECT COUNT(*) FROM tasks`);

    res.json({ total: parseInt(countRes.rows[0].count), tasks: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/tasks/:id — single task + execution log ─────
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const taskRes = await db.query(
      `SELECT t.*, w.name AS worker_name
       FROM tasks t
       LEFT JOIN workers w ON t.worker_id = w.id
       WHERE t.id = $1`,
      [id]
    );
    if (!taskRes.rows.length) return res.status(404).json({ error: 'Task not found' });

    const logsRes = await db.query(
      `SELECT event, worker_name, message, created_at
       FROM execution_logs
       WHERE task_id = $1
       ORDER BY created_at ASC`,
      [id]
    );

    res.json({ task: taskRes.rows[0], logs: logsRes.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/tasks/dlq/all — list all DLQ tasks ──────────
router.get('/dlq/all', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT d.*, t.type AS task_type
       FROM dlq_tasks d
       LEFT JOIN tasks t ON d.original_task_id = t.id
       ORDER BY d.failed_at DESC`
    );
    res.json({ dlqTasks: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/tasks/dlq/:id/retry — requeue a DLQ task ───
router.post('/dlq/:id/retry', async (req, res) => {
  try {
    const { id } = req.params;

    const dlqRes = await db.query(
      `SELECT * FROM dlq_tasks WHERE id = $1`,
      [id]
    );
    if (!dlqRes.rows.length) return res.status(404).json({ error: 'DLQ task not found' });

    const dlqTask = dlqRes.rows[0];
    if (dlqTask.retried) return res.status(400).json({ error: 'Task already retried' });

    // Create a fresh task
    const newId = uuidv4();
    await db.query(
      `INSERT INTO tasks (id, type, payload, status, priority, delay_ms)
       VALUES ($1, $2, $3, 'QUEUED', 1, 0)`,
      [newId, dlqTask.type, dlqTask.payload]
    );

    const job = await enqueueTask(newId, dlqTask.type, dlqTask.payload);

    await db.query(
      `UPDATE tasks SET bullmq_job_id = $1 WHERE id = $2`,
      [job.id, newId]
    );

    // Mark DLQ entry as retried
    await db.query(
      `UPDATE dlq_tasks SET retried = TRUE, retried_at = NOW() WHERE id = $1`,
      [id]
    );

    const io = req.app.get('io');
    if (io) io.emit('task:new', { id: newId, type: dlqTask.type, status: 'QUEUED', retriedFrom: id });

    res.json({ message: 'Task requeued', newTaskId: newId, bullmqJobId: job.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── DELETE /api/tasks/dlq/:id — discard a DLQ task ───────
router.delete('/dlq/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query(
      `DELETE FROM dlq_tasks WHERE id = $1 RETURNING id`,
      [id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'DLQ task not found' });
    res.json({ message: 'DLQ task discarded', id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
