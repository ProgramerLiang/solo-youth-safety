import { afterEach, describe, expect, it, vi } from 'vitest'
import { triggerNativeCall, triggerNativeSms } from '../native/nativeActions'
import { getCurrentPosition, getLocationDiagnostics, runLocationSelfTest } from '../native/nativeLocation'
import {
  getStartupPermissionStatus,
  requestBackgroundRunPermission,
  requestStartupLocationPermission,
  requestStorageAccessPermission,
} from '../native/permissions'

const capacitorMock = vi.hoisted(() => {
  const triggerEmergency = vi.fn()
  const systemGetCurrentPosition = vi.fn()
  const systemGetDiagnostics = vi.fn()
  const getStartupPermissionStatus = vi.fn()
  const requestStartupLocation = vi.fn()
  const requestBackgroundRun = vi.fn()
  const requestStorage = vi.fn()
  return {
    native: false,
    triggerEmergency,
    systemGetCurrentPosition,
    systemGetDiagnostics,
    getStartupPermissionStatus,
    requestStartupLocation,
    requestBackgroundRun,
    requestStorage,
    registerPlugin: vi.fn((name: string) => {
      if (name === 'EmergencyActions') {
        return { triggerEmergency: (...args: unknown[]) => triggerEmergency(...args) }
      }
      if (name === 'SystemLocationBridge') {
        return { getCurrentPosition: (...args: unknown[]) => systemGetCurrentPosition(...args), getDiagnostics: (...args: unknown[]) => systemGetDiagnostics(...args) }
      }
      if (name === 'StartupPermissions') {
        return {
          getStatus: (...args: unknown[]) => getStartupPermissionStatus(...args),
          requestLocation: (...args: unknown[]) => requestStartupLocation(...args),
          requestBackgroundRun: (...args: unknown[]) => requestBackgroundRun(...args),
          requestStorage: (...args: unknown[]) => requestStorage(...args),
        }
      }
      return {}
    }),
  }
})

const geolocationMock = vi.hoisted(() => ({
  getCurrentPosition: vi.fn(),
}))

vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => capacitorMock.native },
  registerPlugin: capacitorMock.registerPlugin,
}))

vi.mock('@capacitor/geolocation', () => ({
  Geolocation: geolocationMock,
}))

afterEach(() => {
  capacitorMock.native = false
  capacitorMock.triggerEmergency.mockReset()
  capacitorMock.systemGetCurrentPosition.mockReset()
  capacitorMock.systemGetDiagnostics.mockReset()
  geolocationMock.getCurrentPosition.mockReset()
  capacitorMock.getStartupPermissionStatus.mockReset()
  capacitorMock.requestStartupLocation.mockReset()
  capacitorMock.requestBackgroundRun.mockReset()
  capacitorMock.requestStorage.mockReset()
  vi.restoreAllMocks()
})

describe('native emergency bridge', () => {
  it('sends SMS through EmergencyActions and reports the SMS channel result', async () => {
    capacitorMock.native = true
    capacitorMock.triggerEmergency.mockResolvedValue({
      logs: [
        { channel: 'sms', status: 'dispatched', detail: 'SmsManager invoked: 13800138000, parts=1' },
        { channel: 'call', status: 'skipped', detail: 'callNumber is empty' },
      ],
      permissions: { sms: 'granted', call: 'prompt' },
    })

    const result = await triggerNativeSms('13800138000', 'SOS message')

    expect(capacitorMock.registerPlugin).toHaveBeenCalledWith('EmergencyActions')
    expect(capacitorMock.triggerEmergency).toHaveBeenCalledWith({
      smsNumber: '13800138000',
      smsBody: 'SOS message',
      callNumber: '',
    })
    expect(result).toEqual({ success: true, detail: 'SmsManager invoked: 13800138000, parts=1' })
  })

  it('starts calls through EmergencyActions and exposes native failure details', async () => {
    capacitorMock.native = true
    capacitorMock.triggerEmergency.mockResolvedValue({
      logs: [
        { channel: 'sms', status: 'skipped', detail: 'smsNumber is empty' },
        { channel: 'call', status: 'failed', detail: 'CALL_PHONE permission denied' },
      ],
      permissions: { sms: 'prompt', call: 'denied' },
    })

    const result = await triggerNativeCall('13800138000')

    expect(capacitorMock.triggerEmergency).toHaveBeenCalledWith({
      smsNumber: '',
      smsBody: '',
      callNumber: '13800138000',
    })
    expect(result).toEqual({ success: false, detail: 'CALL_PHONE permission denied' })
  })

  it('does not call native plugins from web builds', async () => {
    capacitorMock.native = false
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined)

    const result = await triggerNativeSms('13800138000', 'SOS message')

    expect(capacitorMock.triggerEmergency).not.toHaveBeenCalled()
    expect(logSpy).toHaveBeenCalledWith('[nativeActions] Web: SMS not available', { phoneNumber: '13800138000', message: 'SOS message' })
    expect(result.success).toBe(false)
    expect(result.detail).toContain('非原生环境')
  })
})

describe('native location bridge', () => {
  it('uses fast coarse system location first on native Android', async () => {
    capacitorMock.native = true
    capacitorMock.systemGetCurrentPosition.mockResolvedValue({
      coords: { latitude: 31.2304, longitude: 121.4737, accuracy: 80 },
      timestamp: 1710000000000,
      providerChannel: 'system',
      providerName: 'network',
    })

    const result = await getCurrentPosition()

    expect(capacitorMock.systemGetCurrentPosition).toHaveBeenCalledOnce()
    expect(capacitorMock.systemGetCurrentPosition).toHaveBeenCalledWith({
      enableHighAccuracy: false,
      timeout: 5000,
      maximumAge: 600000,
    })
    expect(geolocationMock.getCurrentPosition).not.toHaveBeenCalled()
    expect(result).toEqual({ lat: 31.2304, lng: 121.4737, accuracy: 80 })
  })

  it('falls back to high accuracy system location when fast coarse coordinates are invalid', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    capacitorMock.native = true
    capacitorMock.systemGetCurrentPosition
      .mockResolvedValueOnce({ coords: { latitude: Number.NaN, longitude: 121.4737, accuracy: 8 } })
      .mockResolvedValueOnce({ coords: { latitude: 22.5431, longitude: 114.0579, accuracy: Number.NaN } })

    const result = await getCurrentPosition()

    expect(warnSpy).toHaveBeenCalledOnce()
    expect(capacitorMock.systemGetCurrentPosition).toHaveBeenCalledTimes(2)
    expect(capacitorMock.systemGetCurrentPosition).toHaveBeenNthCalledWith(2, {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 30000,
    })
    expect(geolocationMock.getCurrentPosition).not.toHaveBeenCalled()
    expect(result).toEqual({ lat: 22.5431, lng: 114.0579, accuracy: null })
  })


  it('uses Capacitor Geolocation instead of demo coordinates on web', async () => {
    capacitorMock.native = false
    geolocationMock.getCurrentPosition.mockResolvedValue({
      coords: { latitude: 22.5431, longitude: 114.0579, accuracy: 12 },
    })

    const result = await getCurrentPosition()

    expect(capacitorMock.systemGetCurrentPosition).not.toHaveBeenCalled()
    expect(geolocationMock.getCurrentPosition).toHaveBeenCalledWith({
      enableHighAccuracy: true,
      timeout: 10000,
    })
    expect(result).toEqual({ lat: 22.5431, lng: 114.0579, accuracy: 12 })
  })
  it('does not call Google-backed Capacitor Geolocation after fast SystemLocationBridge rejects on native Android', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    capacitorMock.native = true
    capacitorMock.systemGetCurrentPosition
      .mockRejectedValueOnce(new Error('network timeout'))
      .mockResolvedValueOnce({
        coords: { latitude: 30, longitude: 120, accuracy: 20 },
      })

    const result = await getCurrentPosition()

    expect(warnSpy).toHaveBeenCalledOnce()
    expect(capacitorMock.systemGetCurrentPosition).toHaveBeenCalledTimes(2)
    expect(capacitorMock.systemGetCurrentPosition).toHaveBeenNthCalledWith(2, {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 30000,
    })
    expect(geolocationMock.getCurrentPosition).not.toHaveBeenCalled()
    expect(result).toEqual({ lat: 30, lng: 120, accuracy: 20 })
  })


  it('runs fast and accurate native self-test attempts without exposing exact coordinates', async () => {
    capacitorMock.native = true
    capacitorMock.systemGetCurrentPosition
      .mockResolvedValueOnce({
        coords: { latitude: 31.2304, longitude: 121.4737, accuracy: 80 },
        timestamp: 1710000000000,
        providerChannel: 'system',
        providerName: 'network',
      })
      .mockRejectedValueOnce(new Error('gps timeout'))

    const report = await runLocationSelfTest(new Date('2026-06-11T01:02:03.000Z'))
    const text = JSON.stringify(report)

    expect(capacitorMock.systemGetCurrentPosition).toHaveBeenNthCalledWith(1, {
      enableHighAccuracy: false,
      timeout: 5000,
      maximumAge: 600000,
    })
    expect(capacitorMock.systemGetCurrentPosition).toHaveBeenNthCalledWith(2, {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 30000,
    })
    expect(report.ranAt).toBe('2026-06-11T01:02:03.000Z')
    expect(report.fast).toMatchObject({ label: '快速定位', strategy: 'fast-coarse-cache', success: true, providerName: 'network', accuracy: 80 })
    expect(report.accurate).toMatchObject({ label: '高精度定位', strategy: 'high-accuracy-gps', success: false, error: 'gps timeout' })
    expect(text).not.toContain('31.2304')
    expect(text).not.toContain('121.4737')
  })
  it('reads native system location diagnostics from SystemLocationBridge', async () => {
    capacitorMock.native = true
    capacitorMock.systemGetDiagnostics.mockResolvedValue({
      native: true,
      bridge: 'system-location-manager',
      permissions: { fine: 'granted', coarse: 'granted' },
      providers: { gps: true, network: false },
      device: { sdkInt: 34, brand: 'HONOR', manufacturer: 'HONOR', model: 'ANY-AN00' },
      lastAttempt: { strategy: 'coarse-cached', success: true, error: null },
    })

    const diagnostics = await getLocationDiagnostics()

    expect(capacitorMock.systemGetDiagnostics).toHaveBeenCalledOnce()
    expect(diagnostics.providers).toEqual({ gps: true, network: false })
    expect(diagnostics.device.brand).toBe('HONOR')
  })
})

describe('startup permissions bridge', () => {
  it('reads startup permission status from native plugin', async () => {
    capacitorMock.native = true
    capacitorMock.getStartupPermissionStatus.mockResolvedValue({
      native: true,
      location: { state: 'denied', detail: '定位权限未授权' },
      backgroundRun: { state: 'manual', detail: '需要在系统设置中允许后台运行' },
      storage: { state: 'notRequired', detail: '当前 Android 版本导出无需广泛存储权限' },
    })

    const status = await getStartupPermissionStatus()

    expect(capacitorMock.getStartupPermissionStatus).toHaveBeenCalledOnce()
    expect(status.storage.state).toBe('notRequired')
  })

  it('requests startup permissions through native plugin', async () => {
    capacitorMock.native = true
    capacitorMock.requestStartupLocation.mockResolvedValue({ state: 'granted', detail: '定位权限已授权' })
    capacitorMock.requestBackgroundRun.mockResolvedValue({ state: 'manual', detail: '已打开系统设置，请手动允许后台运行' })
    capacitorMock.requestStorage.mockResolvedValue({ state: 'notRequired', detail: '当前 Android 版本导出无需广泛存储权限' })

    await expect(requestStartupLocationPermission()).resolves.toEqual({ state: 'granted', detail: '定位权限已授权' })
    await expect(requestBackgroundRunPermission()).resolves.toEqual({ state: 'manual', detail: '已打开系统设置，请手动允许后台运行' })
    await expect(requestStorageAccessPermission()).resolves.toEqual({ state: 'notRequired', detail: '当前 Android 版本导出无需广泛存储权限' })
    expect(capacitorMock.requestStartupLocation).toHaveBeenCalledOnce()
    expect(capacitorMock.requestBackgroundRun).toHaveBeenCalledOnce()
    expect(capacitorMock.requestStorage).toHaveBeenCalledOnce()
  })
})
