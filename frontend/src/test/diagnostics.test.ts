import { beforeEach, describe, expect, it, vi } from 'vitest'
import packageJson from '../../package.json'
import { saveConfig } from '../data/configRepo'
import { saveContacts } from '../data/contactsRepo'
import { saveTrackingState } from '../data/trackingRepo'
import { saveThemePrefs } from '../data/themeRepo'
import type { TrackingSnapshot } from '../types'
import { exportDiagnosticReport } from '../data/diagnostics'

const nativeDiagnostics = vi.hoisted(() => ({
  getLocationDiagnostics: vi.fn(),
}))

vi.mock('../native/nativeLocation', () => ({
  getLocationDiagnostics: nativeDiagnostics.getLocationDiagnostics,
}))

beforeEach(() => {
  localStorage.clear()
  nativeDiagnostics.getLocationDiagnostics.mockReset()
})

describe('exportDiagnosticReport', () => {
  it('exports versioned local diagnostics without private contact phones or exact coordinates', async () => {
    nativeDiagnostics.getLocationDiagnostics.mockResolvedValue({
      native: true,
      bridge: 'system-location-manager',
      permissions: { fine: 'granted', coarse: 'granted' },
      providers: { gps: true, network: false },
      device: { sdkInt: 34, brand: 'Xiaomi', manufacturer: 'Xiaomi', model: '23013RK75C' },
      lastAttempt: { strategy: 'coarse-cached', success: true, error: null },
    })
    await saveConfig({ callNumber: '110', smsNumber: '', smsTemplate: '救命', onboardingDone: true })
    await saveContacts([{ id: 'c1', name: '妈妈', phone: '13800138000' }])
    await saveThemePrefs({ mode: 'dark', paletteMode: 'preset', presetId: 'green', customSeed: null, dynamicInfo: { seed: 1, primary: '#0d631b', secondary: '#4f654b', tertiary: '#386668', neutral: '#5e6259', neutralVariant: '#5b6357', error: '#ba1a1a' } })
    const tracking: TrackingSnapshot = {
      enabled: true,
      intervalSeconds: 60,
      pendingCount: 2,
      lastCapturedAt: '2026-06-11T00:00:00.000Z',
      lastAcknowledgedAt: null,
      nextRetryAt: null,
      queue: [
        { lat: 31.2304, lng: 121.4737, accuracy: 12, timestamp: 123 },
        { lat: 31.2305, lng: 121.4738, accuracy: 14, timestamp: 456 },
      ],
      history: [
        { lat: 31.2304, lng: 121.4737, accuracy: 12, timestamp: 123 },
      ],
    }
    await saveTrackingState(tracking)

    const report = await exportDiagnosticReport(new Date('2026-06-11T01:02:03.000Z'))
    const text = JSON.stringify(report)

    expect(report.schemaVersion).toBe(1)
    expect(report.app.version).toBe(packageJson.version)
    expect(report.app.exportedAt).toBe('2026-06-11T01:02:03.000Z')
    expect(report.storage.driver).toBe('localStorage (Web)')
    expect(report.config).toEqual({ hasCallNumber: true, hasSmsNumber: false, hasSmsTemplate: true, onboardingDone: true })
    expect(report.localData.contacts.count).toBe(1)
    expect(report.localData.sosHistory.count).toBe(0)
    expect(report.localData.tracking).toMatchObject({ enabled: true, intervalSeconds: 60, pendingCount: 2, queueCount: 2, historyCount: 1 })
    expect(report.theme).toMatchObject({ mode: 'dark', paletteMode: 'preset', presetId: 'green', hasCustomSeed: false, dynamicColorSupported: true })
    expect(report.location.providers).toEqual({ gps: true, network: false })
    expect(report.privacy).toEqual({ manualExportOnly: true, includesExactCoordinates: false, includesContactPhones: false })
    expect(text).not.toContain('13800138000')
    expect(text).not.toContain('31.2304')
    expect(text).not.toContain('121.4737')
  })
})
