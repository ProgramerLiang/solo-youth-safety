import { describe, it, expect } from 'vitest'
import {
  computeMovementSummary,
  isStationary,
  getEffectiveSpeedKmh,
} from '../domain/movementAnalysis'
import type { TrackingPoint } from '../types'

const SEC = 1000
const MIN = 60 * SEC

describe('movementAnalysis', () => {
  const mockPoints = (timestamps: number[], lats: number[], lngs: number[]): TrackingPoint[] =>
    timestamps.map((t, i) => ({ lat: lats[i]!, lng: lngs[i]!, accuracy: 10, timestamp: t }))

  it('empty history returns zero summary', () => {
    const r = computeMovementSummary([])
    expect(r.totalPoints).toBe(0)
    expect(r.totalDistanceM).toBe(0)
    expect(r.totalDurationMs).toBe(0)
    expect(r.maxSpeedKmh).toBe(0)
    expect(r.avgSpeedKmh).toBe(0)
    expect(r.stationaryPeriods).toEqual([])
    expect(r.suspiciousPauses).toEqual([])
  })

  it('single point returns zero metrics', () => {
    const points = mockPoints([Date.now()], [31.0], [121.0])
    const r = computeMovementSummary(points)
    expect(r.totalPoints).toBe(1)
    expect(r.totalDistanceM).toBe(0)
    expect(r.maxSpeedKmh).toBe(0)
  })

  it('computes distance between two points', () => {
    // ~111km per degree latitude; ~93km per degree longitude at lat 31
    const points = mockPoints(
      [0, 60 * SEC],
      [31.0, 31.001],   // ~111m apart
      [121.0, 121.0],
    )
    const r = computeMovementSummary(points)
    expect(r.totalDistanceM).toBeGreaterThan(100)
    expect(r.totalDistanceM).toBeLessThan(130)
    expect(r.maxSpeedKmh).toBeGreaterThan(5)
    expect(r.maxSpeedKmh).toBeLessThan(8)
  })

  it('accumulates distance across multiple segments', () => {
    const points = mockPoints(
      [0, 60 * SEC, 120 * SEC],
      [31.0, 31.001, 31.0],   // east then back: ~111 * 2 = 222m
      [121.0, 121.0, 121.0],
    )
    const r = computeMovementSummary(points)
    expect(r.totalPoints).toBe(3)
    expect(r.totalDistanceM).toBeGreaterThan(200)
    expect(r.totalDistanceM).toBeLessThan(260)
  })

  it('isStationary returns true for points within 10m over long period', () => {
    const now = Date.now()
    const points = mockPoints(
      [now, now + 30 * MIN, now + 60 * MIN],
      [31.0, 31.000005, 31.0],
      [121.0, 121.0, 121.000005],
    )
    expect(isStationary(points, 50, 30 * MIN)).toBe(true)
  })

  it('isStationary returns false if distance > threshold', () => {
    const now = Date.now()
    const points = mockPoints(
      [now, now + 10 * MIN, now + 20 * MIN],
      [31.0, 31.005, 31.01],  // ~550m apart
      [121.0, 121.0, 121.0],
    )
    expect(isStationary(points, 100, 10 * MIN)).toBe(false)
  })

  it('isStationary returns false if duration too short', () => {
    const now = Date.now()
    const points = mockPoints(
      [now, now + 10 * SEC, now + 20 * SEC],
      [31.0, 31.0, 31.0],
      [121.0, 121.0, 121.0],
    )
    expect(isStationary(points, 100, 30 * MIN)).toBe(false)
  })

  it('getEffectiveSpeedKmh returns kmh between two points', () => {
    const speed = getEffectiveSpeedKmh(
      { lat: 31.0, lng: 121.0, accuracy: 10, timestamp: 0 },
      { lat: 31.001, lng: 121.0, accuracy: 10, timestamp: 60 * SEC },
    )
    expect(speed).toBeGreaterThan(5)
    expect(speed).toBeLessThan(8)
  })

  it('getEffectiveSpeedKmh returns 0 for zero time', () => {
    const now = Date.now()
    const speed = getEffectiveSpeedKmh(
      { lat: 31.0, lng: 121.0, accuracy: 10, timestamp: now },
      { lat: 31.1, lng: 121.0, accuracy: 10, timestamp: now },
    )
    expect(speed).toBe(0)
  })

  it('identifies suspicious pauses (no movement >30min in dense history)', () => {
    const now = Date.now()
    // 80 min total: moves once then sits still for 40min, moves again
    const pts: TrackingPoint[] = [
      { lat: 31.0, lng: 121.0, accuracy: 10, timestamp: now },
      { lat: 31.005, lng: 121.0, accuracy: 10, timestamp: now + 5 * MIN },
      { lat: 31.005, lng: 121.000, accuracy: 10, timestamp: now + 15 * MIN },
      { lat: 31.005, lng: 121.000, accuracy: 10, timestamp: now + 25 * MIN },
      { lat: 31.005, lng: 121.000, accuracy: 10, timestamp: now + 35 * MIN },
      { lat: 31.005, lng: 121.000, accuracy: 10, timestamp: now + 45 * MIN },
      { lat: 31.005, lng: 121.000, accuracy: 10, timestamp: now + 55 * MIN },
      { lat: 31.01, lng: 121.0, accuracy: 10, timestamp: now + 65 * MIN },
      { lat: 31.015, lng: 121.0, accuracy: 10, timestamp: now + 75 * MIN },
    ]
    const r = computeMovementSummary(pts)
    expect(r.suspiciousPauses.length).toBeGreaterThan(0)
    expect(r.stationaryPeriods.length).toBeGreaterThan(0)
  })

  it('out-of-order points are sorted by timestamp', () => {
    const now = Date.now()
    const points = mockPoints(
      [now + 60 * SEC, now, now + 30 * SEC],
      [31.002, 31.0, 31.001],
      [121.0, 121.0, 121.0],
    )
    const r = computeMovementSummary(points)
    // Should behave same as sorted input — the summary should be well-defined
    expect(r.totalPoints).toBe(3)
    // Distance: now→now+30→now+60, should be 2 segments
    expect(r.totalDistanceM).toBeGreaterThan(0)
    // The order is sorted internally, so maxSpeedKmh is computed from sorted timestamps
    expect(r.maxSpeedKmh).toBeGreaterThan(0)
  })
})