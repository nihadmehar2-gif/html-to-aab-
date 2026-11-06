'use strict';

/**
 * Step 6 — apply permissions, orientation, colors, WebView settings and
 * optional deep links to the generated Android project. Only permissions
 * the user explicitly selected are added to AndroidManifest.xml.
 */

const fs = require('fs');
const path = require('path');
const { loadConfig } = require('./lib-common');

const PERMISSION_MAP = {
  internet: 'android.permission.INTERNET',
  networkState: 'android.permission.ACCESS_NETWORK_STATE',
  camera: 'android.permission.CAMERA',
  microphone: 'android.permission.RECORD_AUDIO',
  fineLocation: 'android.permission.ACCESS_FINE_LOCATION',
  coarseLocation: 'android.permission.ACCESS_COARSE_LOCATION',
  storage: 'android.permission.READ_MEDIA_IMAGES',
  notifications: 'android.permission.POST_NOTIFICATIONS',
  vibration: 'android.permission.VIBRATE',
  bluetooth: 'android.permission.BLUETOOTH_SCAN',
  nfc: 'android.permission.NFC',
  biometric: 'android.permission.USE_BIOMETRIC',
};

function findMainActivity() {
  const base = 'app/android/app/src/main/java';
  const stack = [base];
  while (stack.length) {
    const dir = stack.pop();
    for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, f.name);
      if (f.isDirectory()) stack.push(full);
      else if (f.name === 'MainActivity.java') return full;
    }
  }
  throw new Error('MainActivity.java not found');
}

function patchManifest(cfg) {
  const file = 'app/android/app/src/main/AndroidManifest.xml';
  let m = fs.readFileSync(file, 'utf8');

  // 1. Permissions — only the selected ones
  const perms = (cfg.permissions || []).map((p) => PERMISSION_MAP[p]).filter(Boolean);
  const permXml = perms.map((p) => `    <uses-permission android:name="${p}" />`).join('\n');
  if (!m.includes('uses-permission')) {
    m = m.replace('<application', `${permXml}\n    <application`);
  } else {
    // template already has INTERNET; add the remaining selected ones
    const missing = perms.filter((p) => !m.includes(`android:name="${p}"`));
    if (missing.length) {
      m = m.replace('<application', missing.map((p) => `    <uses-permission android:name="${p}" />`).join('\n') + '\n    <application');
    }
  }

  // 2. Orientation on MainActivity
  if (cfg.orientation && cfg.orientation !== 'default') {
    m = m.replace('<activity', `<activity\n            android:screenOrientation="${cfg.orientation}"`);
  }

  // 3. Cleartext traffic (only when explicitly allowed)
  if (cfg.webview.allowMixedContent === true) {
    m = m.replace('<application', '<application\n            android:usesCleartextTraffic="true"');
  }

  // 4. Deep links intent filter
  if (cfg.android.deepLinks && cfg.android.deepLinks.enabled && cfg.android.customScheme) {
    const host = cfg.android.deepLinks.host || 'open';
    const intentFilter = `            <intent-filter>
                <action android:name="android.intent.action.VIEW" />
                <category android:name="android.intent.category.DEFAULT" />
                <category android:name="android.intent.category.BROWSABLE" />
                <data android:scheme="${cfg.android.customScheme}" android:host="${host}" />
            </intent-filter>`;
    m = m.replace('</activity>', `${intentFilter}\n        </activity>`);
  }

  fs.writeFileSync(file, m);
  console.log(`Manifest: ${perms.length} permission(s), orientation=${cfg.orientation}, deepLinks=${!!(cfg.android.deepLinks && cfg.android.deepLinks.enabled)}`);
}

function patchStyles(cfg) {
  const file = 'app/android/app/src/main/res/values/styles.xml';
  if (!fs.existsSync(file)) return;
  let s = fs.readFileSync(file, 'utf8');

  const items = [];
  let statusBarColor = cfg.appearance.statusBarColor;
  if (cfg.android.edgeToEdge) {
    items.push('<item name="android:windowTranslucentNavigation">true</item>');
    statusBarColor = '#00000000';
  }
  items.push(`<item name="android:statusBarColor">${statusBarColor}</item>`);
  items.push(`<item name="android:navigationBarColor">${cfg.appearance.navBarColor}</item>`);
  if (cfg.android.fullscreen || cfg.android.immersive) {
    items.push('<item name="android:windowFullscreen">true</item>');
  }
  if (cfg.appearance.darkMode === 'dark') items.push('<item name="android:forceDarkAllowed">true</item>');
  if (cfg.appearance.darkMode === 'light') items.push('<item name="android:forceDarkAllowed">false</item>');

  const styleMatch = s.match(/<style name="AppTheme\.NoActionBar"[^>]*>([\s\S]*?)<\/style>/);
  if (styleMatch) {
    const block = styleMatch[0];
    const patched = block.replace('</style>', `    ${items.filter((i) => !block.includes(i)).join('\n    ')}\n</style>`);
    s = s.replace(block, patched);
    fs.writeFileSync(file, s);
    console.log(`Styles: statusBar=${statusBarColor}, navBar=${cfg.appearance.navBarColor}`);
  } else {
    console.log('::warning::AppTheme.NoActionBar style not found — theme colors not applied');
  }
}

function patchMainActivity(cfg) {
  const file = findMainActivity();
  let j = fs.readFileSync(file, 'utf8');
  const patches = [];

  // Immersive mode
  if (cfg.android.immersive) {
    patches.push(`
    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) {
            getWindow().getDecorView().setSystemUiVisibility(
                android.view.View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                    | android.view.View.SYSTEM_UI_FLAG_FULLSCREEN
                    | android.view.View.SYSTEM_UI_FLAG_HIDE_NAVIGATION);
        }
    }`);
  }

  // Back button behavior
  if (cfg.android.backButton === 'confirm') {
    patches.push(`
    @Override
    public void onBackPressed() {
        new android.app.AlertDialog.Builder(this)
            .setTitle("Exit")
            .setMessage("Close this app?")
            .setPositiveButton("Yes", new android.content.DialogInterface.OnClickListener() {
                public void onClick(android.content.DialogInterface d, int i) { finish(); }
            })
            .setNegativeButton("No", null)
            .show();
    }`);
  } else if (cfg.android.backButton === 'exit') {
    patches.push(`
    @Override
    public void onBackPressed() {
        finish();
    }`);
  }

  // Download manager bridge
  if (cfg.webview.downloads) {
    patches.push(`
    private void setupDownloadListener() {
        if (this.bridge == null || this.bridge.getWebView() == null) { return; }
        this.bridge.getWebView().setDownloadListener(new android.webkit.DownloadListener() {
            @Override
            public void onDownloadStart(String url, String userAgent, String contentDisposition, String mimeType, long contentLength) {
                try {
                    android.app.DownloadManager.Request req = new android.app.DownloadManager.Request(android.net.Uri.parse(url));
                    req.setNotificationVisibility(android.app.DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
                    String cookies = android.webkit.CookieManager.getInstance().getCookie(url);
                    if (cookies != null) { req.addRequestHeader("Cookie", cookies); }
                    android.app.DownloadManager dm = (android.app.DownloadManager) getSystemService(android.content.Context.DOWNLOAD_SERVICE);
                    dm.enqueue(req);
                } catch (Exception ex) { }
            }
        });
    }`);
    // call it at the end of onCreate
    j = j.replace(
      'super.onCreate(savedInstanceState);',
      'super.onCreate(savedInstanceState);\n        setupDownloadListener();'
    );
    patches.push('');
  }

  if (patches.length) {
    // insert method patches before the final closing brace of the class
    const lastBrace = j.lastIndexOf('}');
    j = j.slice(0, lastBrace) + patches.join('\n') + '\n' + j.slice(lastBrace);
    fs.writeFileSync(file, j);
    console.log(`MainActivity patched: immersive=${!!cfg.android.immersive}, backButton=${cfg.android.backButton}, downloads=${!!cfg.webview.downloads}`);
  }
}

function main() {
  const cfg = loadConfig();
  patchManifest(cfg);
  patchStyles(cfg);
  patchMainActivity(cfg);
}

main();
