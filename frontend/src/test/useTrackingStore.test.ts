import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useTrackingStore } from '../stores/useTrackingStore'
import type { TrackingPoint } from '../types'

type MockPosition = { lat: number; lng: number; accuracy: number | null }

const nativeLocationMock = vi.hoisted(() => {
  let positions: MockPosition[] = []
  let index = 0
  return {
    getCurrentPosition: vi.fn(async () => {
      const next = positions[Math.min(index, positions.length - 1)]
      index += 1
      return next
    }),
    setPositions(next: MockPosition[]) {
      positions = next
      index = 0
    },
  }
})

vi.mock('../native/nativeLocation', () => ({
  getCurrentPosition: nativeLocationMock.getCurrentPosition,
}))

const TRACKING_STATE_KEY = 'safety_v2_tracking_state'
const STARTED_AT = new Date('2026-06-01T04:00:00.000Z')
const FIRST_CAPTURE_AT = new Date('2026-06-01T04:00:10.000Z')
const RESTORED_AT = new Date('2026-06-01T04:01:00.000Z')
const RESTORED_CAPTURE_AT = new Date('2026-06-01T04:01:10.000Z')


function storedTrackingState() {
  const raw = localStorage.getItem(TRACKING_STATE_KEY)
  expect(raw).not.toBeNull()
  return JSON.parse(raw as string) as { queue?: TrackingPoint[]; history?: TrackingPoint[]; pendingCount: number; enabled: boolean; lastCapturedAt: string | null; lastAcknowledgedAt?: string | null; lastSyncedAt?: string | null }
}

function resetTrackingStore() {
  useTrackingStore.setState({
    enabled: false,
    intervalSeconds: 60,
    pendingCount: 0,
    lastCapturedAt: null,
    lastAcknowledgedAt: null,
    busy: false,
    queue: [],
    history: [],
    loaded: false,
  })
}

beforeEach(() => {
  localStorage.clear()
  vi.useFakeTimers()
  vi.setSystemTime(STARTED_AT)
  nativeLocationMock.setPositions([])
  nativeLocationMock.getCurrentPosition.mockClear()
  resetTrackingStore()
})

afterEach(async () => {
  await useTrackingStore.getState().stop()
  resetTrackingStore()
  vi.useRealTimers()
  localStorage.clear()
})

describe('useTrackingStore lifecycle', () => {
  it('captures periodically while enabled and persists the queue', async () => {
    nativeLocationMock.setPositions([
      { lat: 31.23, lng: 121.47, accuracy: 8 },
    ])

    await useTrackingStore.getState().setInterval(10)
    await useTrackingStore.getState().start()
    await vi.advanceTimersByTimeAsync(10_000)

    const state = useTrackingStore.getState()
    expect(nativeLocationMock.getCurrentPosition).toHaveBeenCalledOnce()
    expect(state.enabled).toBe(true)
    expect(state.pendingCount).toBe(1)
    expect(state.queue).toEqual([{ lat: 31.23, lng: 121.47, accuracy: 8, timestamp: FIRST_CAPTURE_AT.getTime() }])

    const saved = storedTrackingState()
    expect(saved.enabled).toBe(true)
    expect(saved.pendingCount).toBe(1)
    expect(saved.lastCapturedAt).toBe(FIRST_CAPTURE_AT.toISOString())
    expect(saved.queue).toEqual(state.queue)
  })

  it('keeps captured points in local playback history after local acknowledgement', async () => {
    nativeLocationMock.setPositions([
      { lat: 31.23, lng: 121.47, accuracy: 8 },
    ])

    vi.setSystemTime(FIRST_CAPTURE_AT)
    await useTrackingStore.getState().captureNow()
    await useTrackingStore.getState().acknowledgeQueue()

    const expectedPoint = { lat: 31.23, lng: 121.47, accuracy: 8, timestamp: FIRST_CAPTURE_AT.getTime() }
    const state = useTrackingStore.getState()
    expect(state.queue).toEqual([])
    expect(state.pendingCount).toBe(0)
    expect(state.history).toEqual([expectedPoint])

    const saved = storedTrackingState()
    expect(saved.queue).toEqual([])
    expect(saved.history).toEqual([expectedPoint])
  })

  it('restores a persisted queue and resumes periodic capture when saved as enabled', async () => {
    const persistedPoint: TrackingPoint = { lat: 30, lng: 120, accuracy: 15, timestamp: STARTED_AT.getTime() - 60_000 }
    localStorage.setItem(TRACKING_STATE_KEY, JSON.stringify({
      enabled: true,
      intervalSeconds: 10,
      pendingCount: 1,
      lastCapturedAt: new Date(persistedPoint.timestamp).toISOString(),
      lastSyncedAt: null,
      nextRetryAt: null,
      queue: [persistedPoint],
    }))
    nativeLocationMock.setPositions([
      { lat: 31, lng: 121, accuracy: 9 },
    ])

    await useTrackingStore.getState().initialize()
    vi.setSystemTime(RESTORED_AT)
    await vi.advanceTimersByTimeAsync(10_000)

    const state = useTrackingStore.getState()
    expect(nativeLocationMock.getCurrentPosition).toHaveBeenCalledOnce()
    expect(state.enabled).toBe(true)
    expect(state.pendingCount).toBe(2)
    expect(state.queue).toEqual([
      persistedPoint,
      { lat: 31, lng: 121, accuracy: 9, timestamp: RESTORED_CAPTURE_AT.getTime() },
    ])
    expect(useTrackingStore.getState().lastAcknowledgedAt).toBeNull()
  })

  it('stops the periodic timer and persists disabled state without dropping queued points', async () => {
    nativeLocationMock.setPositions([
      { lat: 31.23, lng: 121.47, accuracy: 8 },
    ])

    await useTrackingStore.getState().setInterval(10)
    await useTrackingStore.getState().start()
    await vi.advanceTimersByTimeAsync(10_000)
    await useTrackingStore.getState().stop()
    await vi.advanceTimersByTimeAsync(30_000)

    expect(nativeLocationMock.getCurrentPosition).toHaveBeenCalledOnce()
    expect(useTrackingStore.getState().enabled).toBe(false)
    expect(useTrackingStore.getState().queue).toHaveLength(1)
    const saved = storedTrackingState()
    expect(saved.enabled).toBe(false)
    expect(saved.queue).toHaveLength(1)
  })

  it('does not mark a full queue capture as successful', async () => {
    const fullQueue = Array.from({ length: 500 }, (_, index) => ({
      lat: 31,
      lng: 121,
      accuracy: 10,
      timestamp: STARTED_AT.getTime() + index,
    }))
    nativeLocationMock.setPositions([
      { lat: 33, lng: 123, accuracy: 7 },
    ])
    useTrackingStore.setState({
      queue: fullQueue,
      pendingCount: fullQueue.length,
      lastCapturedAt: STARTED_AT.getTime(),
    })

    vi.setSystemTime(FIRST_CAPTURE_AT)
    await useTrackingStore.getState().captureNow()

    const state = useTrackingStore.getState()
    expect(nativeLocationMock.getCurrentPosition).toHaveBeenCalledOnce()
    expect(state.queue).toBe(fullQueue)
    expect(state.pendingCount).toBe(500)
    expect(state.lastCapturedAt).toBe(STARTED_AT.getTime())
  })

  it('acknowledges all queued points in one local action', async () => {
    const queued = Array.from({ length: 60 }, (_, index) => ({
      lat: 31 + index / 1000,
      lng: 121 + index / 1000,
      accuracy: 10,
      timestamp: FIRST_CAPTURE_AT.getTime() + index,
    }))
    nativeLocationMock.setPositions([])
    useTrackingStore.setState({ queue: queued, pendingCount: queued.length, intervalSeconds: 10 })

    vi.setSystemTime(FIRST_CAPTURE_AT)
    await useTrackingStore.getState().acknowledgeQueue()

    const state = useTrackingStore.getState()
    expect(state.queue).toEqual([])
    expect(state.pendingCount).toBe(0)
    expect(state.lastAcknowledgedAt).toBe(FIRST_CAPTURE_AT.getTime())
    const saved = storedTrackingState()
    expect(saved.pendingCount).toBe(0)
    expect(saved.queue).toEqual([])
    expect(saved.lastAcknowledgedAt).toBe(FIRST_CAPTURE_AT.toISOString())
    expect(saved.lastSyncedAt).toBeUndefined()
  })

  it('persists local acknowledgement with an empty queue', async () => {
    const queued: TrackingPoint[] = [
      { lat: 31, lng: 121, accuracy: 10, timestamp: FIRST_CAPTURE_AT.getTime() },
      { lat: 32, lng: 122, accuracy: 12, timestamp: FIRST_CAPTURE_AT.getTime() + 1000 },
    ]
    nativeLocationMock.setPositions([])
    useTrackingStore.setState({ queue: queued, pendingCount: queued.length, intervalSeconds: 10 })

    vi.setSystemTime(FIRST_CAPTURE_AT)
    await useTrackingStore.getState().acknowledgeQueue()

    const state = useTrackingStore.getState()
    expect(state.queue).toEqual([])
    expect(state.pendingCount).toBe(0)
    expect(state.lastAcknowledgedAt).toBe(FIRST_CAPTURE_AT.getTime())
    const saved = storedTrackingState()
    expect(saved.pendingCount).toBe(0)
    expect(saved.queue).toEqual([])
    expect(saved.lastAcknowledgedAt).toBe(FIRST_CAPTURE_AT.toISOString())
    expect(saved.lastSyncedAt).toBeUndefined()
  })
})
