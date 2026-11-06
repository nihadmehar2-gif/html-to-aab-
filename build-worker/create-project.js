'use strict';

/**
 * Step 3 — prepare the Capacitor project: package.json, pinned Capacitor
 * dependencies, www/ from the validated site, capacitor.config.json.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { loadConfig } = require('./lib-common');

const CAP_VERSION = process.env.CAPACITOR_VERSION || '6';

function slugify(v) {
  return String(v).toLowerCase().replace(/[^a-z0-9._-]/g, '-').slice(0, 40) || 'web2apk-app';
}

function main() {
  const cfg = loadConfig();
  fs.mkdirSync('app', { recursive: true });

  fs.writeFileSync(
    path.join('app', 'package.json'),
    JSON.stringify(
      { name: slugify(cfg.packageId), version: cfg.version, private: true, description: cfg.description || '' },
      null,
      2
    )
  );

  console.log(`Installing Capacitor v${CAP_VERSION} dependencies…`);
  execSync(
    `npm install @capacitor/core@^${CAP_VERSION} @capacitor/cli@^${CAP_VERSION} @capacitor/android@^${CAP_VERSION} --no-audit --no-fund --loglevel=error`,
    { cwd: 'app', stdio: ['ignore', 'inherit', 'inherit'] }
  );

  fs.cpSync('site', path.join('app', 'www'), { recursive: true });
  if (!fs.existsSync(path.join('app', 'www', 'index.html'))) {
    throw new Error('www/index.html missing after copy');
  }

  const capConfig = {
    appId: cfg.packageId,
    appName: cfg.appName,
    webDir: 'www',
    server: {
      androidScheme: 'https',
      errorPath: 'index.html',
      cleartext: false,
    },
    android: {
      allowMixedContent: cfg.webview.allowMixedContent === true,
      captureInput: true,
      webContentsDebuggingEnabled: cfg.android.debugBuild === true,
      backgroundColor: cfg.appearance.themeColor,
    },
    plugins: {
      SplashScreen: {
        backgroundColor: cfg.appearance.themeColor,
        showSpinner: false,
        launchAutoHide: true,
      },
    },
  };
  if (cfg.android.customUserAgent) {
    capConfig.android.appendUserAgent = cfg.android.customUserAgent;
  }

  fs.writeFileSync(path.join('app', 'capacitor.config.json'), JSON.stringify(capConfig, null, 2));
  console.log(`Capacitor project ready: ${cfg.packageId} (${cfg.appName})`);
}

main();
