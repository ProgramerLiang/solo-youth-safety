import { beforeEach, describe, expect, it } from 'vitest'
import { loadLocationSelfTestReport, saveLocationSelfTestReport } from '../data/locationSelfTestRepo'
import type { LocationSelfTestReport } from '../native/nativeLocation'

function report(): LocationSelfTestReport {
  return {
    ranAt: '2026-06-11T01:02:03.000Z',
    native: true,
    fast: {
      label: '快速定位',
      strategy: 'fast-coarse-cache',
      success: true,
      elapsedMs: 1200,
      providerName: 'network',
      providerChannel: 'system',
      accuracy: 80,
      error: null,
    },
    accurate: {
      label: '高精度定位',
      strategy: 'high-accuracy-gps',
      success: false,
      elapsedMs: 15000,
      providerName: null,
      providerChannel: null,
      accuracy: null,
      error: 'gps timeout',
    },
    conclusion: '快速定位可用；高精度定位失败：gps timeout。',
  }
}

beforeEach(() => {
  localStorage.clear()
})

describe('location self-test persistence', () => {
  it('persists and loads the latest location self-test report', async () => {
    await saveLocationSelfTestReport(report())

    const loaded = await loadLocationSelfTestReport()

    expect(loaded?.ranAt).toBe('2026-06-11T01:02:03.000Z')
    expect(loaded?.fast.success).toBe(true)
    expect(loaded?.accurate.error).toBe('gps timeout')
  })
})
