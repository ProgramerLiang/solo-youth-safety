import { describe, it, expect } from 'vitest'
import { enqueue, dequeueBatch, canEnqueue, shouldRetry, getRetryIntervalMs } from '../domain/trackingQueue'
import type { TrackingPoint } from '../types'

const mkPoint = (timestamp: number): TrackingPoint => ({
  lat: 31.23, lng: 121.47, accuracy: 10, timestamp,
})

describe('trackingQueue', () => {
  it('enqueue adds item', () => {
    const q = enqueue([], mkPoint(1000))
    expect(q).toHaveLength(1)
  })

  it('dequeueBatch removes up to 50 items', () => {
    let q: TrackingPoint[] = []
    for (let i = 0; i < 60; i++) {
      q = enqueue(q, mkPoint(i))
    }
    const { batch, remaining } = dequeueBatch(q)
    expect(batch).toHaveLength(50)
    expect(remaining).toHaveLength(10)
  })

  it('dequeueBatch with empty queue', () => {
    const { batch, remaining } = dequeueBatch([])
    expect(batch).toHaveLength(0)
    expect(remaining).toHaveLength(0)
  })

  it('canEnqueue returns false when queue is full', () => {
    let q: TrackingPoint[] = []
    for (let i = 0; i < 500; i++) {
      q = enqueue(q, mkPoint(i))
    }
    expect(canEnqueue(q)).toBe(false)
  })

  it('enqueue respects max size', () => {
    let q: TrackingPoint[] = []
    for (let i = 0; i < 500; i++) {
      q = enqueue(q, mkPoint(i))
    }
    q = enqueue(q, mkPoint(501))
    expect(q).toHaveLength(500)
  })

  it('shouldRetry returns true when lastAttemptAt is null', () => {
    expect(shouldRetry(null, 10000)).toBe(true)
  })

  it('shouldRetry returns false when retry interval not elapsed', () => {
    const recent = Date.now() - 1000
    expect(shouldRetry(recent, 10000)).toBe(false)
  })

  it('getRetryIntervalMs doubles with failures', () => {
    expect(getRetryIntervalMs(0)).toBe(10000)
    expect(getRetryIntervalMs(1)).toBe(20000)
    expect(getRetryIntervalMs(2)).toBe(40000)
  })

  it('getRetryIntervalMs caps at 5 minutes', () => {
    expect(getRetryIntervalMs(10)).toBe(300000)
  })
})