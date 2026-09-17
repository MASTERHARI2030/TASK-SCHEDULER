# Project 03 — Distributed Task Scheduler & Worker System
## Full Implementation Plan

---

## Problem Statement

Build a fault-tolerant, scalable background job queue and worker execution engine.

**Key Requirements:**
- At-least-once task execution with delayed/scheduled job support
- Dead Letter Queue (DLQ) re-processing and worker heartbeat detection with automatic task reassignment
- Real-time observability dashboard — queue depth, worker health, task status

**Mentor will test:**
- Kill worker mid-task → task must reassign automatically
- Heavy load → no queue starvation
- Delayed task precision → runs at exact scheduled time
- Dashboard responsiveness → live updates, no page refresh

---

## Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| Frontend | HTML5 + CSS3 + JavaScript | Dashboard / UI |
| Backend | Node.js + Express.js | REST API + application logic |
| Queue | Redis + BullMQ | Job queue, delayed jobs, retries, DLQ |
| Workers | Node.js Worker processes | Execute background tasks |
| Database | PostgreSQL | Tasks, workers, heartbeats, logs |
| Real-time | Socket.IO | Live dashboard updates |
| Deployment | Render + Upstash Redis | Cloud hosting |
| Source control | Git + GitHub | Version management |

---

## Architecture

```
FRONTEND (HTML/CSS/JS)
        │
        │ HTTP + WebSocket
        ▼
BACKEND (Node.js + Express + Socket.IO)
        │
   ┌────┴────────────────┐
   ▼                     ▼
Redis (BullMQ)        PostgreSQL
   │                     │
   │  job locks          │  tasks
   │  queues             │  workers
   │  DLQ                │  heartbeats
   │                     │  execution_logs
   ▼                     │  dlq_tasks
┌─────────────────┐      │
│  emailWorker    │──────┤
│  fileWorker     │──────┤
│  reportWorker   │──────┘
└─────────────────┘
        │
        ▼
HeartbeatMonitor (separate process)
  - checks stale workers every 10s
  - marks dead workers in PostgreSQL
  - triggers BullMQ reassignment
        │
        ▼
Socket.IO → live dashboard updates every 2s
```

---

## Project Structure

```
task-scheduler/
├── backend/
│   ├── src/
│   │   ├── config/
│   │   │   ├── redis.js
│   │   │   └── db.js
│   │   ├── queues/
│   │   │   └── taskQueue.js
│   │   ├── workers/
│   │   │   ├── emailWorker.js
│   │   │   ├── fileWorker.js
│   │   │   └── reportWorker.js
│   │   ├── monitor/
│   │   │   └── heartbeatMonitor.js
│   │   ├── routes/
│   │   │   ├── tasks.js
│   │   │   └── workers.js
│   │   ├── socket/
│   │   │   └── realtime.js
│   │   └── server.js
│   ├── schema.sql
│   ├── package.json
│   └── .env.example
└── frontend/
    ├── index.html
    ├── style.css
    └── app.js
```

---

## Stage 1 — Foundation & Infrastructure

**Goal:** Server starts, Redis and PostgreSQL connected, schema ready.

### Files to create:
- `backend/package.json` — all dependencies
- `backend/.env.example` — all environment variables
- `backend/src/config/redis.js` — Redis connection
- `backend/src/config/db.js` — PostgreSQL connection
- `backend/schema.sql` — full database schema
- `backend/src/server.js` — Express entry point

### PostgreSQL Tables:
```sql
tasks            -- id, type, payload, status, priority, delay, created_at
workers          -- id, name, type, status, last_heartbeat
execution_logs   -- id, task_id, worker_id, started_at, completed_at, result
dlq_tasks        -- id, original_task_id, reason, failed_at, retried
scheduled_tasks  -- id, task_id, run_at, status
```

### Dependencies:
```json
{
  "express": "^4.18.2",
  "bullmq": "^4.x",
  "ioredis": "^5.x",
  "pg": "^8.x",
  "socket.io": "^4.x",
  "dotenv": "^16.x",
  "uuid": "^9.x",
  "cors": "^2.x"
}
```

### Environment Variables:
```env
PORT=3000
REDIS_URL=redis://localhost:6379
DATABASE_URL=postgresql://user:password@localhost:5432/taskscheduler
```

**Deliverable:** `node src/server.js` starts without errors, DB + Redis connected.

---

## Stage 2 — Queue & Worker Engine

**Goal:** Submit a job, worker picks it up, heartbeat writes to PostgreSQL, job completes.

### Files to create:
- `backend/src/queues/taskQueue.js` — BullMQ queue + DLQ queue definitions
- `backend/src/workers/emailWorker.js` — Worker 1
- `backend/src/workers/fileWorker.js` — Worker 2
- `backend/src/workers/reportWorker.js` — Worker 3

### Worker behavior (each worker):
```
1. Connect to BullMQ queue
2. Write heartbeat to PostgreSQL every 5 seconds
3. Pick up job from queue
4. Simulate task execution (sleep + log)
5. Mark job complete in PostgreSQL
6. On failure → BullMQ retries (max 3)
7. After max retries → move to DLQ
```

### Task types:
| Worker | Queue Name | Simulated Work |
|---|---|---|
| emailWorker | `email-queue` | Simulate sending email (2s delay) |
| fileWorker | `file-queue` | Simulate processing file (3s delay) |
| reportWorker | `report-queue` | Simulate generating report (4s delay) |

### BullMQ config per queue:
```js
{
  attempts: 3,
  backoff: { type: 'exponential', delay: 2000 },
  removeOnComplete: false,
  removeOnFail: false
}
```

**Deliverable:** Submit job via script → worker processes it → PostgreSQL logs the execution.

---

## Stage 3 — Failure Handling & Recovery

**Goal:** Kill a worker → monitor detects in 10s → task reassigns → DLQ catches permanent failures.

### Files to create:
- `backend/src/monitor/heartbeatMonitor.js`

### Heartbeat Monitor logic:
```
Every 10 seconds:
  1. Query PostgreSQL for workers where last_heartbeat < now - 15s
  2. Mark those workers as DEAD
  3. Find tasks assigned to dead workers with status = PROCESSING
  4. Re-queue those tasks back into BullMQ
  5. Emit worker-status-change event via Socket.IO

Every 30 seconds:
  1. Query BullMQ failed queue
  2. Move permanently failed jobs (attempts exhausted) to dlq_tasks table
  3. Emit dlq-update event via Socket.IO
```

### Failure flow:
```
Worker dies mid-task
      │
      ▼
BullMQ lock expires (stall detection)
      │
      ▼
HeartbeatMonitor detects stale heartbeat
      │
      ▼
Task re-queued → picked up by alive worker
      │
      ▼ (if fails 3 times)
Moved to DLQ table in PostgreSQL
      │
      ▼
Dashboard shows DLQ entry + retry button
```

**Deliverable:** Kill emailWorker process → within 15s task reassigns to fileWorker or reportWorker.

---

## Stage 4 — REST API + Real-time Layer

**Goal:** All endpoints work, Socket.IO emitting live events every 2s.

### Files to create:
- `backend/src/routes/tasks.js`
- `backend/src/routes/workers.js`
- `backend/src/socket/realtime.js`
- Update `backend/src/server.js`

### API Endpoints:

#### Tasks
```
POST   /api/tasks              → create new task (immediate or delayed)
GET    /api/tasks              → list all tasks with status
GET    /api/tasks/:id          → single task detail + execution log
POST   /api/tasks/dlq/:id/retry → requeue a DLQ task
DELETE /api/tasks/dlq/:id      → discard a DLQ task
```

#### Workers
```
GET    /api/workers            → all workers + heartbeat age + status
GET    /api/workers/:id        → single worker detail
```

#### Metrics
```
GET    /api/metrics            → queue depths, active jobs, failed jobs count
```

### POST /api/tasks body:
```json
{
  "type": "send-email",
  "payload": { "to": "user@example.com", "subject": "Hello" },
  "priority": 1,
  "delay": 30000
}
```

### Socket.IO events emitted (every 2s):
```
queue:stats     → { waiting, active, completed, failed, delayed }
worker:status   → [ { id, name, type, status, lastHeartbeat, age } ]
task:update     → { id, status, workerId, updatedAt }
dlq:update      → [ { id, originalTaskId, reason, failedAt } ]
log:new         → { taskId, workerId, message, timestamp }
```

**Deliverable:** Postman confirms all endpoints, browser console shows Socket.IO events firing.

---

## Stage 5 — Dashboard + Deployment

**Goal:** Public URL live, judges open it, kill a worker, watch dashboard update in real-time.

### Files to create:
- `frontend/index.html`
- `frontend/style.css`
- `frontend/app.js`

### Dashboard sections:

#### 1. Queue Metrics Bar (top)
```
[ Waiting: 12 ] [ Active: 3 ] [ Completed: 847 ] [ Failed: 2 ] [ Delayed: 5 ]
```

#### 2. Worker Health Cards (3 cards)
```
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│  emailWorker    │  │  fileWorker     │  │  reportWorker   │
│  ● ALIVE        │  │  ● ALIVE        │  │  ✕ DEAD         │
│  Last beat: 2s  │  │  Last beat: 4s  │  │  Last beat: 18s │
│  Jobs done: 142 │  │  Jobs done: 98  │  │  Jobs done: 76  │
└─────────────────┘  └─────────────────┘  └─────────────────┘
```

#### 3. Submit Task Form
```
Task Type:    [ send-email ▼ ]
Priority:     [ 1-10 slider ]
Delay (ms):   [ 0 input ]
Payload:      [ JSON textarea ]
              [ Submit Task ]
```

#### 4. Live Task Feed (scrolling table)
```
ID       Type          Status      Worker         Started    Duration
abc123   send-email    COMPLETED   emailWorker    12:04:01   2.1s
def456   process-file  PROCESSING  fileWorker     12:04:03   ...
ghi789   gen-report    QUEUED      —              —          —
```

#### 5. Dead Letter Queue Panel
```
┌─────────────────────────────────────────────────────┐
│ DEAD LETTER QUEUE                                   │
│                                                     │
│ Task xyz789 | send-email | Failed: max retries      │
│ [ Retry ] [ Discard ]                               │
└─────────────────────────────────────────────────────┘
```

#### 6. Execution Log (live tail)
```
12:04:01  emailWorker   picked up job abc123
12:04:03  emailWorker   completed job abc123 in 2.1s
12:04:05  MONITOR       fileWorker heartbeat stale (18s)
12:04:05  MONITOR       marking fileWorker as DEAD
12:04:06  MONITOR       reassigning job def456 to emailWorker
```

### Render Deployment:

```
GitHub Repository
      │
      ▼
Render Dashboard
      │
      ├── Web Service        (backend/)
      │     start: node src/server.js
      │     env: PORT, DATABASE_URL, REDIS_URL
      │
      ├── Worker Service     (backend/)
      │     start: node src/workers/emailWorker.js
      │           + node src/workers/fileWorker.js
      │           + node src/workers/reportWorker.js
      │
      ├── Monitor Service    (backend/)
      │     start: node src/monitor/heartbeatMonitor.js
      │
      └── PostgreSQL         (Render managed DB)

Redis → Upstash (free tier, connect via REDIS_URL)
```

### render.yaml:
```yaml
services:
  - type: web
    name: task-scheduler-api
    env: node
    buildCommand: npm install
    startCommand: node src/server.js

  - type: worker
    name: task-scheduler-workers
    env: node
    buildCommand: npm install
    startCommand: node src/workers/startAll.js

  - type: worker
    name: task-scheduler-monitor
    env: node
    buildCommand: npm install
    startCommand: node src/monitor/heartbeatMonitor.js

databases:
  - name: task-scheduler-db
    plan: free
```

**Deliverable:** `https://task-scheduler-api.onrender.com` is live, all 5 dashboard sections working, mentor can kill a worker and watch reassignment happen in real-time.

---

## Stage Summary

| Stage | Focus | Files Created | Key Proof |
|---|---|---|---|
| 1 | Infrastructure | config/, schema.sql, server.js, package.json | Server starts, DB + Redis connected |
| 2 | Queue + Workers | taskQueue.js, 3 worker files | Jobs process, heartbeats write to DB |
| 3 | Failure + Recovery | heartbeatMonitor.js | Kill worker → reassign → DLQ works |
| 4 | API + Real-time | routes/, socket/realtime.js | Endpoints tested, Socket.IO live |
| 5 | Dashboard + Deploy | frontend/, render.yaml | Public URL, judges test live failover |

---

## Mentor Evaluation Checklist

- [ ] Kill emailWorker mid-task → task reassigns within 15s
- [ ] Submit 50 tasks at once → all process, none stuck
- [ ] Schedule task with 30s delay → runs at exactly 30s
- [ ] Dashboard updates without page refresh
- [ ] DLQ shows failed tasks → retry button works
- [ ] Worker health cards show DEAD status in real-time
- [ ] Execution logs tail live on dashboard
- [ ] Public Render URL accessible

---

*Start with: `start stage 1`*
