import type { TrackingPoint } from '../types'

const MAX_QUEUE_SIZE = 500
const MAX_BATCH_SIZE = 50

export function canEnqueue(queue: TrackingPoint[]): boolean {
  return queue.length < MAX_QUEUE_SIZE
}

export function enqueue(queue: TrackingPoint[], point: TrackingPoint): TrackingPoint[] {
  if (!canEnqueue(queue)) {
    return queue
  }
  return [...queue, point]
}

export function dequeueBatch(queue: TrackingPoint[]): {
  batch: TrackingPoint[]
  remaining: TrackingPoint[]
} {
  if (queue.length === 0) {
    return { batch: [], remaining: [] }
  }
  const batchSize = Math.min(MAX_BATCH_SIZE, queue.length)
  return {
    batch: queue.slice(0, batchSize),
    remaining: queue.slice(batchSize),
  }
}

export function shouldRetry(
  lastAttemptAt: number | null,
  retryIntervalMs: number,
): boolean {
  if (lastAttemptAt === null) return true
  return Date.now() - lastAttemptAt >= retryIntervalMs
}

export function getRetryIntervalMs(failures: number): number {
  const base = 10_000
  const maxInterval = 300_000
  const interval = base * Math.pow(2, Math.min(failures, 5))
  return Math.min(interval, maxInterval)
}