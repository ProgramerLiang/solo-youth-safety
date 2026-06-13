import { haversineDistanceM, isValidCoordinate } from './geo'
import type { TrackingPoint } from '../types'

export interface GeofenceZone {
  id: string
  label: string
  lat: number
  lng: number
  radiusM: number
}

export type FenceEvent = 'inside' | 'exit' | 'enter' | 'unknown'

export interface GeofenceResult {
  zoneId: string
  zoneLabel: string
  event: FenceEvent
  at: number
  lat: number
  lng: number
  distanceM: number
}

export function geofenceEvent(
  zone: GeofenceZone,
  lat: number,
  lng: number,
): FenceEvent {
  if (!isValidCoordinate(lat, lng)) return 'unknown'
  return haversineDistanceM(zone.lat, zone.lng, lat, lng) <= zone.radiusM ? 'inside' : 'exit'
}

export function routeGeofenceEvents(
  zones: GeofenceZone[],
  points: TrackingPoint[],
): GeofenceResult[] {
  if (zones.length === 0 || points.length === 0) return []

  const sorted = [...points].sort((a, b) => a.timestamp - b.timestamp)
  const events: GeofenceResult[] = []
  const prevState: Map<string, FenceEvent> = new Map()

  for (const pt of sorted) {
    for (const zone of zones) {
      const current = geofenceEvent(zone, pt.lat, pt.lng)
      const prev = prevState.get(zone.id)

      if (current === 'unknown') continue
      if (prev === undefined) {
        // First encounter: emit initial state
        prevState.set(zone.id, current)
        const distanceM = haversineDistanceM(zone.lat, zone.lng, pt.lat, pt.lng)
        events.push({
          zoneId: zone.id,
          zoneLabel: zone.label,
          event: current,
          at: pt.timestamp,
          lat: pt.lat,
          lng: pt.lng,
          distanceM: Math.round(distanceM),
        })
      } else if (prev !== current) {
        // Transition
        prevState.set(zone.id, current)
        const distanceM = haversineDistanceM(zone.lat, zone.lng, pt.lat, pt.lng)
        events.push({
          zoneId: zone.id,
          zoneLabel: zone.label,
          event: current,
          at: pt.timestamp,
          lat: pt.lat,
          lng: pt.lng,
          distanceM: Math.round(distanceM),
        })
      }
    }
  }

  return events
}