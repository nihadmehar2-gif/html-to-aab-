'use strict';

/**
 * Step 10 — collect, verify and rename Gradle outputs into dist/.
 * Verifies APK signatures with apksigner and AAB with jarsigner.
 * Encrypts the generated keystore with the job key before staging it
 * as an artifact (the artifact store is not a secret store).
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { loadConfig, loadSigning, jobKey, encryptJson } = require('./lib-common');

function firstFile(dir, suffix) {
  if (!fs.existsSync(dir)) return null;
  const hit = fs.readdirSync(dir).filter((f) => f.endsWith(suffix));
  return hit.length ? path.join(dir, hit[0]) : null;
}

function latestBuildTools() {
  const base = (process.env.ANDROID_HOME || '') + '/build-tools';
  try {
    const dirs = fs.readdirSync(base).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    return path.join(base, dirs[dirs.length - 1]);
  } catch (e) {
    return null;
  }
}

function main() {
  const cfg = loadConfig();
  const signing = loadSigning();
  fs.mkdirSync('dist', { recursive: true });

  const outApk = firstFile('app/android/app/build/outputs/apk/release', '.apk');
  const outAab = firstFile('app/android/app/build/outputs/bundle/release', '.aab');
  const outDebug = firstFile('app/android/app/build/outputs/apk/debug', '.apk');

  const base = `${cfg.packageId}-${cfg.version}-${cfg.versionCode}`;
  const result = { signed: signing.mode !== 'none', files: {} };

  if (outApk) {
    const unsigned = outApk.includes('unsigned');
    if (!unsigned) {
      const bt = latestBuildTools();
      if (bt) {
        execSync(`"${path.join(bt, 'apksigner')}" verify --print-certs "${outApk}"`, { stdio: ['ignore', 'pipe', 'inherit'] });
        console.log('APK signature verified with apksigner');
      }
    }
    const target = `dist/${base}.apk`;
    fs.copyFileSync(outApk, target);
    result.files.apk = target;
    console.log(`APK ready: ${target} (${(fs.statSync(target).size / 1024 / 1024).toFixed(2)}MB)${unsigned ? ' — UNSIGNED' : ''}`);
  }

  if (outAab) {
    try {
      execSync(`jarsigner -verify "${outAab}"`, { stdio: ['ignore', 'pipe', 'inherit'] });
      console.log('AAB signature verified with jarsigner');
    } catch (e) {
      console.log('::warning::AAB signature verification skipped/failed — file is still staged');
    }
    const target = `dist/${base}.aab`;
    fs.copyFileSync(outAab, target);
    result.files.aab = target;
    console.log(`AAB ready: ${target} (${(fs.statSync(target).size / 1024 / 1024).toFixed(2)}MB)`);
  }

  if (outDebug && cfg.android.debugBuild === true) {
    const target = `dist/${base}-debug.apk`;
    fs.copyFileSync(outDebug, target);
    result.files.debug = target;
    console.log(`Debug APK ready: ${target}`);
  }

  if (signing.mode === 'generate' && fs.existsSync('app/android/keystore.jks')) {
    const enc = encryptJson(
      {
        keystoreBase64: fs.readFileSync('app/android/keystore.jks').toString('base64'),
        storePassword: signing.storePassword,
        keyAlias: signing.keyAlias,
        keyPassword: signing.keyPassword || signing.storePassword,
        packageId: cfg.packageId,
        generatedAt: new Date().toISOString(),
        notice: 'BACK UP THIS FILE AND THE PASSWORDS. Without them you can never update the same app on Google Play.',
      },
      jobKey()
    );
    fs.writeFileSync('dist/keystore.enc', enc);
    result.files.keystore = 'dist/keystore.enc';
    console.log('Generated keystore staged (encrypted with your device key)');
  }

  fs.writeFileSync('work/sign-result.json', JSON.stringify(result, null, 2));
  console.log(`Collect done — signed=${result.signed}`);
}

main();
