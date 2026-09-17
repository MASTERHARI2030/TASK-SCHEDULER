-- Run this file once to set up the database
-- psql -d taskscheduler -f schema.sql

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─────────────────────────────────────────
-- TASKS
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tasks (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type          VARCHAR(50) NOT NULL,         -- send-email | process-file | generate-report
  payload       JSONB NOT NULL DEFAULT '{}',
  status        VARCHAR(20) NOT NULL DEFAULT 'QUEUED',  -- QUEUED | PROCESSING | COMPLETED | FAILED | DELAYED
  priority      INTEGER NOT NULL DEFAULT 1,
  delay_ms      INTEGER NOT NULL DEFAULT 0,
  attempts      INTEGER NOT NULL DEFAULT 0,
  max_attempts  INTEGER NOT NULL DEFAULT 3,
  worker_id     UUID,
  bullmq_job_id VARCHAR(100),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────
-- WORKERS
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS workers (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name            VARCHAR(100) NOT NULL UNIQUE,  -- emailWorker | fileWorker | reportWorker
  type            VARCHAR(50) NOT NULL,           -- send-email | process-file | generate-report
  status          VARCHAR(20) NOT NULL DEFAULT 'ALIVE',  -- ALIVE | DEAD | IDLE
  last_heartbeat  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  jobs_completed  INTEGER NOT NULL DEFAULT 0,
  jobs_failed     INTEGER NOT NULL DEFAULT 0,
  registered_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────
-- EXECUTION LOGS
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS execution_logs (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id       UUID REFERENCES tasks(id) ON DELETE CASCADE,
  worker_id     UUID REFERENCES workers(id) ON DELETE SET NULL,
  worker_name   VARCHAR(100),
  event         VARCHAR(50) NOT NULL,   -- PICKED_UP | COMPLETED | FAILED | REASSIGNED
  message       TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────
-- DEAD LETTER QUEUE
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS dlq_tasks (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  original_task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
  type             VARCHAR(50) NOT NULL,
  payload          JSONB NOT NULL DEFAULT '{}',
  reason           TEXT NOT NULL,
  attempts         INTEGER NOT NULL DEFAULT 0,
  failed_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  retried          BOOLEAN NOT NULL DEFAULT FALSE,
  retried_at       TIMESTAMPTZ,
  UNIQUE (original_task_id)
);

-- ─────────────────────────────────────────
-- SCHEDULED TASKS
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS scheduled_tasks (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id     UUID REFERENCES tasks(id) ON DELETE CASCADE,
  run_at      TIMESTAMPTZ NOT NULL,
  status      VARCHAR(20) NOT NULL DEFAULT 'PENDING',  -- PENDING | DISPATCHED | CANCELLED
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────
-- INDEXES
-- ─────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_tasks_status      ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_type        ON tasks(type);
CREATE INDEX IF NOT EXISTS idx_tasks_worker_id   ON tasks(worker_id);
CREATE INDEX IF NOT EXISTS idx_workers_status    ON workers(status);
CREATE INDEX IF NOT EXISTS idx_exec_logs_task_id ON execution_logs(task_id);
CREATE INDEX IF NOT EXISTS idx_dlq_retried       ON dlq_tasks(retried);

-- ─────────────────────────────────────────
-- AUTO-UPDATE updated_at on tasks
-- ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tasks_updated_at ON tasks;
CREATE TRIGGER tasks_updated_at
  BEFORE UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
