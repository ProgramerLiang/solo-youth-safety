import type { SosResult, TrackingPoint } from '../types'
import { getEffectiveSpeedKmh } from './movementAnalysis'

export type PlaybackPointRole = 'start' | 'tracking' | 'sos' | 'end'

export interface PlaybackBounds {
  minLat: number
  maxLat: number
  minLng: number
  maxLng: number
}

export interface PlaybackPoint {
  id: string
  role: PlaybackPointRole
  label: string
  timestamp: number
  lat: number
  lng: number
  accuracy: number | null
  detail: string
  source: 'tracking' | 'sos'
  status?: string
  speedKmh?: number
}

export interface PlaybackRoute {
  points: PlaybackPoint[]
  totalTrackingPoints: number
  totalSosEvents: number
  startedAt: number | null
  endedAt: number | null
  durationMs: number
  bounds: PlaybackBounds | null
}

function isValidCoordinate(lat: number, lng: number): boolean {
  return Number.isFinite(lat) && lat >= -90 && lat <= 90 && Number.isFinite(lng) && lng >= -180 && lng <= 180
}

function toAccuracy(value: number | null | undefined): number | null {
  return Number.isFinite(value) ? value as number : null
}

function toTrackingPoint(point: TrackingPoint, index: number): PlaybackPoint | null {
  if (!isValidCoordinate(point.lat, point.lng) || !Number.isFinite(point.timestamp)) return null
  return {
    id: `tracking-${point.timestamp}-${index}`,
    role: 'tracking',
    label: '轨迹点',
    timestamp: point.timestamp,
    lat: point.lat,
    lng: point.lng,
    accuracy: toAccuracy(point.accuracy),
    detail: `精度 ${toAccuracy(point.accuracy) ?? '未知'} m`,
    source: 'tracking',
  }
}

function toSosPoint(result: SosResult, index: number): PlaybackPoint | null {
  if (!result.location || !Number.isFinite(result.triggeredAt)) return null
  const { lat, lng, accuracy } = result.location
  if (!isValidCoordinate(lat, lng)) return null
  return {
    id: `sos-${result.triggeredAt}-${index}`,
    role: 'sos',
    label: 'SOS 关键节点',
    timestamp: result.triggeredAt as number,
    lat,
    lng,
    accuracy: toAccuracy(accuracy),
    detail: result.summary || result.finalLabel,
    source: 'sos',
    status: result.finalLabel,
  }
}

function buildBounds(points: PlaybackPoint[]): PlaybackBounds | null {
  if (points.length === 0) return null
  let minLat = points[0]!.lat
  let maxLat = points[0]!.lat
  let minLng = points[0]!.lng
  let maxLng = points[0]!.lng
  for (let i = 1; i < points.length; i += 1) {
    const point = points[i]!
    if (point.lat < minLat) minLat = point.lat
    if (point.lat > maxLat) maxLat = point.lat
    if (point.lng < minLng) minLng = point.lng
    if (point.lng > maxLng) maxLng = point.lng
  }
  return { minLat, maxLat, minLng, maxLng }
}

function applyEndpointRoles(points: PlaybackPoint[]): PlaybackPoint[] {
  const trackingIndexes = points
    .map((point, index) => point.source === 'tracking' ? index : -1)
    .filter((index) => index >= 0)

  if (trackingIndexes.length === 0) return points

  const next = points.map((point) => ({ ...point }))
  const firstIndex = trackingIndexes[0]!
  const lastIndex = trackingIndexes[trackingIndexes.length - 1]!
  const first = next[firstIndex]
  if (!first) return next
  first.role = 'start'
  first.label = '开始点'
  if (lastIndex !== firstIndex) {
    const last = next[lastIndex]
    if (last) {
      last.role = 'end'
      last.label = '结束点'
    }
  }
  return next
}

export function buildPlaybackRoute(trackingPoints: TrackingPoint[], sosHistory: SosResult[]): PlaybackRoute {
  const tracking = trackingPoints.map(toTrackingPoint).filter((point): point is PlaybackPoint => point !== null)
  const sos = sosHistory.map(toSosPoint).filter((point): point is PlaybackPoint => point !== null)
  const points = applyEndpointRoles([...tracking, ...sos].sort((a, b) => a.timestamp - b.timestamp))
  for (let i = 1; i < points.length; i += 1) {
    const prev = points[i - 1]
    const curr = points[i]
    if (prev && curr) {
      curr.speedKmh = getEffectiveSpeedKmh(prev, curr)
    }
  }
  const startedAt = points[0]?.timestamp ?? null
  const endedAt = points[points.length - 1]?.timestamp ?? null
  return {
    points,
    totalTrackingPoints: tracking.length,
    totalSosEvents: sos.length,
    startedAt,
    endedAt,
    durationMs: startedAt === null || endedAt === null ? 0 : Math.max(endedAt - startedAt, 0),
    bounds: buildBounds(points),
  }
}
