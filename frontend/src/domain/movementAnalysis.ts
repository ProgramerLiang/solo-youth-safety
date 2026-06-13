import type { TrackingPoint } from '../types'

export interface StationaryPeriod {
  startedAt: number
  endedAt: number
  durationMs: number
  sampleCount: number
  centerLat: number
  centerLng: number
}

export interface MovementSummary {
  totalPoints: number
  totalDistanceM: number
  totalDurationMs: number
  maxSpeedKmh: number
  avgSpeedKmh: number
  stationaryPeriods: StationaryPeriod[]
  suspiciousPauses: StationaryPeriod[]
}

const DEG_TO_RAD = Math.PI / 180

function haversineDistanceM(
  lat1: number, lng1: number,
  lat2: number, lng2: number,
): number {
  const R = 6_371_000
  const dLat = (lat2 - lat1) * DEG_TO_RAD
  const dLng = (lng2 - lng1) * DEG_TO_RAD
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * DEG_TO_RAD) *
      Math.cos(lat2 * DEG_TO_RAD) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

export function getEffectiveSpeedKmh(from: TrackingPoint, to: TrackingPoint): number {
  const dt = to.timestamp - from.timestamp
  if (dt <= 0) return 0
  const distance = haversineDistanceM(from.lat, from.lng, to.lat, to.lng)
  return (distance / dt) * 3600
}

function pointsWithinRadius(
  pts: TrackingPoint[],
  centerLat: number,
  centerLng: number,
  maxDistanceM: number,
): boolean {
  for (const p of pts) {
    if (haversineDistanceM(p.lat, p.lng, centerLat, centerLng) > maxDistanceM) return false
  }
  return true
}

export function isStationary(
  points: TrackingPoint[],
  maxDistanceM: number,
  minDurationMs: number,
): boolean {
  if (points.length < 2) return false
  const sorted = [...points].sort((a, b) => a.timestamp - b.timestamp)
  const first = sorted[0]!
  const last = sorted[sorted.length - 1]!
  if (last.timestamp - first.timestamp < minDurationMs) return false

  let sumLat = 0
  let sumLng = 0
  for (const p of sorted) {
    sumLat += p.lat
    sumLng += p.lng
  }
  return pointsWithinRadius(sorted, sumLat / sorted.length, sumLng / sorted.length, maxDistanceM)
}

const SUSPICIOUS_PAUSE_MIN_MS = 30 * 60 * 1000
const SUSPICIOUS_PAUSE_MAX_DISTANCE_M = 50
const STATIONARY_MAX_DISTANCE_M = 100
const STATIONARY_MIN_DURATION_MS = 10 * 60 * 1000
const MIN_MOVEMENT_DISTANCE_M = 5

function extractPeriods(
  sorted: TrackingPoint[],
  maxDistanceM: number,
  minDurationMs: number,
): StationaryPeriod[] {
  const periods: StationaryPeriod[] = []
  if (sorted.length < 2) return periods

  let windowStart = 0
  for (let i = 1; i <= sorted.length; i++) {
    const windowEnd = i < sorted.length ? sorted[i] : null
    const windowPts = sorted.slice(windowStart, i)

    const stillStationary =
      windowEnd != null &&
      pointsWithinRadius(
        [...windowPts, windowEnd],
        sorted[windowStart]!.lat,
        sorted[windowStart]!.lng,
        maxDistanceM,
      )

    if (!stillStationary || i === sorted.length) {
      if (windowPts.length >= 2) {
        const wFirst = windowPts[0]!
        const wLast = windowPts[windowPts.length - 1]!
        const duration = wLast.timestamp - wFirst.timestamp
        if (duration >= minDurationMs) {
          let sumLat = 0
          let sumLng = 0
          for (const p of windowPts) {
            sumLat += p.lat
            sumLng += p.lng
          }
          periods.push({
            startedAt: wFirst.timestamp,
            endedAt: wLast.timestamp,
            durationMs: duration,
            sampleCount: windowPts.length,
            centerLat: sumLat / windowPts.length,
            centerLng: sumLng / windowPts.length,
          })
        }
      }
      windowStart = i
    }
  }
  return periods
}

export function computeMovementSummary(points: TrackingPoint[]): MovementSummary {
  if (points.length === 0) {
    return {
      totalPoints: 0,
      totalDistanceM: 0,
      totalDurationMs: 0,
      maxSpeedKmh: 0,
      avgSpeedKmh: 0,
      stationaryPeriods: [],
      suspiciousPauses: [],
    }
  }

  const sorted = [...points].sort((a, b) => a.timestamp - b.timestamp)

  let totalDistanceM = 0
  let maxSpeedKmh = 0

  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1]!
    const cur = sorted[i]!
    const d = haversineDistanceM(prev.lat, prev.lng, cur.lat, cur.lng)
    if (d >= MIN_MOVEMENT_DISTANCE_M) {
      totalDistanceM += d
      const speed = getEffectiveSpeedKmh(prev, cur)
      if (speed > maxSpeedKmh) maxSpeedKmh = speed
    }
  }

  const first = sorted[0]!
  const last = sorted[sorted.length - 1]!
  const totalDurationMs = sorted.length >= 2 ? last.timestamp - first.timestamp : 0
  const avgSpeedKmh = totalDurationMs > 0 ? (totalDistanceM / totalDurationMs) * 3600 : 0

  return {
    totalPoints: sorted.length,
    totalDistanceM: Math.round(totalDistanceM),
    totalDurationMs,
    maxSpeedKmh: Math.round(maxSpeedKmh * 10) / 10,
    avgSpeedKmh: Math.round(avgSpeedKmh * 10) / 10,
    stationaryPeriods: extractPeriods(sorted, STATIONARY_MAX_DISTANCE_M, STATIONARY_MIN_DURATION_MS),
    suspiciousPauses: extractPeriods(sorted, SUSPICIOUS_PAUSE_MAX_DISTANCE_M, SUSPICIOUS_PAUSE_MIN_MS),
  }
}