// ── Config ────────────────────────────────────────────────
const API = window.location.hostname === 'localhost'
  ? 'http://localhost:3000'
  : window.location.origin;

// ── State ─────────────────────────────────────────────────
let allTasks = [];
let logEntries = [];
const MAX_LOG = 100;

// ── Socket.IO ─────────────────────────────────────────────
const socket = io(API);

socket.on('connect', () => {
  setConnStatus(true);
});

socket.on('disconnect', () => {
  setConnStatus(false);
});

// Full state on first connect
socket.on('init:state', (data) => {
  updateQueueStats(data.queueStats);
  renderWorkers(data.workers);
  allTasks = data.tasks || [];
  renderTaskTable();
  renderDLQ(data.dlqTasks || []);
  data.logs.forEach(appendLog);
});

// Live broadcasts every 2s
socket.on('queue:stats',   updateQueueStats);
socket.on('worker:status', renderWorkers);
socket.on('dlq:update',    renderDLQ);
socket.on('log:feed',      (logs) => {
  // Only prepend truly new entries
  const existing = new Set(logEntries.map((l) => l.created_at));
  const fresh = logs.filter((l) => !existing.has(l.created_at));
  fresh.forEach(appendLog);
});

// Individual events
socket.on('task:new', (task) => {
  allTasks.unshift(task);
  if (allTasks.length > 200) allTasks.pop();
  renderTaskTable();
});

socket.on('task:update', (update) => {
  const task = allTasks.find((t) => t.id === update.id);
  if (task) {
    task.status = update.status;
    if (update.worker_name) task.worker_name = update.worker_name;
    renderTaskTable();
  }
});

socket.on('task:reassigned', (data) => {
  appendLog({ event: 'REASSIGNED', worker_name: 'MONITOR', message: `Task ${shortId(data.taskId)} reassigned (attempt ${data.attempt})`, created_at: new Date().toISOString() });
});

socket.on('worker:dead', (data) => {
  appendLog({ event: 'FAILED', worker_name: 'MONITOR', message: `Worker ${data.workerName} marked DEAD`, created_at: new Date().toISOString() });
});

socket.on('dlq:new', (data) => {
  appendLog({ event: 'DLQ', worker_name: 'MONITOR', message: `Task ${shortId(data.taskId)} (${data.type}) → DLQ: ${data.reason}`, created_at: new Date().toISOString() });
});

socket.on('log:new', (entry) => {
  appendLog(entry);
});

// ── Clock ─────────────────────────────────────────────────
function updateClock() {
  document.getElementById('clock').textContent = new Date().toLocaleTimeString();
}
setInterval(updateClock, 1000);
updateClock();

// ── Connection status ─────────────────────────────────────
function setConnStatus(connected) {
  const dot   = document.getElementById('connDot');
  const label = document.getElementById('connLabel');
  dot.className = 'conn-dot ' + (connected ? 'connected' : 'disconnected');
  label.textContent = connected ? 'Live' : 'Disconnected';
}

// ── Queue stats ───────────────────────────────────────────
function updateQueueStats(stats) {
  if (!stats) return;
  animateCount('mWaiting',   stats.waiting   || 0);
  animateCount('mActive',    stats.active    || 0);
  animateCount('mCompleted', stats.completed || 0);
  animateCount('mFailed',    stats.failed    || 0);
  animateCount('mDelayed',   stats.delayed   || 0);
}

function animateCount(id, newVal) {
  const el = document.getElementById(id);
  if (!el) return;
  const current = parseInt(el.textContent) || 0;
  if (current === newVal) return;
  el.textContent = newVal;
  el.style.transform = 'scale(1.2)';
  setTimeout(() => { el.style.transform = 'scale(1)'; el.style.transition = 'transform 0.2s'; }, 150);
}

// ── Worker cards ──────────────────────────────────────────
function renderWorkers(workers) {
  if (!workers || !workers.length) return;
  const container = document.getElementById('workerCards');

  container.innerHTML = workers.map((w) => {
    const age     = w.heartbeat_age_seconds || 0;
    const status  = w.status || 'UNKNOWN';
    const badgeCls = status === 'ALIVE' ? 'alive' : status === 'DEAD' ? 'dead' : 'idle';
    const dot      = status === 'ALIVE' ? '●' : status === 'DEAD' ? '✕' : '○';
    const ageColor = age < 8 ? 'var(--green)' : age < 15 ? 'var(--yellow)' : 'var(--red)';
    const typeIcon = { 'send-email': '📧', 'process-file': '📁', 'generate-report': '📊' }[w.type] || '⚙';

    return `
      <div class="worker-card">
        <div class="worker-info">
          <span class="worker-name">${typeIcon} ${w.name}</span>
          <span class="worker-type">${w.type}</span>
          <span class="worker-stats">✓ ${w.jobs_completed} done &nbsp;✗ ${w.jobs_failed} failed</span>
        </div>
        <div class="worker-status-badge">
          <span class="badge ${badgeCls}">${dot} ${status}</span>
          <span class="heartbeat-age" style="color:${ageColor}">♥ ${age}s ago</span>
        </div>
      </div>`;
  }).join('');
}

// ── Task table ────────────────────────────────────────────
function renderTaskTable() {
  const statusFilter = document.getElementById('filterStatus').value;
  const typeFilter   = document.getElementById('filterType').value;

  let tasks = allTasks;
  if (statusFilter) tasks = tasks.filter((t) => t.status === statusFilter);
  if (typeFilter)   tasks = tasks.filter((t) => t.type   === typeFilter);

  const tbody = document.getElementById('taskTableBody');
  if (!tasks.length) {
    tbody.innerHTML = `<tr><td colspan="6" class="empty-row">No tasks found</td></tr>`;
    return;
  }

  const typeIcon = { 'send-email': '📧', 'process-file': '📁', 'generate-report': '📊' };

  tbody.innerHTML = tasks.slice(0, 100).map((t) => `
    <tr>
      <td class="task-id">${shortId(t.id)}</td>
      <td>${typeIcon[t.type] || ''} ${t.type}</td>
      <td><span class="status-pill ${t.status}">${t.status}</span></td>
      <td>${t.worker_name || '<span style="color:var(--muted)">—</span>'}</td>
      <td>${t.priority || 1}</td>
      <td>${formatTime(t.created_at)}</td>
    </tr>`).join('');
}

function filterTasks() {
  renderTaskTable();
}

// ── DLQ panel ─────────────────────────────────────────────
function renderDLQ(dlqTasks) {
  const container = document.getElementById('dlqList');
  if (!dlqTasks || !dlqTasks.length) {
    container.innerHTML = `<p class="empty-msg">No failed tasks</p>`;
    return;
  }

  container.innerHTML = dlqTasks.map((d) => {
    const retried = d.retried;
    return `
      <div class="dlq-item" id="dlq-${d.id}">
        <div class="dlq-info">
          <span class="dlq-type">${d.type}</span>
          <span class="dlq-reason">${d.reason}</span>
          <span class="dlq-meta">Attempts: ${d.attempts} &nbsp;|&nbsp; ${formatTime(d.failed_at)}</span>
        </div>
        <div class="dlq-actions">
          <button class="btn-retry"   ${retried ? 'disabled' : ''} onclick="retryDLQ('${d.id}', this)">
            ${retried ? 'Retried' : 'Retry'}
          </button>
          <button class="btn-discard" onclick="discardDLQ('${d.id}', this)">Discard</button>
        </div>
      </div>`;
  }).join('');
}

async function retryDLQ(dlqId, btn) {
  btn.disabled = true;
  btn.textContent = '...';
  try {
    const res = await fetch(`${API}/api/tasks/dlq/${dlqId}/retry`, { method: 'POST' });
    const data = await res.json();
    if (res.ok) {
      btn.textContent = 'Retried';
      appendLog({ event: 'QUEUED', worker_name: 'DASHBOARD', message: `DLQ task retried → new task ${shortId(data.newTaskId)}`, created_at: new Date().toISOString() });
    } else {
      btn.textContent = data.error || 'Error';
      btn.disabled = false;
    }
  } catch (err) {
    btn.textContent = 'Error';
    btn.disabled = false;
  }
}

async function discardDLQ(dlqId, btn) {
  btn.disabled = true;
  try {
    const res = await fetch(`${API}/api/tasks/dlq/${dlqId}`, { method: 'DELETE' });
    if (res.ok) {
      const item = document.getElementById(`dlq-${dlqId}`);
      if (item) item.remove();
    } else {
      btn.disabled = false;
    }
  } catch {
    btn.disabled = false;
  }
}

// ── Task form ─────────────────────────────────────────────
document.getElementById('taskForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn      = document.getElementById('submitBtn');
  const feedback = document.getElementById('submitFeedback');
  const type     = document.getElementById('taskType').value;
  const priority = parseInt(document.getElementById('taskPriority').value);
  const delay    = parseInt(document.getElementById('taskDelay').value) || 0;

  let payload = {};
  try {
    payload = JSON.parse(document.getElementById('taskPayload').value || '{}');
  } catch {
    feedback.textContent = 'Invalid JSON payload';
    feedback.className = 'submit-feedback error';
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Submitting...';
  feedback.textContent = '';
  feedback.className = 'submit-feedback';

  try {
    const res = await fetch(`${API}/api/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, payload, priority, delay }),
    });
    const data = await res.json();

    if (res.ok) {
      feedback.textContent = `✓ Task ${shortId(data.id)} queued${delay > 0 ? ` (delayed ${delay}ms)` : ''}`;
      feedback.className = 'submit-feedback success';
      document.getElementById('taskPayload').value = '{}';
      document.getElementById('taskDelay').value = '0';
      document.getElementById('taskPriority').value = '1';
      document.getElementById('priorityVal').textContent = '1';
    } else {
      feedback.textContent = `✗ ${data.error}`;
      feedback.className = 'submit-feedback error';
    }
  } catch (err) {
    feedback.textContent = `✗ ${err.message}`;
    feedback.className = 'submit-feedback error';
  } finally {
    btn.disabled = false;
    btn.textContent = 'Submit Task';
    setTimeout(() => { feedback.textContent = ''; }, 4000);
  }
});

// ── Execution log ─────────────────────────────────────────
function appendLog(entry) {
  // Deduplicate
  if (logEntries.some((l) => l.created_at === entry.created_at && l.message === entry.message)) return;

  logEntries.unshift(entry);
  if (logEntries.length > MAX_LOG) logEntries.pop();

  const feed = document.getElementById('logFeed');
  const isEmpty = feed.querySelector('.empty-msg');
  if (isEmpty) isEmpty.remove();

  const source = entry.worker_name || entry.source || 'SYSTEM';
  const event  = entry.event || '';
  const time   = formatTime(entry.created_at);

  const div = document.createElement('div');
  div.className = `log-entry ${event}`;
  div.innerHTML = `
    <span class="log-time">${time}</span>
    <span class="log-source ${source}">${source}</span>
    <span class="log-msg">${entry.message || entry.task_type || ''}</span>`;

  feed.insertBefore(div, feed.firstChild);

  // Trim DOM
  while (feed.children.length > MAX_LOG) feed.removeChild(feed.lastChild);
}

function clearLog() {
  logEntries = [];
  document.getElementById('logFeed').innerHTML = `<p class="empty-msg">Log cleared</p>`;
}

// ── Helpers ───────────────────────────────────────────────
function shortId(id) {
  if (!id) return '—';
  return id.toString().slice(0, 8);
}

function formatTime(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleTimeString();
}
