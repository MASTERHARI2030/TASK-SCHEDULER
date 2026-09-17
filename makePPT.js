const PptxGenJS = require('./backend/node_modules/pptxgenjs');
const pptx = new PptxGenJS();

// Theme colors
const BG = '0D1117';
const ACCENT = '00D4FF';
const ACCENT2 = '7C3AED';
const WHITE = 'FFFFFF';
const GRAY = 'A0AEC0';
const GREEN = '00E676';
const RED = 'FF5252';
const YELLOW = 'FFD600';

function addSlide(title, bullets, opts = {}) {
  const slide = pptx.addSlide();
  slide.background = { color: BG };

  // Top accent bar
  slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: '100%', h: 0.08, fill: { color: ACCENT } });

  // Title
  slide.addText(title, {
    x: 0.4, y: 0.18, w: 9.2, h: 0.7,
    fontSize: 28, bold: true, color: ACCENT, fontFace: 'Segoe UI'
  });

  // Divider
  slide.addShape(pptx.ShapeType.rect, { x: 0.4, y: 0.95, w: 9.2, h: 0.03, fill: { color: ACCENT2 } });

  // Bullets
  if (bullets && bullets.length) {
    const items = bullets.map(b => {
      if (typeof b === 'string') return { text: b, options: { color: WHITE, fontSize: 16, bullet: { type: 'bullet' }, paraSpaceAfter: 6 } };
      return b;
    });
    slide.addText(items, { x: 0.5, y: 1.1, w: 9.0, h: 5.5, fontFace: 'Segoe UI', valign: 'top' });
  }

  if (opts.footer) {
    slide.addText(opts.footer, { x: 0.4, y: 6.9, w: 9.2, h: 0.3, fontSize: 11, color: GRAY, fontFace: 'Segoe UI' });
  }

  return slide;
}

// ── SLIDE 1: Title ────────────────────────────────────────
{
  const slide = pptx.addSlide();
  slide.background = { color: BG };
  slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: '100%', h: 0.08, fill: { color: ACCENT } });
  slide.addShape(pptx.ShapeType.rect, { x: 0, y: 7.0, w: '100%', h: 0.5, fill: { color: ACCENT2 } });
  slide.addText('Distributed Task Scheduler', {
    x: 0.5, y: 1.5, w: 9.0, h: 1.2,
    fontSize: 40, bold: true, color: ACCENT, fontFace: 'Segoe UI', align: 'center'
  });
  slide.addText('Real-Time Worker Orchestration & Fault-Tolerant Job Execution', {
    x: 0.5, y: 2.8, w: 9.0, h: 0.6,
    fontSize: 18, color: WHITE, fontFace: 'Segoe UI', align: 'center'
  });
  slide.addText('Node.js  •  BullMQ  •  Redis  •  PostgreSQL  •  Socket.IO', {
    x: 0.5, y: 3.6, w: 9.0, h: 0.5,
    fontSize: 14, color: ACCENT2, fontFace: 'Segoe UI', align: 'center', bold: true
  });
  slide.addText('Hackathon Project  |  Live: task-scheduler-api-gukn.onrender.com', {
    x: 0.5, y: 7.05, w: 9.0, h: 0.35,
    fontSize: 12, color: WHITE, fontFace: 'Segoe UI', align: 'center'
  });
}

// ── SLIDE 2: Problem Statement ────────────────────────────
addSlide('The Problem', [
  { text: 'Modern applications need background job processing at scale:', options: { color: YELLOW, fontSize: 17, bold: true, paraSpaceAfter: 8 } },
  { text: 'Jobs must execute at least once — no silent drops', options: { color: WHITE, fontSize: 16, bullet: { type: 'bullet' }, paraSpaceAfter: 5 } },
  { text: 'Workers can crash mid-job — tasks get stuck forever', options: { color: WHITE, fontSize: 16, bullet: { type: 'bullet' }, paraSpaceAfter: 5 } },
  { text: 'No visibility into what is running, failing, or queued', options: { color: WHITE, fontSize: 16, bullet: { type: 'bullet' }, paraSpaceAfter: 5 } },
  { text: 'Failed jobs disappear with no retry or audit trail', options: { color: WHITE, fontSize: 16, bullet: { type: 'bullet' }, paraSpaceAfter: 5 } },
  { text: 'Scaling workers requires manual coordination', options: { color: WHITE, fontSize: 16, bullet: { type: 'bullet' }, paraSpaceAfter: 16 } },
  { text: 'Our Solution: A production-grade distributed task scheduler with automatic failover, dead letter queue, and a live observability dashboard.', options: { color: ACCENT, fontSize: 16, bold: true, paraSpaceAfter: 5 } },
]);

// ── SLIDE 3: Key Features ─────────────────────────────────
addSlide('Key Features', [
  { text: '✅  At-Least-Once Execution', options: { color: GREEN, fontSize: 17, bold: true, paraSpaceAfter: 4 } },
  { text: 'Every task is guaranteed to run — BullMQ retries on failure up to max_attempts', options: { color: WHITE, fontSize: 15, paraSpaceAfter: 10 } },
  { text: '💀  Dead Letter Queue (DLQ)', options: { color: RED, fontSize: 17, bold: true, paraSpaceAfter: 4 } },
  { text: 'Exhausted tasks move to DLQ with full audit trail — retry or discard from dashboard', options: { color: WHITE, fontSize: 15, paraSpaceAfter: 10 } },
  { text: '❤️  Worker Heartbeat Detection', options: { color: YELLOW, fontSize: 17, bold: true, paraSpaceAfter: 4 } },
  { text: 'Workers ping every 5s — monitor marks DEAD after 15s silence', options: { color: WHITE, fontSize: 15, paraSpaceAfter: 10 } },
  { text: '🔄  Automatic Task Reassignment', options: { color: ACCENT, fontSize: 17, bold: true, paraSpaceAfter: 4 } },
  { text: 'Tasks stuck on dead workers are automatically re-queued', options: { color: WHITE, fontSize: 15, paraSpaceAfter: 10 } },
  { text: '📊  Real-Time Observability Dashboard', options: { color: ACCENT2, fontSize: 17, bold: true, paraSpaceAfter: 4 } },
  { text: 'Live metrics, worker health cards, task feed, DLQ panel via Socket.IO', options: { color: WHITE, fontSize: 15, paraSpaceAfter: 5 } },
]);

// ── SLIDE 4: Tech Stack ───────────────────────────────────
addSlide('Tech Stack', [
  { text: 'Backend', options: { color: ACCENT, fontSize: 18, bold: true, paraSpaceAfter: 4 } },
  { text: 'Node.js + Express — REST API server, single-process architecture', options: { color: WHITE, fontSize: 15, bullet: { type: 'bullet' }, paraSpaceAfter: 4 } },
  { text: 'BullMQ — Production-grade job queue built on Redis', options: { color: WHITE, fontSize: 15, bullet: { type: 'bullet' }, paraSpaceAfter: 4 } },
  { text: 'Socket.IO — Bi-directional real-time events to dashboard', options: { color: WHITE, fontSize: 15, bullet: { type: 'bullet' }, paraSpaceAfter: 12 } },
  { text: 'Data Layer', options: { color: ACCENT, fontSize: 18, bold: true, paraSpaceAfter: 4 } },
  { text: 'Redis (Upstash) — Queue storage, job state, BullMQ backend', options: { color: WHITE, fontSize: 15, bullet: { type: 'bullet' }, paraSpaceAfter: 4 } },
  { text: 'PostgreSQL (Render) — Tasks, workers, execution logs, DLQ tables', options: { color: WHITE, fontSize: 15, bullet: { type: 'bullet' }, paraSpaceAfter: 12 } },
  { text: 'Frontend & Deployment', options: { color: ACCENT, fontSize: 18, bold: true, paraSpaceAfter: 4 } },
  { text: 'Vanilla HTML/CSS/JS — Zero-framework live dashboard', options: { color: WHITE, fontSize: 15, bullet: { type: 'bullet' }, paraSpaceAfter: 4 } },
  { text: 'Render.com — Single free-tier web service (API + Workers + Frontend)', options: { color: WHITE, fontSize: 15, bullet: { type: 'bullet' }, paraSpaceAfter: 4 } },
]);

// ── SLIDE 5: Architecture ─────────────────────────────────
addSlide('System Architecture', [
  { text: 'Single Process — API + Workers + Monitor in one Node.js server', options: { color: YELLOW, fontSize: 16, bold: true, paraSpaceAfter: 10 } },
  { text: 'Client  →  REST API  →  BullMQ Queue  →  Workers', options: { color: ACCENT, fontSize: 17, bold: true, paraSpaceAfter: 6 } },
  { text: 'Workers pull jobs from Redis queues (email / file / report)', options: { color: WHITE, fontSize: 15, bullet: { type: 'bullet' }, paraSpaceAfter: 5 } },
  { text: 'Workers write results + logs to PostgreSQL', options: { color: WHITE, fontSize: 15, bullet: { type: 'bullet' }, paraSpaceAfter: 5 } },
  { text: 'Workers emit Socket.IO events → Dashboard updates live', options: { color: WHITE, fontSize: 15, bullet: { type: 'bullet' }, paraSpaceAfter: 12 } },
  { text: 'Heartbeat Monitor  →  Failure Detection  →  Auto Reassign', options: { color: ACCENT, fontSize: 17, bold: true, paraSpaceAfter: 6 } },
  { text: 'Monitor polls PostgreSQL every 10s for stale workers (>15s)', options: { color: WHITE, fontSize: 15, bullet: { type: 'bullet' }, paraSpaceAfter: 5 } },
  { text: 'Marks worker DEAD, re-queues their PROCESSING tasks', options: { color: WHITE, fontSize: 15, bullet: { type: 'bullet' }, paraSpaceAfter: 5 } },
  { text: 'Syncs BullMQ failed jobs into DLQ table automatically', options: { color: WHITE, fontSize: 15, bullet: { type: 'bullet' }, paraSpaceAfter: 5 } },
]);

// ── SLIDE 6: Queue & Worker Design ───────────────────────
addSlide('Queue & Worker Design', [
  { text: '3 Dedicated Queues', options: { color: ACCENT, fontSize: 18, bold: true, paraSpaceAfter: 6 } },
  { text: 'email-queue   →   emailWorker   (send-email jobs, 2s simulation)', options: { color: WHITE, fontSize: 15, bullet: { type: 'bullet' }, paraSpaceAfter: 5 } },
  { text: 'file-queue    →   fileWorker    (process-file jobs, 3s simulation)', options: { color: WHITE, fontSize: 15, bullet: { type: 'bullet' }, paraSpaceAfter: 5 } },
  { text: 'report-queue  →   reportWorker  (generate-report jobs, 4s simulation)', options: { color: WHITE, fontSize: 15, bullet: { type: 'bullet' }, paraSpaceAfter: 5 } },
  { text: 'dlq-queue     →   Dead Letter Queue for exhausted jobs', options: { color: RED, fontSize: 15, bullet: { type: 'bullet' }, paraSpaceAfter: 14 } },
  { text: 'Worker Lifecycle', options: { color: ACCENT, fontSize: 18, bold: true, paraSpaceAfter: 6 } },
  { text: 'Startup → Register in PostgreSQL with UUID', options: { color: WHITE, fontSize: 15, bullet: { type: 'bullet' }, paraSpaceAfter: 5 } },
  { text: 'Running → Heartbeat every 5s, process jobs, log events', options: { color: WHITE, fontSize: 15, bullet: { type: 'bullet' }, paraSpaceAfter: 5 } },
  { text: 'Failure → Monitor detects, marks DEAD, reassigns tasks', options: { color: WHITE, fontSize: 15, bullet: { type: 'bullet' }, paraSpaceAfter: 5 } },
]);

// ── SLIDE 7: Failure Handling ─────────────────────────────
addSlide('Fault Tolerance & Failure Handling', [
  { text: 'Scenario 1 — Job Fails Mid-Execution', options: { color: YELLOW, fontSize: 17, bold: true, paraSpaceAfter: 5 } },
  { text: 'BullMQ automatically retries up to max_attempts (default: 3)', options: { color: WHITE, fontSize: 15, bullet: { type: 'bullet' }, paraSpaceAfter: 5 } },
  { text: 'Each attempt logged in execution_logs table', options: { color: WHITE, fontSize: 15, bullet: { type: 'bullet' }, paraSpaceAfter: 12 } },
  { text: 'Scenario 2 — Worker Crashes', options: { color: YELLOW, fontSize: 17, bold: true, paraSpaceAfter: 5 } },
  { text: 'Heartbeat monitor detects silence after 15s', options: { color: WHITE, fontSize: 15, bullet: { type: 'bullet' }, paraSpaceAfter: 5 } },
  { text: 'Worker marked DEAD in PostgreSQL', options: { color: WHITE, fontSize: 15, bullet: { type: 'bullet' }, paraSpaceAfter: 5 } },
  { text: 'All PROCESSING tasks re-queued automatically', options: { color: WHITE, fontSize: 15, bullet: { type: 'bullet' }, paraSpaceAfter: 12 } },
  { text: 'Scenario 3 — All Retries Exhausted', options: { color: YELLOW, fontSize: 17, bold: true, paraSpaceAfter: 5 } },
  { text: 'Task moved to DLQ with failure reason + attempt count', options: { color: WHITE, fontSize: 15, bullet: { type: 'bullet' }, paraSpaceAfter: 5 } },
  { text: 'Dashboard shows DLQ panel — operator can Retry or Discard', options: { color: WHITE, fontSize: 15, bullet: { type: 'bullet' }, paraSpaceAfter: 5 } },
]);

// ── SLIDE 8: REST API ─────────────────────────────────────
addSlide('REST API Endpoints', [
  { text: 'Task Endpoints', options: { color: ACCENT, fontSize: 17, bold: true, paraSpaceAfter: 5 } },
  { text: 'POST   /api/tasks              — Submit a new task', options: { color: WHITE, fontSize: 15, bullet: { type: 'bullet' }, paraSpaceAfter: 4 } },
  { text: 'GET    /api/tasks              — List all tasks', options: { color: WHITE, fontSize: 15, bullet: { type: 'bullet' }, paraSpaceAfter: 4 } },
  { text: 'GET    /api/tasks/:id          — Get task by ID', options: { color: WHITE, fontSize: 15, bullet: { type: 'bullet' }, paraSpaceAfter: 4 } },
  { text: 'GET    /api/tasks/dlq          — List DLQ tasks', options: { color: WHITE, fontSize: 15, bullet: { type: 'bullet' }, paraSpaceAfter: 4 } },
  { text: 'POST   /api/tasks/dlq/:id/retry   — Retry DLQ task', options: { color: WHITE, fontSize: 15, bullet: { type: 'bullet' }, paraSpaceAfter: 4 } },
  { text: 'DELETE /api/tasks/dlq/:id/discard — Discard DLQ task', options: { color: WHITE, fontSize: 15, bullet: { type: 'bullet' }, paraSpaceAfter: 12 } },
  { text: 'Worker Endpoints', options: { color: ACCENT, fontSize: 17, bold: true, paraSpaceAfter: 5 } },
  { text: 'GET    /api/workers            — List all workers + status', options: { color: WHITE, fontSize: 15, bullet: { type: 'bullet' }, paraSpaceAfter: 4 } },
  { text: 'GET    /api/workers/stats/metrics — Queue stats per worker', options: { color: WHITE, fontSize: 15, bullet: { type: 'bullet' }, paraSpaceAfter: 4 } },
  { text: 'GET    /health                 — Redis + PostgreSQL health check', options: { color: WHITE, fontSize: 15, bullet: { type: 'bullet' }, paraSpaceAfter: 4 } },
]);

// ── SLIDE 9: Real-Time Dashboard ──────────────────────────
addSlide('Real-Time Observability Dashboard', [
  { text: 'Socket.IO broadcasts every 2 seconds:', options: { color: YELLOW, fontSize: 16, bold: true, paraSpaceAfter: 8 } },
  { text: 'queue:stats   — Active / waiting / completed / failed counts per queue', options: { color: WHITE, fontSize: 15, bullet: { type: 'bullet' }, paraSpaceAfter: 5 } },
  { text: 'worker:status — Live worker health cards (ALIVE / DEAD / IDLE)', options: { color: WHITE, fontSize: 15, bullet: { type: 'bullet' }, paraSpaceAfter: 5 } },
  { text: 'dlq:update    — DLQ panel refreshes with latest failed tasks', options: { color: WHITE, fontSize: 15, bullet: { type: 'bullet' }, paraSpaceAfter: 5 } },
  { text: 'log:feed      — Execution log stream (PICKED_UP / COMPLETED / FAILED)', options: { color: WHITE, fontSize: 15, bullet: { type: 'bullet' }, paraSpaceAfter: 12 } },
  { text: 'Dashboard Panels:', options: { color: ACCENT, fontSize: 16, bold: true, paraSpaceAfter: 6 } },
  { text: 'Metrics bar — total queued, processing, completed, failed', options: { color: WHITE, fontSize: 15, bullet: { type: 'bullet' }, paraSpaceAfter: 5 } },
  { text: 'Worker health cards — heartbeat status, jobs done, jobs failed', options: { color: WHITE, fontSize: 15, bullet: { type: 'bullet' }, paraSpaceAfter: 5 } },
  { text: 'Submit task form — type, payload, priority, delay', options: { color: WHITE, fontSize: 15, bullet: { type: 'bullet' }, paraSpaceAfter: 5 } },
  { text: 'Task feed table + DLQ panel + live execution log', options: { color: WHITE, fontSize: 15, bullet: { type: 'bullet' }, paraSpaceAfter: 5 } },
]);

// ── SLIDE 10: Database Schema ─────────────────────────────
addSlide('Database Schema (PostgreSQL)', [
  { text: 'tasks', options: { color: ACCENT, fontSize: 16, bold: true, paraSpaceAfter: 3 } },
  { text: 'id, type, payload (JSONB), status, priority, delay_ms, attempts, max_attempts, worker_id, bullmq_job_id', options: { color: WHITE, fontSize: 14, paraSpaceAfter: 8 } },
  { text: 'workers', options: { color: ACCENT, fontSize: 16, bold: true, paraSpaceAfter: 3 } },
  { text: 'id, name, type, status (ALIVE/DEAD/IDLE), last_heartbeat, jobs_completed, jobs_failed', options: { color: WHITE, fontSize: 14, paraSpaceAfter: 8 } },
  { text: 'execution_logs', options: { color: ACCENT, fontSize: 16, bold: true, paraSpaceAfter: 3 } },
  { text: 'id, task_id, worker_id, worker_name, event (PICKED_UP/COMPLETED/FAILED/REASSIGNED), message', options: { color: WHITE, fontSize: 14, paraSpaceAfter: 8 } },
  { text: 'dlq_tasks', options: { color: ACCENT, fontSize: 16, bold: true, paraSpaceAfter: 3 } },
  { text: 'id, original_task_id (UNIQUE), type, payload, reason, attempts, retried, retried_at', options: { color: WHITE, fontSize: 14, paraSpaceAfter: 8 } },
  { text: 'scheduled_tasks', options: { color: ACCENT, fontSize: 16, bold: true, paraSpaceAfter: 3 } },
  { text: 'id, task_id, run_at, status (PENDING/DISPATCHED/CANCELLED)', options: { color: WHITE, fontSize: 14, paraSpaceAfter: 5 } },
]);

// ── SLIDE 11: Deployment ──────────────────────────────────
addSlide('Deployment Architecture', [
  { text: 'Single Render Free-Tier Web Service', options: { color: YELLOW, fontSize: 17, bold: true, paraSpaceAfter: 8 } },
  { text: 'One process runs: Express API + 3 Workers + Heartbeat Monitor + Socket.IO', options: { color: WHITE, fontSize: 15, bullet: { type: 'bullet' }, paraSpaceAfter: 5 } },
  { text: 'Frontend served as static files from the same Express server', options: { color: WHITE, fontSize: 15, bullet: { type: 'bullet' }, paraSpaceAfter: 5 } },
  { text: 'Schema auto-runs on startup — no manual DB setup needed', options: { color: WHITE, fontSize: 15, bullet: { type: 'bullet' }, paraSpaceAfter: 12 } },
  { text: 'Services', options: { color: ACCENT, fontSize: 17, bold: true, paraSpaceAfter: 6 } },
  { text: 'Render Web Service  — task-scheduler-api-gukn.onrender.com', options: { color: WHITE, fontSize: 15, bullet: { type: 'bullet' }, paraSpaceAfter: 5 } },
  { text: 'Render PostgreSQL   — Internal URL (no SSL, same network)', options: { color: WHITE, fontSize: 15, bullet: { type: 'bullet' }, paraSpaceAfter: 5 } },
  { text: 'Upstash Redis       — rediss:// TLS connection from Render', options: { color: WHITE, fontSize: 15, bullet: { type: 'bullet' }, paraSpaceAfter: 5 } },
  { text: 'GitHub CI           — Auto-deploy on every push to main', options: { color: WHITE, fontSize: 15, bullet: { type: 'bullet' }, paraSpaceAfter: 5 } },
]);

// ── SLIDE 12: Challenges & Solutions ─────────────────────
addSlide('Challenges & Solutions', [
  { text: 'Dollar-Quoted SQL Trigger', options: { color: RED, fontSize: 16, bold: true, paraSpaceAfter: 3 } },
  { text: 'Naive split(";") broke $$...$$  →  Built dollar-quote-aware SQL parser', options: { color: WHITE, fontSize: 15, paraSpaceAfter: 10 } },
  { text: 'PostgreSQL SSL on Render Internal Network', options: { color: RED, fontSize: 16, bold: true, paraSpaceAfter: 3 } },
  { text: 'Internal DB URL has no .render.com suffix  →  Detect and skip SSL for internal', options: { color: WHITE, fontSize: 15, paraSpaceAfter: 10 } },
  { text: 'Express Route Param Conflicts', options: { color: RED, fontSize: 16, bold: true, paraSpaceAfter: 3 } },
  { text: '/dlq and /stats/metrics matched /:id  →  Register specific routes before param routes', options: { color: WHITE, fontSize: 15, paraSpaceAfter: 10 } },
  { text: 'Single Process on Free Tier', options: { color: RED, fontSize: 16, bold: true, paraSpaceAfter: 3 } },
  { text: 'Render charges for background workers  →  Merged all into one server.js process', options: { color: WHITE, fontSize: 15, paraSpaceAfter: 10 } },
  { text: 'Schema Path on Render', options: { color: RED, fontSize: 16, bold: true, paraSpaceAfter: 3 } },
  { text: '__dirname is src/  →  Path fixed to ../schema.sql', options: { color: WHITE, fontSize: 15, paraSpaceAfter: 5 } },
]);

// ── SLIDE 13: Live Demo ───────────────────────────────────
addSlide('Live Demo', [
  { text: '🌐  Live URL', options: { color: ACCENT, fontSize: 18, bold: true, paraSpaceAfter: 6 } },
  { text: 'https://task-scheduler-api-gukn.onrender.com', options: { color: YELLOW, fontSize: 16, paraSpaceAfter: 14 } },
  { text: 'Demo Flow', options: { color: ACCENT, fontSize: 18, bold: true, paraSpaceAfter: 6 } },
  { text: '1.  Open dashboard — see 3 workers ALIVE with heartbeat', options: { color: WHITE, fontSize: 15, paraSpaceAfter: 6 } },
  { text: '2.  Submit a task (send-email / process-file / generate-report)', options: { color: WHITE, fontSize: 15, paraSpaceAfter: 6 } },
  { text: '3.  Watch task move: QUEUED → PROCESSING → COMPLETED in real-time', options: { color: WHITE, fontSize: 15, paraSpaceAfter: 6 } },
  { text: '4.  Submit task with max_attempts=1 to force DLQ entry', options: { color: WHITE, fontSize: 15, paraSpaceAfter: 6 } },
  { text: '5.  Retry or Discard from DLQ panel', options: { color: WHITE, fontSize: 15, paraSpaceAfter: 6 } },
  { text: '6.  Check /health endpoint — Redis + PostgreSQL status', options: { color: WHITE, fontSize: 15, paraSpaceAfter: 6 } },
]);

// ── SLIDE 14: Summary ─────────────────────────────────────
{
  const slide = pptx.addSlide();
  slide.background = { color: BG };
  slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: '100%', h: 0.08, fill: { color: ACCENT } });
  slide.addShape(pptx.ShapeType.rect, { x: 0, y: 7.0, w: '100%', h: 0.5, fill: { color: ACCENT2 } });

  slide.addText('What We Built', {
    x: 0.4, y: 0.18, w: 9.2, h: 0.7,
    fontSize: 28, bold: true, color: ACCENT, fontFace: 'Segoe UI'
  });
  slide.addShape(pptx.ShapeType.rect, { x: 0.4, y: 0.95, w: 9.2, h: 0.03, fill: { color: ACCENT2 } });

  const summary = [
    { icon: '✅', text: 'At-least-once execution with BullMQ retry' },
    { icon: '💀', text: 'Dead Letter Queue with retry/discard from UI' },
    { icon: '❤️', text: 'Worker heartbeat + automatic task reassignment' },
    { icon: '📊', text: 'Real-time Socket.IO dashboard — zero refresh' },
    { icon: '🗄️', text: 'Full audit trail in PostgreSQL' },
    { icon: '🚀', text: 'Deployed live on Render free tier' },
  ];

  summary.forEach((item, i) => {
    slide.addText(`${item.icon}  ${item.text}`, {
      x: 0.6, y: 1.2 + i * 0.82, w: 8.8, h: 0.65,
      fontSize: 17, color: WHITE, fontFace: 'Segoe UI', bold: false
    });
  });

  slide.addText('GitHub: github.com/MASTERHARI2030/TASK-SCHEDULER', {
    x: 0.5, y: 7.05, w: 9.0, h: 0.35,
    fontSize: 12, color: WHITE, fontFace: 'Segoe UI', align: 'center'
  });
}

pptx.writeFile({ fileName: 'Distributed_Task_Scheduler.pptx' })
  .then(() => console.log('PPT created: Distributed_Task_Scheduler.pptx'))
  .catch(err => console.error('Error:', err));
