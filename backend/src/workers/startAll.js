require('dotenv').config();
const { fork } = require('child_process');
const path = require('path');

const workers = [
  { name: 'emailWorker',  file: 'emailWorker.js' },
  { name: 'fileWorker',   file: 'fileWorker.js' },
  { name: 'reportWorker', file: 'reportWorker.js' },
];

const processes = {};

function spawnWorker(workerDef) {
  const workerPath = path.join(__dirname, workerDef.file);
  const child = fork(workerPath, [], { stdio: 'inherit' });

  processes[workerDef.name] = child;
  console.log(`[Launcher] Started ${workerDef.name} (pid: ${child.pid})`);

  // Auto-restart if worker crashes unexpectedly
  child.on('exit', (code, signal) => {
    if (signal === 'SIGTERM' || signal === 'SIGINT') return;
    console.warn(`[Launcher] ${workerDef.name} exited (code: ${code}). Restarting in 3s...`);
    setTimeout(() => spawnWorker(workerDef), 3000);
  });
}

workers.forEach(spawnWorker);

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('[Launcher] SIGTERM received — shutting down all workers');
  Object.values(processes).forEach((p) => p.kill('SIGTERM'));
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('[Launcher] SIGINT received — shutting down all workers');
  Object.values(processes).forEach((p) => p.kill('SIGTERM'));
  process.exit(0);
});
