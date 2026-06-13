import { describe, expect, it } from 'vitest'
import { geofenceEvent, routeGeofenceEvents, type GeofenceZone } from '../domain/geofence'
import type { TrackingPoint } from '../types'

function pt(lat: number, lng: number, ts: number): TrackingPoint {
  return { lat, lng, accuracy: 10, timestamp: ts }
}

const ZONE_HOME: GeofenceZone = { id: 'home', label: '家', lat: 31.0, lng: 121.0, radiusM: 200 }
const ZONE_SCHOOL: GeofenceZone = { id: 'school', label: '学校', lat: 31.5, lng: 121.5, radiusM: 500 }

describe('geofenceEvent', () => {
  it('returns inside when point is within radius', () => {
    expect(geofenceEvent(ZONE_HOME, 31.0, 121.0)).toBe('inside')
  })

  it('returns exit when point is outside radius', () => {
    expect(geofenceEvent(ZONE_HOME, 32.0, 122.0)).toBe('exit')
  })

  it('returns unknown for invalid coordinate', () => {
    expect(geofenceEvent(ZONE_HOME, NaN, 121)).toBe('unknown')
  })

  it('returns exit for 0-radius zone at non-exact point', () => {
    const zone: GeofenceZone = { id: 'pin', label: '精确', lat: 31, lng: 121, radiusM: 0 }
    expect(geofenceEvent(zone, 31, 121)).toBe('inside')
    expect(geofenceEvent(zone, 31.001, 121)).toBe('exit')
  })
})

describe('routeGeofenceEvents', () => {
  const now = Date.now()
  const ms = (min: number) => now + min * 60_000

  it('returns empty for empty zones or points', () => {
    expect(routeGeofenceEvents([], [pt(31, 121, now)])).toEqual([])
    expect(routeGeofenceEvents([ZONE_HOME], [])).toEqual([])
  })

  it('emits initial state when first point is inside', () => {
    const points = [pt(31, 121, now)]
    const events = routeGeofenceEvents([ZONE_HOME], points)
    expect(events).toHaveLength(1)
    expect(events[0]!.event).toBe('inside')
  })

  it('emits initial state when first point is outside', () => {
    const points = [pt(32, 122, now)]
    const events = routeGeofenceEvents([ZONE_HOME], points)
    expect(events).toHaveLength(1)
    expect(events[0]!.event).toBe('exit')
  })

  it('emits transition events when crossing fence boundary', () => {
    const points = [
      pt(31, 121, ms(0)),   // inside home
      pt(32, 122, ms(5)),   // exit home
      pt(31, 121, ms(10)),  // enter home
    ]
    const events = routeGeofenceEvents([ZONE_HOME], points)
    expect(events).toHaveLength(3)
    expect(events.map((e) => e.event)).toEqual(['inside', 'exit', 'inside'])
  })

  it('handles multiple zones independently', () => {
    const points = [
      pt(31, 121, ms(0)),    // inside home, exit school
      pt(31.5, 121.5, ms(5)), // exit home, inside school
    ]
    const events = routeGeofenceEvents([ZONE_HOME, ZONE_SCHOOL], points)
    const homeEvents = events.filter((e) => e.zoneId === 'home')
    const schoolEvents = events.filter((e) => e.zoneId === 'school')
    expect(homeEvents).toHaveLength(2)
    expect(homeEvents.map((e) => e.event)).toEqual(['inside', 'exit'])
    expect(schoolEvents).toHaveLength(2)
    expect(schoolEvents.map((e) => e.event)).toEqual(['exit', 'inside'])
  })

  it('does not emit duplicate consecutive same-state events', () => {
    const points = [
      pt(31, 121, ms(0)),
      pt(31.0001, 121.0001, ms(5)), // still inside
      pt(32, 122, ms(10)),          // exit
      pt(32.0001, 122.0001, ms(15)), // still exit
    ]
    const events = routeGeofenceEvents([ZONE_HOME], points)
    expect(events).toHaveLength(2)
  })

  it('skips points with invalid coordinates', () => {
    const points = [
      pt(NaN, 121, ms(0)),
      pt(31, 121, ms(5)),
    ]
    const events = routeGeofenceEvents([ZONE_HOME], points)
    expect(events).toHaveLength(1)
    expect(events[0]!.event).toBe('inside')
  })

  it('includes distance in result', () => {
    const points = [pt(31.001, 121, now)]
    const events = routeGeofenceEvents([ZONE_HOME], points)
    expect(events[0]!.distanceM).toBeGreaterThan(0)
  })
})