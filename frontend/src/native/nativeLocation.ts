import { Capacitor, registerPlugin } from '@capacitor/core'
import { Geolocation } from '@capacitor/geolocation'

export interface LocationResult {
  lat: number
  lng: number
  accuracy: number | null
}

export interface LocationPermissionDiagnostics {
  fine: string
  coarse: string
}

export interface LocationProviderDiagnostics {
  gps: boolean | null
  network: boolean | null
}

export interface LocationDeviceDiagnostics {
  sdkInt: number | null
  brand: string | null
  manufacturer: string | null
  model: string | null
}

export interface LocationAttemptDiagnostics {
  strategy: string
  success: boolean
  error: string | null
}

export interface LocationDiagnostics {
  native: boolean
  bridge: string
  permissions: LocationPermissionDiagnostics
  providers: LocationProviderDiagnostics
  device: LocationDeviceDiagnostics
  lastAttempt: LocationAttemptDiagnostics
}

export interface LocationSelfTestAttempt {
  label: string
  strategy: 'fast-coarse-cache' | 'high-accuracy-gps' | 'web-unsupported'
  success: boolean
  elapsedMs: number
  providerName: string | null
  providerChannel: string | null
  accuracy: number | null
  error: string | null
}

export interface LocationSelfTestReport {
  ranAt: string
  native: boolean
  fast: LocationSelfTestAttempt
  accurate: LocationSelfTestAttempt
  conclusion: string
}

interface NativePositionResult {
  coords: {
    latitude: number
    longitude: number
    accuracy?: number | null
  }
  providerChannel?: string | null
  providerName?: string | null
}

interface SystemLocationBridgePlugin {
  getCurrentPosition(options: {
    enableHighAccuracy: boolean
    timeout: number
    maximumAge: number
  }): Promise<NativePositionResult>
  getDiagnostics(): Promise<LocationDiagnostics>
}

const LOCATION_TIMEOUT_MS = 10_000
const SYSTEM_BRIDGE_FAST_TIMEOUT_MS = 5_000
const SYSTEM_BRIDGE_FAST_MAXIMUM_AGE_MS = 10 * 60 * 1000
const SYSTEM_BRIDGE_ACCURATE_TIMEOUT_MS = 15_000
const SYSTEM_BRIDGE_ACCURATE_MAXIMUM_AGE_MS = 30_000
const SystemLocationBridge = registerPlugin<SystemLocationBridgePlugin>('SystemLocationBridge')

function toLocationResult(position: NativePositionResult): LocationResult | null {
  const lat = position.coords.latitude
  const lng = position.coords.longitude
  if (!Number.isFinite(lat) || lat < -90 || lat > 90 || !Number.isFinite(lng) || lng < -180 || lng > 180) {
    return null
  }
  const accuracy = position.coords.accuracy
  return {
    lat,
    lng,
    accuracy: typeof accuracy === 'number' && Number.isFinite(accuracy) && accuracy >= 0 ? accuracy : null,
  }
}

async function getCapacitorGeolocationPosition(): Promise<LocationResult | null> {
  try {
    const pos = await Geolocation.getCurrentPosition({
      enableHighAccuracy: true,
      timeout: LOCATION_TIMEOUT_MS,
    })
    return toLocationResult(pos)
  } catch (error) {
    console.error('[nativeLocation] Failed:', error)
    return null
  }
}

async function getSystemBridgeLocation(options: { enableHighAccuracy: boolean; timeout: number; maximumAge: number }): Promise<LocationResult | null> {
  const pos = await SystemLocationBridge.getCurrentPosition(options)
  return toLocationResult(pos)
}

function elapsedSince(startedAt: number): number {
  return Math.max(Date.now() - startedAt, 0)
}

async function runSystemSelfTestAttempt(
  label: string,
  strategy: LocationSelfTestAttempt['strategy'],
  options: { enableHighAccuracy: boolean; timeout: number; maximumAge: number },
): Promise<LocationSelfTestAttempt> {
  const startedAt = Date.now()
  try {
    const position = await SystemLocationBridge.getCurrentPosition(options)
    const location = toLocationResult(position)
    if (!location) {
      return { label, strategy, success: false, elapsedMs: elapsedSince(startedAt), providerName: position.providerName ?? null, providerChannel: position.providerChannel ?? null, accuracy: null, error: 'invalid coordinates' }
    }
    return { label, strategy, success: true, elapsedMs: elapsedSince(startedAt), providerName: position.providerName ?? null, providerChannel: position.providerChannel ?? null, accuracy: location.accuracy, error: null }
  } catch (error) {
    return { label, strategy, success: false, elapsedMs: elapsedSince(startedAt), providerName: null, providerChannel: null, accuracy: null, error: error instanceof Error ? error.message : String(error) }
  }
}

function unsupportedSelfTestAttempt(label: string): LocationSelfTestAttempt {
  return { label, strategy: 'web-unsupported', success: false, elapsedMs: 0, providerName: null, providerChannel: null, accuracy: null, error: 'Web 环境不支持原生定位自检' }
}

function buildSelfTestConclusion(fast: LocationSelfTestAttempt, accurate: LocationSelfTestAttempt): string {
  if (fast.success && accurate.success) return '快速定位和高精度定位均可用。'
  if (fast.success && !accurate.success) return `快速定位可用；高精度定位失败：${accurate.error ?? 'unknown'}。`
  if (!fast.success && accurate.success) return `快速定位失败：${fast.error ?? 'unknown'}；高精度定位可用。`
  return `快速定位失败：${fast.error ?? 'unknown'}；高精度定位失败：${accurate.error ?? 'unknown'}。`
}

export async function runLocationSelfTest(now = new Date()): Promise<LocationSelfTestReport> {
  if (!Capacitor.isNativePlatform()) {
    const fast = unsupportedSelfTestAttempt('快速定位')
    const accurate = unsupportedSelfTestAttempt('高精度定位')
    return { ranAt: now.toISOString(), native: false, fast, accurate, conclusion: 'Web 环境不支持原生定位自检。' }
  }

  const fast = await runSystemSelfTestAttempt('快速定位', 'fast-coarse-cache', {
    enableHighAccuracy: false,
    timeout: SYSTEM_BRIDGE_FAST_TIMEOUT_MS,
    maximumAge: SYSTEM_BRIDGE_FAST_MAXIMUM_AGE_MS,
  })
  const accurate = await runSystemSelfTestAttempt('高精度定位', 'high-accuracy-gps', {
    enableHighAccuracy: true,
    timeout: SYSTEM_BRIDGE_ACCURATE_TIMEOUT_MS,
    maximumAge: SYSTEM_BRIDGE_ACCURATE_MAXIMUM_AGE_MS,
  })
  return { ranAt: now.toISOString(), native: true, fast, accurate, conclusion: buildSelfTestConclusion(fast, accurate) }
}

async function getNativeSystemLocation(): Promise<LocationResult | null> {
  try {
    const location = await getSystemBridgeLocation({
      enableHighAccuracy: false,
      timeout: SYSTEM_BRIDGE_FAST_TIMEOUT_MS,
      maximumAge: SYSTEM_BRIDGE_FAST_MAXIMUM_AGE_MS,
    })
    if (location) return location
    console.warn('[nativeLocation] Fast system bridge returned invalid coordinates, retrying high accuracy provider')
  } catch (error) {
    console.warn('[nativeLocation] Fast system bridge failed, retrying high accuracy provider:', error)
  }

  try {
    const location = await getSystemBridgeLocation({
      enableHighAccuracy: true,
      timeout: SYSTEM_BRIDGE_ACCURATE_TIMEOUT_MS,
      maximumAge: SYSTEM_BRIDGE_ACCURATE_MAXIMUM_AGE_MS,
    })
    if (location) return location
    console.warn('[nativeLocation] High accuracy system bridge returned invalid coordinates')
  } catch (error) {
    console.warn('[nativeLocation] High accuracy system bridge failed:', error)
  }
  return null
}

function emptyLocationDiagnostics(native: boolean, bridge: string, error: string | null): LocationDiagnostics {
  return {
    native,
    bridge,
    permissions: { fine: 'unknown', coarse: 'unknown' },
    providers: { gps: null, network: null },
    device: { sdkInt: null, brand: null, manufacturer: null, model: null },
    lastAttempt: { strategy: 'unknown', success: false, error },
  }
}

export async function getLocationDiagnostics(): Promise<LocationDiagnostics> {
  if (!Capacitor.isNativePlatform()) {
    return emptyLocationDiagnostics(false, 'capacitor-geolocation-web', null)
  }
  try {
    return await SystemLocationBridge.getDiagnostics()
  } catch (error) {
    return emptyLocationDiagnostics(true, 'system-location-manager', error instanceof Error ? error.message : String(error))
  }
}

export async function getCurrentPosition(): Promise<LocationResult | null> {
  if (!Capacitor.isNativePlatform()) {
    return getCapacitorGeolocationPosition()
  }
  return getNativeSystemLocation()
}

/**
 * 多次采样取最优精度
 */
export async function refreshCurrentLocation(samples = 3): Promise<LocationResult | null> {
  let best: LocationResult | null = null
  for (let i = 0; i < samples; i++) {
    const result = await getCurrentPosition()
    if (!result) continue
    if (!best || (result.accuracy !== null && (best.accuracy === null || result.accuracy < best.accuracy))) {
      best = result
    }
  }
  return best
}