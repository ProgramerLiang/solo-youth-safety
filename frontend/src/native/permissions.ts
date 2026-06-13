import { Capacitor, registerPlugin } from '@capacitor/core'
import { Geolocation } from '@capacitor/geolocation'

export type PermissionState = 'granted' | 'denied' | 'unsupported' | 'unknown'
export type StartupPermissionState = PermissionState | 'manual' | 'notRequired'

export interface StartupPermissionEntry {
  state: StartupPermissionState
  detail: string
}

export interface StartupPermissionStatus {
  native: boolean
  location: StartupPermissionEntry
  backgroundRun: StartupPermissionEntry
  storage: StartupPermissionEntry
}

interface StartupPermissionsPlugin {
  getStatus(): Promise<StartupPermissionStatus>
  requestLocation(): Promise<StartupPermissionEntry>
  requestBackgroundRun(): Promise<StartupPermissionEntry>
  requestStorage(): Promise<StartupPermissionEntry>
}

const StartupPermissions = registerPlugin<StartupPermissionsPlugin>('StartupPermissions')

const WEB_STATUS: StartupPermissionStatus = {
  native: false,
  location: { state: 'granted', detail: 'Web 环境不需要原生定位权限引导' },
  backgroundRun: { state: 'unsupported', detail: 'Web 环境不支持后台运行系统设置' },
  storage: { state: 'notRequired', detail: 'Web 导出使用浏览器下载记录' },
}

function unknownEntry(detail: string): StartupPermissionEntry {
  return { state: 'unknown', detail }
}

export async function getStartupPermissionStatus(): Promise<StartupPermissionStatus> {
  if (!Capacitor.isNativePlatform()) return WEB_STATUS
  try {
    return await StartupPermissions.getStatus()
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    return {
      native: true,
      location: unknownEntry(detail),
      backgroundRun: unknownEntry(detail),
      storage: unknownEntry(detail),
    }
  }
}

export async function requestStartupLocationPermission(): Promise<StartupPermissionEntry> {
  if (!Capacitor.isNativePlatform()) return WEB_STATUS.location
  try {
    return await StartupPermissions.requestLocation()
  } catch (error) {
    return unknownEntry(error instanceof Error ? error.message : String(error))
  }
}

export async function requestBackgroundRunPermission(): Promise<StartupPermissionEntry> {
  if (!Capacitor.isNativePlatform()) return WEB_STATUS.backgroundRun
  try {
    return await StartupPermissions.requestBackgroundRun()
  } catch (error) {
    return unknownEntry(error instanceof Error ? error.message : String(error))
  }
}

export async function requestStorageAccessPermission(): Promise<StartupPermissionEntry> {
  if (!Capacitor.isNativePlatform()) return WEB_STATUS.storage
  try {
    return await StartupPermissions.requestStorage()
  } catch (error) {
    return unknownEntry(error instanceof Error ? error.message : String(error))
  }
}

export async function checkLocationPermission(): Promise<PermissionState> {
  if (!Capacitor.isNativePlatform()) return 'granted'
  try {
    const perm = await Geolocation.checkPermissions()
    if (perm.location === 'granted') return 'granted'
    return 'denied'
  } catch {
    return 'unknown'
  }
}

export async function requestLocationPermission(): Promise<PermissionState> {
  const result = await requestStartupLocationPermission()
  if (result.state === 'granted') return 'granted'
  if (result.state === 'denied') return 'denied'
  if (result.state === 'unsupported') return 'unsupported'
  return 'unknown'
}
