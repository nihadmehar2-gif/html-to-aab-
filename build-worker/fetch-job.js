'use strict';

/**
 * Step 1 — fetch the encrypted job payload from the jobs branch and
 * decrypt it locally on the runner. Nothing sensitive is printed.
 */

const fs = require('fs');
const { ghRawBuffer, jobId, jobKey, decryptBuffer, redact } = require('./lib-common');

(async () => {
  const id = jobId();
  const key = jobKey();

  fs.mkdirSync('work', { recursive: true });

  const payloadEnc = await ghRawBuffer(`repos/${process.env.OWNER}/${process.env.REPO}/contents/jobs/${id}/payload.enc?ref=${process.env.JOBS_BRANCH}`);
  let payload;
  try {
    payload = JSON.parse(decryptBuffer(payloadEnc, key).toString('utf8'));
  } catch (e) {
    console.error('::error::Failed to decrypt payload — the job key secret is missing or wrong. Aborting.');
    process.exit(1);
  }

  fs.writeFileSync('work/config.json', JSON.stringify(payload.config, null, 2));
  fs.writeFileSync('work/signing.json', JSON.stringify(payload.signing, null, 2));
  fs.writeFileSync('work/site.zip', Buffer.from(payload.files['site.zip'], 'base64'));
  if (payload.files['icon.png']) fs.writeFileSync('work/icon.png', Buffer.from(payload.files['icon.png'], 'base64'));
  if (payload.files['keystore.jks']) fs.writeFileSync('work/keystore.jks', Buffer.from(payload.files['keystore.jks'], 'base64'));

  console.log(`Job ${id} staged: ${payload.files['site.zip'] ? Math.round(Buffer.from(payload.files['site.zip'], 'base64').length / 1024) : '?'}KB site payload`);
  console.log(`Signing mode: ${redact(payload.signing.mode)}`);
})().catch((e) => {
  console.error('::error::' + redact(e.message || String(e)));
  process.exit(1);
});
