import { describe, expect, it } from 'vitest'
import type { DiagnosticReport } from '../data/diagnostics'
import { parseDiagnosticReportJson, summarizeDiagnosticReport } from '../data/diagnosticSummary'

function baseReport(overrides: Partial<DiagnosticReport> = {}): DiagnosticReport {
  return {
    schemaVersion: 1,
    app: { version: '0.4.22', exportedAt: '2026-06-11T01:02:03.000Z' },
    storage: { driver: 'localStorage (Web)' },
    config: { hasCallNumber: true, hasSmsNumber: true, hasSmsTemplate: true, onboardingDone: true },
    localData: {
      contacts: { count: 1 },
      sosHistory: { count: 0 },
      tracking: {
        enabled: true,
        intervalSeconds: 60,
        pendingCount: 0,
        queueCount: 0,
        historyCount: 4,
        lastCapturedAt: '2026-06-11T01:00:00.000Z',
        lastAcknowledgedAt: '2026-06-11T01:01:00.000Z',
        nextRetryAt: null,
      },
    },
    theme: {
      mode: 'dark',
      paletteMode: 'preset',
      presetId: 'green',
      hasCustomSeed: false,
      dynamicColorSupported: true,
      dynamicColorSource: 'android-bridge',
    },
    location: {
      native: true,
      bridge: 'system-location-manager',
      permissions: { fine: 'granted', coarse: 'granted' },
      providers: { gps: true, network: true },
      device: { sdkInt: 34, brand: 'Xiaomi', manufacturer: 'Xiaomi', model: '23013RK75C' },
      lastAttempt: { strategy: 'coarse-cached', success: true, error: null },
      selfTest: null,
    },
    safetyTrip: {
      hasCurrentTrip: false,
      currentStatus: null,
      destinationLength: 0,
      hasNote: false,
      historyCount: 0,
      lastTripStatus: null,
    },
    privacy: { manualExportOnly: true, includesExactCoordinates: false, includesContactPhones: false },
    ...overrides,
  }
}

describe('summarizeDiagnosticReport', () => {
  it('returns ok facts for a healthy diagnostic report', () => {
    const summary = summarizeDiagnosticReport(baseReport())

    expect(summary.level).toBe('ok')
    expect(summary.facts.appVersion).toBe('0.4.22')
    expect(summary.facts.device).toBe('Xiaomi 23013RK75C · Android SDK 34')
    expect(summary.facts.locationProviders).toBe('GPS 开启 / Network 开启')
    expect(summary.facts.locationPermissions).toBe('精确 granted / 粗略 granted')
    expect(summary.facts.locationSelfTest).toBe('未运行')
    expect(summary.facts.theme).toBe('dark / preset / green')
    expect(summary.facts.safetyTrip).toBe('当前无行程 / 历史 0 条')
    expect(summary.issues).toEqual([])
  })

  it('raises warning when location permission and providers are unavailable', () => {
    const summary = summarizeDiagnosticReport(baseReport({
      location: {
        native: true,
        bridge: 'system-location-manager',
        permissions: { fine: 'denied', coarse: 'denied' },
        providers: { gps: false, network: false },
        device: { sdkInt: 30, brand: 'HONOR', manufacturer: 'HONOR', model: 'ANY-AN00' },
        lastAttempt: { strategy: 'permission', success: false, error: 'Location permission was denied' },
        selfTest: null,
      },
    }))

    expect(summary.level).toBe('warning')
    expect(summary.issues.map((issue) => issue.title)).toContain('定位权限不可用')
    expect(summary.issues.map((issue) => issue.title)).toContain('系统定位 Provider 关闭')
    expect(summary.issues.map((issue) => issue.title)).toContain('最近定位失败')
  })

  it('raises attention for partial provider and local backlog issues', () => {
    const summary = summarizeDiagnosticReport(baseReport({
      localData: {
        contacts: { count: 1 },
        sosHistory: { count: 0 },
        tracking: {
          enabled: true,
          intervalSeconds: 60,
          pendingCount: 12,
          queueCount: 12,
          historyCount: 20,
          lastCapturedAt: '2026-06-11T01:00:00.000Z',
          lastAcknowledgedAt: null,
          nextRetryAt: null,
        },
      },
      location: {
        native: true,
        bridge: 'system-location-manager',
        permissions: { fine: 'granted', coarse: 'granted' },
        providers: { gps: true, network: false },
        device: { sdkInt: 33, brand: 'OPPO', manufacturer: 'OPPO', model: 'PJG110' },
        lastAttempt: { strategy: 'system-gps', success: true, error: null },
        selfTest: null,
      },
    }))

    expect(summary.level).toBe('attention')
    expect(summary.issues.map((issue) => issue.title)).toContain('Network Provider 不可用')
    expect(summary.issues.map((issue) => issue.title)).toContain('本地轨迹待确认较多')
  })

  it('summarizes active safety trip without exposing destination', () => {
    const summary = summarizeDiagnosticReport(baseReport({
      safetyTrip: {
        hasCurrentTrip: true,
        currentStatus: 'active',
        destinationLength: 3,
        hasNote: true,
        historyCount: 2,
        lastTripStatus: 'arrived',
      },
    }))

    expect(summary.facts.safetyTrip).toBe('当前 active / 目的地 3 字 / 备注 有 / 历史 2 条')
    expect(JSON.stringify(summary)).not.toContain('回宿舍')
  })
})

describe('parseDiagnosticReportJson', () => {
  it('parses valid diagnostic JSON into a readable summary', () => {
    const result = parseDiagnosticReportJson(JSON.stringify(baseReport()))

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.summary.facts.device).toBe('Xiaomi 23013RK75C · Android SDK 34')
      expect(result.report.privacy.includesExactCoordinates).toBe(false)
    }
  })

  it('returns a safe error for invalid JSON or wrong schema', () => {
    expect(parseDiagnosticReportJson('{bad').ok).toBe(false)
    const wrong = parseDiagnosticReportJson(JSON.stringify({ schemaVersion: 2 }))
    expect(wrong.ok).toBe(false)
    if (!wrong.ok) expect(wrong.error).toBe('诊断报告格式不受支持')
  })
})
