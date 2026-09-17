// Failover demo — submit jobs, then kill emailWorker mid-task
// Run: node src/test/failoverDemo.js
//
// What to watch:
//   1. emailWorker picks up job and starts processing
//   2. We kill emailWorker process (simulates crash)
//   3. Monitor detects stale heartbeat within 15s
//   4. Monitor marks emailWorker DEAD
//   5. Monitor re-queues the stuck task
//   6. Another alive worker picks it up (or emailWorker restarts via startAll.js)

require('dotenv').config();
const { v4: uuidv4 } = require('uuid');
const { execSync } = require('child_process');
const db = require('../config/db');
const { enqueueTask } = require('../queues/taskQueue');

async function insertTask(type, payload) {
  const id = uuidv4();
  await db.query(
    `INSERT INTO tasks (id, type, payload, status, delay_ms)
     VALUES ($1, $2, $3, 'QUEUED', 0)`,
    [id, type, JSON.stringify(payload)]
  );
  return id;
}

async function main() {
  console.log('='.repeat(60));
  console.log('[FailoverDemo] Submitting 5 email jobs...');
  console.log('='.repeat(60));

  for (let i = 1; i <= 5; i++) {
    const id = await insertTask('send-email', {
      to: `user${i}@example.com`,
      subject: `Test email ${i}`,
    });
    await enqueueTask(id, 'send-email', { to: `user${i}@example.com`, subject: `Test email ${i}` });
    console.log(`[FailoverDemo] Queued job ${i}/5 — task: ${id}`);
  }

  console.log('\n[FailoverDemo] Jobs queued. emailWorker is now processing them.');
  console.log('[FailoverDemo] In 5 seconds, kill emailWorker manually:');
  console.log('\n  → In the terminal running emailWorker, press Ctrl+C');
  console.log('  → OR run: taskkill /F /FI "WINDOWTITLE eq emailWorker*" (Windows)');
  console.log('\n[FailoverDemo] Then watch the monitor terminal for:');
  console.log('  → "[Monitor] Worker emailWorker heartbeat stale — marked DEAD"');
  console.log('  → "[Monitor] Task <id> reassigned — attempt 2"');
  console.log('\n[FailoverDemo] Check PostgreSQL after:');
  console.log('  → SELECT name, status, last_heartbeat FROM workers;');
  console.log('  → SELECT id, type, status, attempts FROM tasks ORDER BY created_at DESC LIMIT 10;');
  console.log('  → SELECT * FROM execution_logs WHERE event IN (\'REASSIGNED\', \'DLQ\') ORDER BY created_at DESC;');

  process.exit(0);
}

main().catch((err) => {
  console.error('[FailoverDemo] Error:', err.message);
  process.exit(1);
});
