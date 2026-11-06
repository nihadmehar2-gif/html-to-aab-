export type PermissionKey =
  | 'internet'
  | 'networkState'
  | 'camera'
  | 'microphone'
  | 'fineLocation'
  | 'coarseLocation'
  | 'storage'
  | 'notifications'
  | 'vibration'
  | 'bluetooth'
  | 'nfc'
  | 'biometric';

export type BuildType = 'apk' | 'aab' | 'both';
export type Orientation = 'default' | 'portrait' | 'landscape';
export type SigningMode = 'generate' | 'upload' | 'secret' | 'none';
export type JobState = 'queued' | 'running' | 'success' | 'failure' | 'cancelled';
export type StepStatus = 'pending' | 'running' | 'done' | 'failed';

export interface StepInfo {
  id: number;
  key: string;
  name: string;
  status: StepStatus;
  startedAt?: string;
  endedAt?: string;
}

export interface BuildConfig {
  appName: string;
  packageId: string;
  version: string;
  versionCode: number;
  description: string;
  website: string;
  orientation: Orientation;
  buildType: BuildType;
  permissions: PermissionKey[];
  appearance: {
    iconBase64: string | null;
    themeColor: string;
    statusBarColor: string;
    navBarColor: string;
    splashText: string;
    darkMode: 'system' | 'light' | 'dark';
  };
  webview: {
    javascript: boolean;
    domStorage: boolean;
    fileUpload: boolean;
    allowMixedContent: boolean;
    safeBrowsing: boolean;
    downloads: boolean;
  };
  android: {
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
  };
  signing: {
    mode: SigningMode;
    storePassword: string;
    keyAlias: string;
    keyPassword: string;
    keystoreBase64: string | null;
  };
}

export interface JobStatus {
  jobId: string;
  state: JobState;
  progress: number;
  currentStep: number;
  steps: StepInfo[];
  logs?: string[];
  error?: string | null;
  signed?: boolean | null;
  artifacts?: Record<string, string>;
  startedAt?: string;
  completedAt?: string | null;
  durationSec?: number | null;
}

export interface JobSummary {
  jobId: string;
  createdAt: string;
  state: JobState;
  cleaned: boolean;
}

export interface ArtifactInfo {
  id: number;
  name: string;
  sizeBytes: number;
  kind: 'apk' | 'aab' | 'keystore' | 'debug';
}

export interface ProjectRecord {
  id: string;
  name: string;
  savedAt: string;
  config: BuildConfig;
  jobs: string[];
}

export interface KeystoreProfile {
  id: string;
  packageId: string;
  alias: string;
  storePassword: string;
  keyPassword: string;
  createdAt: string;
  backedUp: boolean;
}

export interface RuntimeConfig {
  maxUploadMb: number;
  retentionDays: number;
  capacitorMajor: number;
  steps: { id: number; key: string; name: string }[];
}

export const PERMISSION_META: { key: PermissionKey; label: string; description: string; dangerous?: boolean; icon: string }[] = [
  { key: 'internet', label: 'Internet', description: 'Load web content (always required)', icon: 'globe' },
  { key: 'networkState', label: 'Network state', description: 'Detect online/offline status', icon: 'wifi' },
  { key: 'camera', label: 'Camera', description: 'Web pages may request camera input', dangerous: true, icon: 'camera' },
  { key: 'microphone', label: 'Microphone', description: 'Web pages may request audio input', dangerous: true, icon: 'mic' },
  { key: 'fineLocation', label: 'Precise location', description: 'GPS-level location access', dangerous: true, icon: 'mappin' },
  { key: 'coarseLocation', label: 'Approximate location', description: 'Cell/wifi based location', dangerous: true, icon: 'map' },
  { key: 'storage', label: 'Photos & media', description: 'Read media via photo picker', dangerous: true, icon: 'image' },
  { key: 'notifications', label: 'Notifications', description: 'Show push notifications (Android 13+)', dangerous: true, icon: 'bell' },
  { key: 'vibration', label: 'Vibration', description: 'Vibration feedback', icon: 'vibrate' },
  { key: 'bluetooth', label: 'Bluetooth', description: 'Scan & connect to nearby devices', icon: 'bluetooth' },
  { key: 'nfc', label: 'NFC', description: 'Near field communication', icon: 'nfc' },
  { key: 'biometric', label: 'Biometrics', description: 'Fingerprint / face unlock APIs', icon: 'fingerprint' },
];
