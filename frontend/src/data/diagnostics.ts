import packageJson from '../../package.json'
import { loadConfig } from './configRepo'
import { loadContacts } from './contactsRepo'
import { loadSosHistory } from './sosRepo'
import { loadThemePrefs } from './themeRepo'
import { loadTrackingState } from './trackingRepo'
import { getStorageDriverLabel } from './storage'
import { loadLocationSelfTestReport } from './locationSelfTestRepo'
import { getLocationDiagnostics } from '../native/nativeLocation'
import type { LocationDiagnostics, LocationSelfTestReport } from '../native/nativeLocation'

export interface DiagnosticAppInfo {
  version: string
  exportedAt: string
}

export interface DiagnosticConfigStatus {
  hasCallNumber: boolean
  hasSmsNumber: boolean
  hasSmsTemplate: boolean
  onboardingDone: boolean
}

export interface DiagnosticCount {
  count: number
}

export interface DiagnosticTrackingStatus {
  enabled: boolean
  intervalSeconds: number
  pendingCount: number
  queueCount: number
  historyCount: number
  lastCapturedAt: string | null
  lastAcknowledgedAt: string | null
  nextRetryAt: string | null
}

export interface DiagnosticLocalData {
  contacts: DiagnosticCount
  sosHistory: DiagnosticCount
  tracking: DiagnosticTrackingStatus
}

export interface DiagnosticThemeStatus {
  mode: string
  paletteMode: string
  presetId: string | null
  hasCustomSeed: boolean
  dynamicColorSupported: boolean
  dynamicColorSource: string | null
}

export interface DiagnosticStorageStatus {
  driver: string
}

export interface DiagnosticPrivacyPolicy {
  manualExportOnly: true
  includesExactCoordinates: false
  includesContactPhones: false
}

export interface DiagnosticLocationStatus extends LocationDiagnostics {
  selfTest: LocationSelfTestReport | null
}

export interface DiagnosticReport {
  schemaVersion: 1
  app: DiagnosticAppInfo
  storage: DiagnosticStorageStatus
  config: DiagnosticConfigStatus
  localData: DiagnosticLocalData
  theme: DiagnosticThemeStatus
  location: DiagnosticLocationStatus
  privacy: DiagnosticPrivacyPolicy
}

function emptyTracking(): DiagnosticTrackingStatus {
  return {
    enabled: false,
    intervalSeconds: 60,
    pendingCount: 0,
    queueCount: 0,
    historyCount: 0,
    lastCapturedAt: null,
    lastAcknowledgedAt: null,
    nextRetryAt: null,
  }
}

export async function exportDiagnosticReport(now = new Date()): Promise<DiagnosticReport> {
  const [config, contacts, sosHistory, tracking, theme, location, selfTest] = await Promise.all([
    loadConfig(),
    loadContacts(),
    loadSosHistory(),
    loadTrackingState(),
    loadThemePrefs(),
    getLocationDiagnostics(),
    loadLocationSelfTestReport(),
  ])

  return {
    schemaVersion: 1,
    app: {
      version: packageJson.version,
      exportedAt: now.toISOString(),
    },
    storage: {
      driver: getStorageDriverLabel(),
    },
    config: {
      hasCallNumber: !!config?.callNumber.trim(),
      hasSmsNumber: !!config?.smsNumber.trim(),
      hasSmsTemplate: !!config?.smsTemplate.trim(),
      onboardingDone: !!config?.onboardingDone,
    },
    localData: {
      contacts: { count: contacts.length },
      sosHistory: { count: sosHistory.length },
      tracking: tracking
        ? {
            enabled: tracking.enabled,
            intervalSeconds: tracking.intervalSeconds,
            pendingCount: tracking.pendingCount,
            queueCount: tracking.queue?.length ?? 0,
            historyCount: tracking.history?.length ?? 0,
            lastCapturedAt: tracking.lastCapturedAt,
            lastAcknowledgedAt: tracking.lastAcknowledgedAt,
            nextRetryAt: tracking.nextRetryAt,
          }
        : emptyTracking(),
    },
    theme: {
      mode: theme?.mode ?? 'unknown',
      paletteMode: theme?.paletteMode ?? 'unknown',
      presetId: theme?.presetId ?? null,
      hasCustomSeed: !!theme?.customSeed,
      dynamicColorSupported: !!theme?.dynamicInfo,
      dynamicColorSource: theme?.dynamicInfo ? 'android-bridge' : null,
    },
    location: { ...location, selfTest },
    privacy: {
      manualExportOnly: true,
      includesExactCoordinates: false,
      includesContactPhones: false,
    },
  }
}
