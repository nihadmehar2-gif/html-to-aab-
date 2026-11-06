'use strict';

/**
 * Shared helpers for the build worker scripts that run on the GitHub
 * Actions runner. Plain Node.js, zero dependencies.
 */

const crypto = require('crypto');
const fs = require('fs');

const OWNER = process.env.OWNER || (process.env.GITHUB_REPOSITORY || '').split('/')[0];
const REPO = process.env.REPO || (process.env.GITHUB_REPOSITORY || '').split('/')[1];
const BRANCH = process.env.JOBS_BRANCH || 'jobs';
const TOKEN = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;

function requireEnv(name) {
  const v = process.env[name];
  if (!v) {
    console.error(`::error::Missing environment variable ${name}`);
    process.exit(1);
  }
  return v;
}

function jobId() {
  return requireEnv('JOB_ID');
}

async function gh(path, options = {}) {
  const res = await fetch(`https://api.github.com${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      Accept: options.raw ? 'application/vnd.github.raw' : 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'web2apk-build-worker',
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    },
  });
  return res;
}

async function ghRawBuffer(path) {
  const res = await gh(path, { raw: true });
  if (!res.ok) {
    let detail = '';
    try { detail = (await res.json()).message || ''; } catch (e) { /* ignore */ }
    throw new Error(`GitHub GET ${path} failed: ${res.status} ${detail}`);
  }
  return Buffer.from(await res.arrayBuffer());
}

async function ghJson(path, options = {}) {
  const res = await gh(path, options);
  if (!res.ok) {
    let detail = '';
    try { detail = (await res.json()).message || ''; } catch (e) { /* ignore */ }
    throw new Error(`GitHub ${options.method || 'GET'} ${path} failed: ${res.status} ${detail}`);
  }
  return res.json();
}

async function getContentSha(path) {
  try {
    const cur = await ghJson(`/repos/${OWNER}/${REPO}/contents/${path}?ref=${BRANCH}`);
    return cur.sha;
  } catch (e) {
    if (String(e).includes('404')) return undefined;
    return undefined;
  }
}

/** Create/update a file on the jobs branch with retry on SHA conflicts. */
async function putFile(path, buffer, message) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const sha = await getContentSha(path);
    try {
      await ghJson(`/repos/${OWNER}/${REPO}/contents/${path}`, {
        method: 'PUT',
        body: JSON.stringify({
          message,
          content: buffer.toString('base64'),
          branch: BRANCH,
          ...(sha ? { sha } : {}),
        }),
      });
      return;
    } catch (e) {
      if (String(e).includes('409') && attempt < 4) {
        await new Promise((r) => setTimeout(r, 1500));
        continue;
      }
      throw e;
    }
  }
}

/** Layout: "W2A1" | iv(12) | tag(16) | ciphertext — AES-256-GCM */
function decryptBuffer(enc, key) {
  const magic = Buffer.from('W2A1');
  if (enc.length < magic.length + 28 || !enc.subarray(0, 4).equals(magic)) {
    throw new Error('Invalid encrypted payload format');
  }
  const iv = enc.subarray(4, 16);
  const tag = enc.subarray(16, 32);
  const ct = enc.subarray(32);
  const d = crypto.createDecipheriv('aes-256-gcm', key, iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(ct), d.final()]);
}

function encryptBuffer(plain, key) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ct = Buffer.concat([c.update(plain), c.final()]);
  const tag = c.getAuthTag();
  return Buffer.concat([Buffer.from('W2A1'), iv, tag, ct]);
}

function encryptJson(obj, key) {
  return encryptBuffer(Buffer.from(JSON.stringify(obj), 'utf8'), key);
}

function jobKey() {
  const raw = requireEnv('JOB_SECRET_KEY');
  const key = Buffer.from(raw, 'base64');
  if (key.length !== 32) {
    throw new Error('JOB_SECRET_KEY must decode to 32 bytes (AES-256 key)');
  }
  return key;
}

function readJson(path) {
  return JSON.parse(fs.readFileSync(path, 'utf8'));
}

function loadConfig() {
  return readJson('work/config.json');
}

function loadSigning() {
  try {
    return readJson('work/signing.json');
  } catch (e) {
    return { mode: 'none', storePassword: '', keyAlias: '', keyPassword: '' };
  }
}

/** Never let signing secrets leak into public workflow logs. */
function redact(text) {
  try {
    const s = loadSigning();
    let out = String(text);
    for (const v of [s.storePassword, s.keyPassword, s.keystoreBase64]) {
      if (v && v.length >= 4) out = out.split(v).join('***');
    }
    return out;
  } catch (e) {
    return String(text);
  }
}

module.exports = {
  OWNER,
  REPO,
  BRANCH,
  TOKEN,
  jobId,
  gh,
  ghRawBuffer,
  ghJson,
  putFile,
  decryptBuffer,
  encryptBuffer,
  encryptJson,
  jobKey,
  readJson,
  loadConfig,
  loadSigning,
  redact,
  requireEnv,
};
