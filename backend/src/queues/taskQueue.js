require('dotenv').config();
const { Queue } = require('bullmq');
const redis = require('../config/redis');

const connection = { host: null, port: null };

// BullMQ requires a separate ioredis connection config, not an instance
// We pass the REDIS_URL directly via connection options
const bullConnection = {
  connection: new (require('ioredis'))(process.env.REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  })
};

const defaultJobOptions = {
  attempts: parseInt(process.env.JOB_ATTEMPTS) || 3,
  backoff: {
    type: 'exponential',
    delay: parseInt(process.env.JOB_BACKOFF_DELAY) || 2000,
  },
  removeOnComplete: false,
  removeOnFail: false,
};

// ── Three task queues ─────────────────────────────────────
const emailQueue = new Queue('email-queue', {
  ...bullConnection,
  defaultJobOptions,
});

const fileQueue = new Queue('file-queue', {
  ...bullConnection,
  defaultJobOptions,
});

const reportQueue = new Queue('report-queue', {
  ...bullConnection,
  defaultJobOptions,
});

// ── Dead Letter Queue ─────────────────────────────────────
const dlqQueue = new Queue('dlq-queue', {
  ...bullConnection,
  defaultJobOptions: {
    attempts: 1,
    removeOnComplete: false,
    removeOnFail: false,
  },
});

// ── Helper: add job to correct queue by task type ─────────
async function enqueueTask(taskId, type, payload, options = {}) {
  const jobData = { taskId, type, payload };
  const jobOptions = {
    jobId: taskId,
    priority: options.priority || 1,
    delay: options.delay || 0,
    ...options,
  };

  switch (type) {
    case 'send-email':
      return emailQueue.add('send-email', jobData, jobOptions);
    case 'process-file':
      return fileQueue.add('process-file', jobData, jobOptions);
    case 'generate-report':
      return reportQueue.add('generate-report', jobData, jobOptions);
    default:
      throw new Error(`Unknown task type: ${type}`);
  }
}

// ── Helper: get queue counts for metrics ─────────────────
async function getQueueStats() {
  const [emailCounts, fileCounts, reportCounts, dlqCounts] = await Promise.all([
    emailQueue.getJobCounts('waiting', 'active', 'completed', 'failed', 'delayed'),
    fileQueue.getJobCounts('waiting', 'active', 'completed', 'failed', 'delayed'),
    reportQueue.getJobCounts('waiting', 'active', 'completed', 'failed', 'delayed'),
    dlqQueue.getJobCounts('waiting', 'active', 'completed', 'failed'),
  ]);

  return {
    email: emailCounts,
    file: fileCounts,
    report: reportCounts,
    dlq: dlqCounts,
    totals: {
      waiting:   emailCounts.waiting   + fileCounts.waiting   + reportCounts.waiting,
      active:    emailCounts.active    + fileCounts.active    + reportCounts.active,
      completed: emailCounts.completed + fileCounts.completed + reportCounts.completed,
      failed:    emailCounts.failed    + fileCounts.failed    + reportCounts.failed,
      delayed:   emailCounts.delayed   + fileCounts.delayed   + reportCounts.delayed,
    }
  };
}

module.exports = {
  emailQueue,
  fileQueue,
  reportQueue,
  dlqQueue,
  enqueueTask,
  getQueueStats,
};
