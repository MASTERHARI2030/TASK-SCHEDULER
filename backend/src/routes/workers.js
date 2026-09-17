const express = require('express');
const db = require('../config/db');
const { getQueueStats } = require('../queues/taskQueue');

const router = express.Router();

// ── GET /api/workers — all workers with heartbeat age ─────
router.get('/', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT id, name, type, status,
              last_heartbeat, jobs_completed, jobs_failed, registered_at,
              EXTRACT(EPOCH FROM (NOW() - last_heartbeat))::int AS heartbeat_age_seconds
       FROM workers
       ORDER BY name`
    );
    res.json({ workers: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/workers/:id — single worker + recent logs ────
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const workerRes = await db.query(
      `SELECT *, EXTRACT(EPOCH FROM (NOW() - last_heartbeat))::int AS heartbeat_age_seconds
       FROM workers WHERE id = $1`,
      [id]
    );
    if (!workerRes.rows.length) return res.status(404).json({ error: 'Worker not found' });

    const logsRes = await db.query(
      `SELECT el.event, el.message, el.created_at, t.type AS task_type
       FROM execution_logs el
       LEFT JOIN tasks t ON el.task_id = t.id
       WHERE el.worker_id = $1
       ORDER BY el.created_at DESC
       LIMIT 20`,
      [id]
    );

    res.json({ worker: workerRes.rows[0], recentLogs: logsRes.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/metrics — queue depths + task counts ─────────
router.get('/stats/metrics', async (req, res) => {
  try {
    const [queueStats, taskCounts, workerCounts, recentLogs] = await Promise.all([
      getQueueStats(),
      db.query(
        `SELECT status, COUNT(*) AS count FROM tasks GROUP BY status`
      ),
      db.query(
        `SELECT status, COUNT(*) AS count FROM workers GROUP BY status`
      ),
      db.query(
        `SELECT el.event, el.worker_name, el.message, el.created_at, t.type AS task_type
         FROM execution_logs el
         LEFT JOIN tasks t ON el.task_id = t.id
         ORDER BY el.created_at DESC
         LIMIT 30`
      ),
    ]);

    const taskStatusMap = {};
    taskCounts.rows.forEach((r) => { taskStatusMap[r.status] = parseInt(r.count); });

    const workerStatusMap = {};
    workerCounts.rows.forEach((r) => { workerStatusMap[r.status] = parseInt(r.count); });

    res.json({
      queues: queueStats,
      tasks: taskStatusMap,
      workers: workerStatusMap,
      recentLogs: recentLogs.rows,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
