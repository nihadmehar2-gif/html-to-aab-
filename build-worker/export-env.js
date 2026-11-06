'use strict';

/**
 * Exports build parameters into $GITHUB_ENV so later workflow steps can
 * use them in `if:` conditions and shell commands.
 */

const fs = require('fs');
const { loadConfig, loadSigning } = require('./lib-common');

const cfg = loadConfig();
const signing = loadSigning();

const lines = [
  `BUILD_APK=${cfg.buildType === 'apk' || cfg.buildType === 'both'}`,
  `BUILD_AAB=${cfg.buildType === 'aab' || cfg.buildType === 'both'}`,
  `BUILD_DEBUG=${cfg.android && cfg.android.debugBuild === true}`,
  `DEBUG_TASKS=${cfg.android && cfg.android.debugBuild === true ? 'assembleDebug' : ''}`,
  `VERSION_NAME=${cfg.version}`,
  `VERSION_CODE=${cfg.versionCode}`,
  `PACKAGE_ID=${cfg.packageId}`,
  `SIGNED=${signing.mode !== 'none'}`,
];

if (process.env.GITHUB_ENV) {
  fs.appendFileSync(process.env.GITHUB_ENV, lines.join('\n') + '\n');
}
console.log(lines.join('\n'));
