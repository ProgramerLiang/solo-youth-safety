import { create } from 'zustand'
import { loadTrackingState, saveTrackingState } from '../data/trackingRepo'
import { getCurrentPosition } from '../data/locationProvider'
import { enqueue } from '../domain/trackingQueue'
import type { TrackingPoint, TrackingSnapshot } from '../types'

interface TrackingState {
  enabled: boolean
  intervalSeconds: number
  pendingCount: number
  lastCapturedAt: number | null
  lastAcknowledgedAt: number | null
  busy: boolean
  queue: TrackingPoint[]
  history: TrackingPoint[]
  loaded: boolean

  initialize: () => Promise<void>
  start: () => Promise<void>
  stop: () => Promise<void>
  setInterval: (seconds: number) => Promise<void>
  captureNow: () => Promise<void>
  acknowledgeQueue: () => Promise<void>
}

let trackingTimer: ReturnType<typeof globalThis.setInterval> | null = null
let captureGeneration = 0

function toTimestamp(value: string | null | undefined): number | null {
  if (!value) return null
  const timestamp = new Date(value).getTime()
  return Number.isFinite(timestamp) ? timestamp : null
}

function toIsoString(value: number | null): string | null {
  return value === null ? null : new Date(value).toISOString()
}

function buildSnapshot(state: TrackingState): TrackingSnapshot {
  return {
    enabled: state.enabled,
    intervalSeconds: state.intervalSeconds,
    pendingCount: state.queue.length,
    lastCapturedAt: toIsoString(state.lastCapturedAt),
    lastAcknowledgedAt: toIsoString(state.lastAcknowledgedAt),
    nextRetryAt: null,
    queue: state.queue,
    history: state.history,
  }
}

function stopTimer(): void {
  if (trackingTimer !== null) {
    globalThis.clearInterval(trackingTimer)
    trackingTimer = null
  }
}

function startTimer(get: () => TrackingState): void {
  stopTimer()
  const intervalMs = Math.max(get().intervalSeconds, 1) * 1000
  trackingTimer = globalThis.setInterval(() => {
    if (get().enabled) {
      void get().captureNow()
    }
  }, intervalMs)
}

async function persist(state: TrackingState): Promise<void> {
  await saveTrackingState(buildSnapshot(state))
}

const MAX_HISTORY_SIZE = 500

function appendHistory(history: TrackingPoint[], point: TrackingPoint): TrackingPoint[] {
  const next = [...history, point]
  return next.length > MAX_HISTORY_SIZE ? next.slice(next.length - MAX_HISTORY_SIZE) : next
}

export const useTrackingStore = create<TrackingState>((set, get) => ({
  enabled: false,
  intervalSeconds: 60,
  pendingCount: 0,
  lastCapturedAt: null,
  lastAcknowledgedAt: null,
  busy: false,
  queue: [],
  history: [],
  loaded: false,

  initialize: async () => {
    const saved = await loadTrackingState()
    if (saved) {
      const queue = saved.queue ?? []
      const history = saved.history ?? queue
      set({
        enabled: saved.enabled,
        intervalSeconds: saved.intervalSeconds ?? 60,
        pendingCount: queue.length,
        lastCapturedAt: toTimestamp(saved.lastCapturedAt),
        lastAcknowledgedAt: toTimestamp(saved.lastAcknowledgedAt ?? saved.lastSyncedAt),
        queue,
        history,
        loaded: true,
      })
      if (saved.enabled) {
        startTimer(get)
      } else {
        stopTimer()
      }
    } else {
      set({ loaded: true })
      stopTimer()
    }
  },

  start: async () => {
    set({ enabled: true })
    startTimer(get)
    await persist(get())
  },

  stop: async () => {
    stopTimer()
    captureGeneration += 1
    set({ enabled: false })
    await persist(get())
  },

  setInterval: async (seconds: number) => {
    set({ intervalSeconds: seconds })
    if (get().enabled) {
      startTimer(get)
    }
    await persist(get())
  },

  captureNow: async () => {
    if (get().busy) return
    set({ busy: true })
    try {
      const generation = captureGeneration
      const pos = await getCurrentPosition()
      if (generation !== captureGeneration) return
      if (pos) {
        const point: TrackingPoint = { lat: pos.lat, lng: pos.lng, accuracy: pos.accuracy ?? 0, timestamp: Date.now() }
        const currentQueue = get().queue
        const newQueue = enqueue(currentQueue, point)
        if (newQueue !== currentQueue) {
          set({ lastCapturedAt: point.timestamp, queue: newQueue, history: appendHistory(get().history, point), pendingCount: newQueue.length })
          await persist(get())
        }
      }
    } finally {
      set({ busy: false })
    }
  },

  acknowledgeQueue: async () => {
    if (get().busy) return
    set({ busy: true })
    try {
      if (get().queue.length === 0) return
      const now = Date.now()
      set({ lastAcknowledgedAt: now, queue: [], pendingCount: 0 })
      await persist(get())
    } finally {
      set({ busy: false })
    }
  },
}))