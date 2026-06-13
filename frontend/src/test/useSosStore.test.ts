import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useSosStore } from '../stores/useSosStore'
import { createInitialResult } from '../domain/sosState'
import { SOS_HISTORY_KEY } from '../data/sosRepo'

const nativeActionMock = vi.hoisted(() => ({
  triggerNativeCall: vi.fn(async () => ({ success: true, detail: '拨号已发起' })),
  triggerNativeSms: vi.fn(async () => ({ success: true, detail: '短信已发送' })),
}))

vi.mock('../native/nativeActions', () => ({
  triggerNativeCall: nativeActionMock.triggerNativeCall,
  triggerNativeSms: nativeActionMock.triggerNativeSms,
}))

const TRIGGERED_AT = new Date('2026-06-01T08:03:00.000Z')

function resetSosStore() {
  useSosStore.setState({
    arming: false,
    countdownActive: false,
    sosResult: createInitialResult(),
    history: [],
    initialized: false,
  })
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(TRIGGERED_AT)
  nativeActionMock.triggerNativeCall.mockClear()
  nativeActionMock.triggerNativeSms.mockClear()
  resetSosStore()
})

afterEach(() => {
  vi.useRealTimers()
  localStorage.clear()
  resetSosStore()
})

describe('useSosStore history', () => {
  it('retains trigger timestamp and coordinates for local playback history', async () => {
    await useSosStore.getState().triggerNow({
      lat: 31.2309,
      lng: 121.4742,
      accuracy: 10,
      userId: 'user-1',
      deviceId: 'device-1',
      callNumber: '110',
      smsNumber: '120',
      smsTemplate: '[SOS]{lat},{lng}',
      time: '2026-06-01 16:03:00',
    })

    const history = useSosStore.getState().history
    expect(history).toHaveLength(1)
    expect(history[0]?.triggeredAt).toBe(TRIGGERED_AT.getTime())
    expect(history[0]?.location).toEqual({ lat: 31.2309, lng: 121.4742, accuracy: 10 })
    expect(history[0]?.finalStatus).toBe('success')
  })

  it('loads persisted SOS history for local playback after app restart', async () => {
    const persisted = {
      stage: 'done' as const,
      steps: createInitialResult().steps,
      finalStatus: 'success' as const,
      finalLabel: '完成',
      summary: 'SOS 流程完成',
      triggeredAt: TRIGGERED_AT.getTime(),
      location: { lat: 31.2309, lng: 121.4742, accuracy: 10 },
    }
    localStorage.setItem(SOS_HISTORY_KEY, JSON.stringify([persisted]))

    await useSosStore.getState().initialize()

    expect(useSosStore.getState().history).toEqual([persisted])
    expect(useSosStore.getState().initialized).toBe(true)
  })
})
