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

interface NativePositionResult {
  coords: {
    latitude: number
    longitude: number
    accuracy?: number | null
  }
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
const SYSTEM_BRIDGE_MAXIMUM_AGE_MS = 5_000
const SYSTEM_BRIDGE_FALLBACK_TIMEOUT_MS = 15_000
const SYSTEM_BRIDGE_FALLBACK_MAXIMUM_AGE_MS = 10 * 60 * 1000
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

async function getNativeSystemLocation(): Promise<LocationResult | null> {
  try {
    const location = await getSystemBridgeLocation({
      enableHighAccuracy: true,
      timeout: LOCATION_TIMEOUT_MS,
      maximumAge: SYSTEM_BRIDGE_MAXIMUM_AGE_MS,
    })
    if (location) return location
    console.warn('[nativeLocation] System bridge returned invalid coordinates, retrying coarse cached provider')
  } catch (error) {
    console.warn('[nativeLocation] System bridge failed, retrying coarse cached provider:', error)
  }

  try {
    const location = await getSystemBridgeLocation({
      enableHighAccuracy: false,
      timeout: SYSTEM_BRIDGE_FALLBACK_TIMEOUT_MS,
      maximumAge: SYSTEM_BRIDGE_FALLBACK_MAXIMUM_AGE_MS,
    })
    if (location) return location
    console.warn('[nativeLocation] Coarse cached system bridge returned invalid coordinates')
  } catch (error) {
    console.warn('[nativeLocation] Coarse cached system bridge failed:', error)
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