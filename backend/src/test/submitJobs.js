// Quick test — submit one job of each type and watch workers process them
// Run: node src/test/submitJobs.js

require('dotenv').config();
const { v4: uuidv4 } = require('uuid');
const db = require('../config/db');
const { enqueueTask } = require('../queues/taskQueue');

async function insertTask(type, payload, delayMs = 0) {
  const id = uuidv4();
  await db.query(
    `INSERT INTO tasks (id, type, payload, status, delay_ms)
     VALUES ($1, $2, $3, 'QUEUED', $4)`,
    [id, type, JSON.stringify(payload), delayMs]
  );
  return id;
}

async function main() {
  console.log('[Test] Submitting 3 jobs...\n');

  // 1. Immediate email job
  const emailId = await insertTask('send-email', {
    to: 'alice@example.com',
    subject: 'Welcome to the platform',
  });
  await enqueueTask(emailId, 'send-email', { to: 'alice@example.com', subject: 'Welcome' });
  console.log(`[Test] Queued send-email     | task id: ${emailId}`);

  // 2. Immediate file job
  const fileId = await insertTask('process-file', { filename: 'sales_data_2024.csv' });
  await enqueueTask(fileId, 'process-file', { filename: 'sales_data_2024.csv' });
  console.log(`[Test] Queued process-file   | task id: ${fileId}`);

  // 3. Delayed report job (runs after 15 seconds)
  const reportId = await insertTask('generate-report', { reportType: 'monthly-summary' }, 15000);
  await enqueueTask(reportId, 'generate-report', { reportType: 'monthly-summary' }, { delay: 15000 });
  console.log(`[Test] Queued generate-report (15s delay) | task id: ${reportId}`);

  console.log('\n[Test] Done. Watch your worker terminals process these jobs.');
  process.exit(0);
}

main().catch((err) => {
  console.error('[Test] Error:', err.message);
  process.exit(1);
});
