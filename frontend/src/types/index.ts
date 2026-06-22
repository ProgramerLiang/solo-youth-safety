export type PageId =
  | 'overview'
  | 'sos'
  | 'history'
  | 'tracking'
  | 'playback'
  | 'config'
  | 'contacts'
  | 'theme'
  | 'tools'
  | 'tripHistory'

export const ALL_PAGE_IDS: PageId[] = [
  'overview',
  'sos',
  'history',
  'tracking',
  'playback',
  'config',
  'contacts',
  'theme',
  'tools',
  'tripHistory',
]

export interface PageItem {
  id: PageId
  label: string
  icon: string
}

// Theme
export type ThemeMode = 'light' | 'dark' | 'auto'
export type PaletteMode = 'dynamic' | 'preset' | 'custom'

export interface DynamicColorInfo {
  /** argb uint32 */
  sourceColor: number
  /** hex string for UI display */
  sourceHex: string
}

export interface ThemePreferences {
  mode: ThemeMode
  paletteMode: PaletteMode
  dynamicColor?: DynamicColorInfo
  customColors?: Record<string, string>
  presetName?: string
}

export const PRESET_PALETTES: Record<string, string> = {
  blue: '#1976d2',
  green: '#2e7d32',
  purple: '#7b1fa2',
  orange: '#f57c00',
  teal: '#00796b',
  pink: '#c2185b',
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
  status: 'pending' | 'running' | 'success' | 'error'
  error?: string
}

export interface SosResult {
  status: SosFinalStatus
  timestamp: string
  location?: {
    latitude: number
    longitude: number
    accuracy?: number
  }
  steps: SosStep[]
  contactsNotified: string[]
}

// Data models
export interface Contact {
  id: string
  name: string
  phone: string
}

export interface AppConfig {
  contacts: Contact[]
  sos: { countdown: number }
  tracking: { interval: number }
  identity: { name: string; phone: string }
}

export interface TrackingSnapshot {
  id: string
  timestamp: string
  latitude: number
  longitude: number
  accuracy?: number
  altitude?: number
  speed?: number
  heading?: number
}

export interface StoredIdentity {
  name: string
  phone: string
}

export interface TrackingPoint {
  lat: number
  lng: number
  timestamp: string
  accuracy?: number
}

export interface SosEvent {
  id: string
  type: 'trigger' | 'cancel' | 'complete'
  timestamp: string
  reason?: string
}

export interface NotificationLog {
  id: string
  timestamp: string
  message: string
}

export interface SosHistoryItem {
  id: string
  timestamp: string
  status: SosFinalStatus
  location?: { latitude: number; longitude: number }
  contactsNotified: string[]
  steps: SosStep[]
}

// Trip statistics
export interface TripStats {
  total: number
  avgDurationMinutes: number
  onTimeRate: number
  topDestinations: Array<{ destination: string; count: number }>
}

export interface TripPreset {
  id: string
  destination: string
  durationMinutes: number
}

export interface PrivacyLockConfig {
  enabled: boolean
  pinHash: string
}

// Privacy Lock
export interface PrivacyLockConfig {
  enabled: boolean
  pinHash: string
}

// Trip Preset
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
