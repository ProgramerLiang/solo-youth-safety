export type PageId =
  | 'home'
  | 'sos'
  | 'history'
  | 'tracking'
  | 'playback'
  | 'config'
  | 'contacts'
  | 'theme'
  | 'tools'
  | 'smartRules'
  | 'messages'
  | 'scenes'
  | 'membership'
  | 'profile'
  | 'ai'

export const ALL_PAGE_IDS: PageId[] = [
  'home',
  'sos',
  'history',
  'playback',
  'tracking',
  'config',
  'contacts',
  'theme',
  'tools',
  'smartRules',
  'messages',
  'scenes',
  'membership',
  'profile',
  'ai',
]


export interface PageItem {
  id: PageId
  label: string
  description: string
}

// Theme
export type ThemeMode = 'light' | 'dark' | 'auto'
export type PaletteMode = 'dynamic' | 'preset' | 'custom'

export interface DynamicColorInfo {
  seed: number
  primary: string
  secondary: string
  tertiary: string
  neutral: string
  neutralVariant: string
  error: string
}

export interface ThemePreferences {
  mode: ThemeMode
  paletteMode: PaletteMode
  presetId: string | null
  customSeed: string | null
  dynamicInfo: DynamicColorInfo | null
}

export const PRESET_PALETTES: Record<string, string> = {
  purple: '#6750A4',
  blue: '#1565C0',
  green: '#2E7D32',
  orange: '#C45A00',
  pink: '#AD1457',
}

// SOS
export type SosFinalStatus =
  | 'idle'
  | 'in-progress'
  | 'success'
  | 'partial-success'
  | 'failed'
  | 'remote-failed'
  | 'location-failed'

export interface SosStep {
  label: string
  badge: string
  detail: string
  tone: 'idle' | 'success' | 'warn' | 'danger'
}

export interface SosResult {
  stage: 'idle' | 'arming' | 'locating' | 'persisting' | 'notifying' | 'done'
  steps: { location: SosStep; persistence: SosStep; sms: SosStep; call: SosStep }
  finalStatus: SosFinalStatus
  finalLabel: string
  summary: string
  note?: string
  triggeredAt?: number
  location?: {
    lat: number
    lng: number
    accuracy: number | null
  }
}

// Data models
export interface Contact {
  id: string
  name: string
  phone: string
}

export interface AppConfig {
  callNumber: string
  smsNumber: string
  smsTemplate: string
  onboardingDone: boolean
}

export interface TrackingSnapshot {
  enabled: boolean
  intervalSeconds: number
  pendingCount: number
  lastCapturedAt: string | null
  lastAcknowledgedAt: string | null
  lastSyncedAt?: string | null
  nextRetryAt: string | null
  queue?: TrackingPoint[]
  history?: TrackingPoint[]
}

export interface StoredIdentity {
  userId: string
  deviceId: string
  platform: string
}

export interface TrackingPoint {
  lat: number
  lng: number
  accuracy: number
  timestamp: number
}

export interface SosEvent {
  userId: string
  deviceId: string
  lat: number | null
  lng: number | null
  timestamp: string
  id?: string
}

export interface NotificationLog {
  channel: 'call' | 'sms'
  status: string
  detail: string
}

export interface SosHistoryItem {
  id: string
  userId: string
  deviceId: string
  lat: number | null
  lng: number | null
  timestamp: string
  notifications: NotificationLog[]
}

// Trip Presets
export interface TripPreset {
  id: string
  destination: string
  durationMinutes: number
}

// Trip Statistics
export interface TripStats {
  total: number
  avgDurationMinutes: number
  onTimeRate: number
  topDestinations: Array<{ destination: string; count: number }>
}

// Privacy Lock
export interface PrivacyLockConfig {
  enabled: boolean
  pinHash: string
}

// Smart Rules (v0.5.0)
export type RuleSignal = 'riskLevel' | 'tripStatus' | 'tripOvertimeMinutes' | 'geofenceEvent' | 'stationaryMinutes'
export type RuleOperator = 'eq' | 'gte' | 'gt'
export type RuleActionType = 'localNotification' | 'preArmSos'

export interface RuleCondition {
  signal: RuleSignal
  operator: RuleOperator
  value: string | number
  label: string
}

export interface RuleAction {
  type: RuleActionType
  config: Record<string, string>
  label: string
}

export interface AutomationRule {
  id: string
  name: string
  enabled: boolean
  conditions: RuleCondition[]
  actions: RuleAction[]
  cooldownMinutes: number
  lastFiredAt: number | null
}

export interface RuleEvaluationState {
  riskLevel: 'ok' | 'attention' | 'warning'
  tripStatus: 'active' | 'overtime' | 'arrived' | 'cancelled' | null
  tripOvertimeMinutes: number | null
  latestGeofenceEvent: { type: 'entered' | 'left'; zoneName: string } | null
  stationaryMinutes: number | null
}