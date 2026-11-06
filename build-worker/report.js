'use strict';

/**
 * Real build progress reporter.
 *
 * Every workflow step calls this script; it rewrites the ENCRYPTED
 * status file (jobs/<id>/status.enc) on the jobs branch. The web app
 * polls the API which decrypts this file — so the progress the user
 * sees is the actual state of the GitHub Actions run, never simulated.
 *
 * Usage:
 *   node report.js --init
 *   node report.js --step N --status running|done|failed [--log "msg"] [--log-file path]
 *   node report.js --done [--log "msg"]
 *   node report.js --fail --error "message"
 */

const fs = require('fs');
const {
  jobId, jobKey, encryptJson, putFile, ghRawBuffer, loadSigning, redact,
} = require('./lib-common');

const STEPS = [
  'Receive & stage build payload',
  'Validate & extract web assets',
  'Prepare Capacitor project',
  'Add Android platform & sync',
  'Generate icon & splash',
  'Apply permissions & manifest',
  'Configure Gradle signing',
  'Compile APK (Gradle)',
  'Compile AAB (Gradle)',
  'Sign & verify artifacts',
  'Upload build artifacts',
  'Finalize build status',
  'Clean up sensitive data',
];

const STEP_PERCENT = [5, 12, 20, 28, 36, 44, 50, 62, 74, 84, 92, 98, 100];

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--init') args.init = true;
    else if (a === '--done') args.done = true;
    else if (a === '--fail') args.fail = true;
    else if (a === '--step') args.step = parseInt(argv[++i], 10);
    else if (a === '--status') args.status = argv[++i];
    else if (a === '--log') args.log = argv[++i];
    else if (a === '--log-file') args.logFile = argv[++i];
    else if (a === '--error') args.error = argv[++i];
  }
  return args;
}

function newStatus(id) {
  return {
    jobId: id,
    state: 'running',
    progress: 0,
    currentStep: 0,
    steps: STEPS.map((name, i) => ({ id: i + 1, key: name, name, status: 'pending' })),
    logs: [],
    error: null,
    startedAt: new Date().toISOString(),
    completedAt: null,
    durationSec: null,
    signed: null,
  };
}

async function loadExisting(id, key) {
  try {
    const enc = await ghRawBuffer(`repos/${process.env.OWNER}/${process.env.REPO}/contents/jobs/${id}/status.enc?ref=${process.env.JOBS_BRANCH}`);
    const { decryptBuffer } = require('./lib-common');
    return JSON.parse(decryptBuffer(enc, key).toString('utf8'));
  } catch (e) {
    return null;
  }
}

function tailRedacted(path, maxLines) {
  try {
    const lines = fs.readFileSync(path, 'utf8').split('\n').map((l) => redact(l).slice(0, 300));
    const filtered = lines.filter((l) => l.trim().length > 0);
    return filtered.slice(-maxLines);
  } catch (e) {
    return [];
  }
}

function appendLogs(status, lines) {
  for (const line of lines) {
    const stamp = new Date().toISOString().slice(11, 19);
    status.logs.push(`[${stamp}] ${line}`);
  }
  if (status.logs.length > 200) status.logs = status.logs.slice(-200);
}

(async () => {
  const args = parseArgs(process.argv.slice(2));
  const id = jobId();
  const key = jobKey();
  const status = (await loadExisting(id, key)) || newStatus(id);
  const now = new Date().toISOString();

  if (args.init) {
    status.steps = STEPS.map((name, i) => ({ id: i + 1, key: name, name, status: 'pending' }));
    status.startedAt = now;
    status.state = 'running';
  }

  if (args.step && args.status) {
    const step = status.steps.find((s) => s.id === args.step);
    if (step) {
      step.status = args.status;
      if (args.status === 'running') {
        step.startedAt = step.startedAt || now;
        status.currentStep = args.step;
        status.progress = args.step > 1 ? STEP_PERCENT[args.step - 2] : 0;
        appendLogs(status, [`▶ Step ${args.step}/13: ${step.name}`]);
      } else if (args.status === 'done') {
        step.endedAt = now;
        status.progress = STEP_PERCENT[args.step - 1];
        appendLogs(status, [`✔ Step ${args.step}/13 completed`]);
      } else if (args.status === 'failed') {
        step.endedAt = now;
        appendLogs(status, [`✖ Step ${args.step}/13 failed`]);
      }
    }
  }

  if (args.log) appendLogs(status, [redact(args.log).slice(0, 300)]);
  if (args.logFile) appendLogs(status, tailRedacted(args.logFile, 30));

  if (args.done) {
    status.state = 'success';
    status.progress = 100;
    status.completedAt = now;
    try {
      const sr = JSON.parse(fs.readFileSync('work/sign-result.json', 'utf8'));
      status.signed = !!sr.signed;
      status.artifacts = sr.files || {};
    } catch (e) {
      status.signed = null;
    }
    if (status.startedAt) {
      status.durationSec = Math.round((Date.now() - new Date(status.startedAt).getTime()) / 1000);
    }
    appendLogs(status, ['✔ Build finished successfully']);
  }

  if (args.fail) {
    status.state = 'failure';
    status.completedAt = now;
    status.error = redact(args.error || 'Build failed').slice(0, 300);
    if (status.startedAt) {
      status.durationSec = Math.round((Date.now() - new Date(status.startedAt).getTime()) / 1000);
    }
    appendLogs(status, [`✖ ${status.error}`]);
  }

  await putFile(`jobs/${id}/status.enc`, encryptJson(status, key), `web2apk: status ${id} — ${status.state} ${status.progress}%`);
  console.log(`Status saved: ${status.state} ${status.progress}% (step ${status.currentStep})`);
})().catch((e) => {
  console.error('::warning::report.js failed: ' + redact(e.message || String(e)));
  // never fail the build because of a status write problem
  process.exit(0);
});
