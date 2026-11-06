import { HttpError } from './errors';

/** Config normalization + validation. Rejects anything unexpected. */

export const PERMISSION_KEYS = [
  'internet',
  'networkState',
  'camera',
  'microphone',
  'fineLocation',
  'coarseLocation',
  'storage',
  'notifications',
  'vibration',
  'bluetooth',
  'nfc',
  'biometric',
] as const;
export type PermissionKey = (typeof PERMISSION_KEYS)[number];

/** Only permissions present in this map are ever written into the manifest. */
export const ANDROID_PERMISSION_MAP: Record<Exclude<PermissionKey, 'internet'>, string> = {
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

export interface WebViewSettings {
  javascript: boolean;
  domStorage: boolean;
  fileUpload: boolean;
  allowMixedContent: boolean;
  safeBrowsing: boolean;
  downloads: boolean;
}

export interface AndroidOptions {
  minSdk: number;
  fullscreen: boolean;
  immersive: boolean;
  edgeToEdge: boolean;
  wakeLock: boolean;
  backButton: 'history' | 'confirm' | 'exit';
  externalLinks: 'system' | 'webview';
  customUserAgent: string;
  customScheme: string;
  deepLinks: { enabled: boolean; host: string };
  debugBuild: boolean;
}

export interface AppearanceConfig {
  iconBase64: string | null;
  themeColor: string;
  statusBarColor: string;
  navBarColor: string;
  splashText: string;
  darkMode: 'system' | 'light' | 'dark';
}

export interface SigningConfig {
  mode: 'generate' | 'upload' | 'secret' | 'none';
  storePassword: string;
  keyAlias: string;
  keyPassword: string;
  keystoreBase64: string | null;
}

export interface NormalizedConfig {
  appName: string;
  packageId: string;
  version: string;
  versionCode: number;
  description: string;
  website: string;
  orientation: 'default' | 'portrait' | 'landscape';
  buildType: 'apk' | 'aab' | 'both';
  permissions: PermissionKey[];
  appearance: AppearanceConfig;
  webview: WebViewSettings;
  android: AndroidOptions;
  signing: SigningConfig;
}

function str(v: unknown, field: string, max: number, required = true): string {
  if (v === undefined || v === null) {
    if (required) throw new HttpError(400, `Field "${field}" is required`);
    return '';
  }
  const s = String(v).trim();
  if (required && !s) throw new HttpError(400, `Field "${field}" must not be empty`);
  if (s.length > max) throw new HttpError(400, `Field "${field}" too long (max ${max})`);
  return s;
}

function bool(v: unknown, fallback: boolean): boolean {
  return typeof v === 'boolean' ? v : fallback;
}

function color(v: unknown, field: string, fallback: string): string {
  if (v === undefined || v === null || v === '') return fallback;
  const s = String(v);
  if (!/^#[0-9a-fA-F]{6}$/.test(s)) throw new HttpError(400, `Field "${field}" must be a hex color like #0B1120`);
  return s.toLowerCase();
}

const PACKAGE_RE = /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*){1,4}$/;
const VERSION_RE = /^\d+\.\d+\.\d+$/;
const SCHEME_RE = /^[a-z][a-z0-9+.-]{1,20}$/;

export function normalizeConfig(raw: any): NormalizedConfig {
  if (!raw || typeof raw !== 'object') throw new HttpError(400, 'config object is required');

  const appName = str(raw.appName, 'appName', 40);
  const packageId = str(raw.packageId, 'packageId', 80).toLowerCase();
  if (!PACKAGE_RE.test(packageId)) {
    throw new HttpError(400, 'packageId must look like com.company.app (lowercase, dots, no dashes)');
  }
  const version = str(raw.version, 'version', 20, false) || '1.0.0';
  if (!VERSION_RE.test(version)) throw new HttpError(400, 'version must be semver-like, e.g. 1.0.0');
  const versionCode = Number(raw.versionCode ?? 1);
  if (!Number.isInteger(versionCode) || versionCode < 1 || versionCode > 2_100_000_000) {
    throw new HttpError(400, 'versionCode must be an integer between 1 and 2100000000');
  }

  const orientation = ['default', 'portrait', 'landscape'].includes(raw.orientation)
    ? (raw.orientation as NormalizedConfig['orientation'])
    : 'default';
  const buildType = ['apk', 'aab', 'both'].includes(raw.buildType) ? (raw.buildType as NormalizedConfig['buildType']) : 'both';

  const requested: PermissionKey[] = Array.isArray(raw.permissions) ? raw.permissions : [];
  const permissions: PermissionKey[] = ['internet'];
  for (const key of requested) {
    if ((PERMISSION_KEYS as readonly string[]).includes(key) && !permissions.includes(key)) permissions.push(key);
  }

  const appearanceRaw = raw.appearance || {};
  let iconBase64: string | null = null;
  if (typeof appearanceRaw.iconBase64 === 'string' && appearanceRaw.iconBase64.length > 0) {
    const buf = Buffer.from(appearanceRaw.iconBase64, 'base64');
    if (buf.length > 2 * 1024 * 1024) throw new HttpError(400, 'Icon too large (max 2MB)');
    if (!(buf.length > 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47)) {
      throw new HttpError(400, 'Icon must be a PNG file');
    }
    iconBase64 = appearanceRaw.iconBase64;
  }
  const appearance: AppearanceConfig = {
    iconBase64,
    themeColor: color(appearanceRaw.themeColor, 'themeColor', '#6D5EF8'),
    statusBarColor: color(appearanceRaw.statusBarColor, 'statusBarColor', '#0B1120'),
    navBarColor: color(appearanceRaw.navBarColor, 'navBarColor', '#0B1120'),
    splashText: str(appearanceRaw.splashText, 'splashText', 30, false),
    darkMode: ['system', 'light', 'dark'].includes(appearanceRaw.darkMode)
      ? appearanceRaw.darkMode
      : 'system',
  };

  const webviewRaw = raw.webview || {};
  const webview: WebViewSettings = {
    javascript: true, // required for a web app; not configurable
    domStorage: bool(webviewRaw.domStorage, true),
    fileUpload: bool(webviewRaw.fileUpload, true),
    allowMixedContent: bool(webviewRaw.allowMixedContent, false),
    safeBrowsing: bool(webviewRaw.safeBrowsing, true),
    downloads: bool(webviewRaw.downloads, false),
  };

  const androidRaw = raw.android || {};
  const minSdk = Number(androidRaw.minSdk ?? 23);
  if (!Number.isInteger(minSdk) || minSdk < 22 || minSdk > 34) {
    throw new HttpError(400, 'minSdk must be between 22 and 34');
  }
  const customScheme = str(androidRaw.customScheme, 'customScheme', 20, false).toLowerCase();
  if (customScheme && !SCHEME_RE.test(customScheme)) {
    throw new HttpError(400, 'customScheme must be a lowercase URI scheme, e.g. myapp');
  }
  const deepLinksRaw = androidRaw.deepLinks || {};
  const android: AndroidOptions = {
    minSdk,
    fullscreen: bool(androidRaw.fullscreen, false),
    immersive: bool(androidRaw.immersive, false),
    edgeToEdge: bool(androidRaw.edgeToEdge, false),
    wakeLock: bool(androidRaw.wakeLock, false),
    backButton: ['history', 'confirm', 'exit'].includes(androidRaw.backButton)
      ? androidRaw.backButton
      : 'history',
    externalLinks: ['system', 'webview'].includes(androidRaw.externalLinks) ? androidRaw.externalLinks : 'system',
    customUserAgent: str(androidRaw.customUserAgent, 'customUserAgent', 200, false),
    customScheme,
    deepLinks: { enabled: bool(deepLinksRaw.enabled, false), host: str(deepLinksRaw.host, 'deepLinks.host', 100, false) },
    debugBuild: bool(androidRaw.debugBuild, false),
  };

  return {
    appName,
    packageId,
    version,
    versionCode,
    description: str(raw.description, 'description', 200, false),
    website: str(raw.website, 'website', 300, false),
    orientation,
    buildType,
    permissions,
    appearance,
    webview,
    android,
    signing: validateSigning(raw.signing),
  };
}

export function validateSigning(raw: any): SigningConfig {
  const mode = raw?.mode;
  if (!['generate', 'upload', 'secret', 'none'].includes(mode)) {
    throw new HttpError(400, 'signing.mode must be one of generate | upload | secret | none');
  }
  const storePassword = typeof raw?.storePassword === 'string' ? raw.storePassword : '';
  const keyPassword = typeof raw?.keyPassword === 'string' ? raw.keyPassword : '';
  const keyAlias = typeof raw?.keyAlias === 'string' && raw.keyAlias.trim() ? raw.keyAlias.trim() : 'web2apk';

  if (mode === 'generate') {
    if (storePassword.length < 6) throw new HttpError(400, 'Keystore password must be at least 6 characters');
    if (keyAlias.length > 40 || !/^[A-Za-z0-9._-]+$/.test(keyAlias)) {
      throw new HttpError(400, 'keyAlias must be 1-40 characters: letters, digits, dot, dash, underscore');
    }
  }
  if (mode === 'upload') {
    if (storePassword.length < 6) throw new HttpError(400, 'Keystore password must be at least 6 characters');
    if (typeof raw?.keystoreBase64 !== 'string' || raw.keystoreBase64.length < 100) {
      throw new HttpError(400, 'Keystore file (.jks) is required for upload mode');
    }
    const ks = Buffer.from(raw.keystoreBase64, 'base64');
    const jksMagic = (ks[0] === 0xfe && ks[1] === 0xed) || (ks[0] === 0xce && ks[1] === 0xce);
    if (!jksMagic) throw new HttpError(400, 'Keystore must be a valid .jks file');
  }
  return {
    mode,
    storePassword,
    keyAlias,
    keyPassword: keyPassword || storePassword,
    keystoreBase64: mode === 'upload' ? raw.keystoreBase64 : null,
  };
}
