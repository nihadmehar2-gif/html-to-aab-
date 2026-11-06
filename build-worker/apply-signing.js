'use strict';

/**
 * Step 7 — provision the keystore and configure Gradle signing.
 *
 * Modes:
 *  - generate: create a NEW keystore on the runner (keytool). It is later
 *    returned to the user encrypted, and wiped from the workspace.
 *  - upload:   use the user's uploaded .jks (decrypted from the payload).
 *  - secret:   use repo Actions secrets KEYSTORE_BASE64 / KEYSTORE_PASSWORD /
 *              KEY_ALIAS / KEY_PASSWORD (recommended for CI reuse).
 *  - none:     leave the release unsigned.
 *
 * Passwords are passed via env vars so they never appear in workflow logs.
 */

const fs = require('fs');
const { execSync } = require('child_process');
const { loadConfig, loadSigning } = require('./lib-common');

function patchGradle() {
  const file = 'app/android/app/build.gradle';
  let g = fs.readFileSync(file, 'utf8');
  if (g.includes('keystorePropertiesFile')) {
    console.log('Gradle signing block already present');
    return;
  }

  const header = `
def keystorePropertiesFile = rootProject.file("keystore.properties")
def keystoreProperties = new Properties()
if (keystorePropertiesFile.exists()) {
    keystoreProperties.load(new FileInputStream(keystorePropertiesFile))
}
`;
  const block = `
    if (keystorePropertiesFile.exists()) {
        signingConfigs {
            release {
                keyAlias keystoreProperties['keyAlias']
                keyPassword keystoreProperties['keyPassword']
                storeFile file(keystoreProperties['storeFile'])
                storePassword keystoreProperties['storePassword']
            }
        }
        buildTypes {
            release {
                signingConfig signingConfigs.release
            }
        }
    }
`;

  g = header + g;
  g = g.replace('android {', `android {${block}\n`);
  fs.writeFileSync(file, g);
  console.log('Gradle signing config applied (keystore.properties pattern)');
}

function writeProperties(storeFile, storePassword, keyAlias, keyPassword) {
  fs.writeFileSync(
    'app/android/keystore.properties',
    [`storeFile=${storeFile}`, `storePassword=${storePassword}`, `keyAlias=${keyAlias}`, `keyPassword=${keyPassword}`].join('\n')
  );
}

function main() {
  const cfg = loadConfig();
  const signing = loadSigning();

  if (signing.mode === 'generate') {
    const store = process.env.W2A_STORE_PASSWORD || signing.storePassword;
    const keyPass = process.env.W2A_KEY_PASSWORD || signing.keyPassword || store;
    execSync(
      `keytool -genkeypair -v -keystore android/keystore.jks -alias "${signing.keyAlias}" -keyalg RSA -keysize 2048 -validity 10000 ` +
        `-storepass "$W2A_STORE" -keypass "$W2A_KEY" -dname "CN=${cfg.appName.replace(/"/g, '')}, OU=Web2APK Studio, O=Web2APK"`,
      {
        cwd: 'app/android',
        stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env, W2A_STORE: store, W2A_KEY: keyPass },
      }
    );
    writeProperties('keystore.jks', store, signing.keyAlias, keyPass);
    patchGradle();
    console.log('New keystore generated (will be delivered encrypted after the build)');
  } else if (signing.mode === 'upload') {
    if (!fs.existsSync('work/keystore.jks')) throw new Error('Uploaded keystore missing from payload');
    fs.copyFileSync('work/keystore.jks', 'app/android/keystore.jks');
    writeProperties('keystore.jks', signing.storePassword, signing.keyAlias, signing.keyPassword || signing.storePassword);
    patchGradle();
    console.log('Using uploaded keystore');
  } else if (signing.mode === 'secret') {
    const b64 = process.env.KEYSTORE_BASE64;
    const pass = process.env.KEYSTORE_PASSWORD;
    const alias = process.env.KEY_ALIAS || 'web2apk';
    const keyPass = process.env.KEY_PASSWORD || pass;
    if (!b64 || !pass) throw new Error('Repo secrets KEYSTORE_BASE64 / KEYSTORE_PASSWORD are not set');
    fs.mkdirSync('app/android', { recursive: true });
    fs.writeFileSync('app/android/keystore.jks', Buffer.from(b64, 'base64'));
    writeProperties('keystore.jks', pass, alias, keyPass);
    patchGradle();
    console.log('Using keystore from repo Actions secrets');
  } else {
    console.log('Signing mode "none" — the release build will be unsigned');
  }
}

main();
