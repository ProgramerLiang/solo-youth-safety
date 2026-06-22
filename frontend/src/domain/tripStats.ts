import type { SafetyTrip } from './safetyTrip'
import type { TripStats } from '../types'

export function computeTripStats(trips: SafetyTrip[]): TripStats {
  if (trips.length === 0) {
    return {
      total: 0,
      avgDurationMinutes: 0,
      onTimeRate: 0,
      topDestinations: [],
    }
  }

  const total = trips.length

  // Calculate average duration
  let totalDurationMs = 0
  for (const trip of trips) {
    const createdAtMs = new Date(trip.createdAt).getTime()
    const finalEvent = trip.events[trip.events.length - 1]
    const finalTimestampMs = finalEvent ? new Date(finalEvent.timestamp).getTime() : createdAtMs
    totalDurationMs += finalTimestampMs - createdAtMs
  }
  const avgDurationMinutes = Math.round(totalDurationMs / trips.length / 60000)

  // Calculate on-time rate
  const arrivedTrips = trips.filter(t => t.status === 'arrived')
  let onTimeCount = 0
  for (const trip of arrivedTrips) {
    const finalEvent = trip.events[trip.events.length - 1]
    if (finalEvent) {
      const finalTimestampMs = new Date(finalEvent.timestamp).getTime()
      const expectedMs = new Date(trip.expectedArrivalAt).getTime()
      if (finalTimestampMs <= expectedMs) {
        onTimeCount++
      }
    }
  }
  const onTimeRate = trips.length > 0 ? onTimeCount / trips.length : 0

  // Calculate top destinations
  const destinationCounts = new Map<string, number>()
  for (const trip of trips) {
    const current = destinationCounts.get(trip.destination) ?? 0
    destinationCounts.set(trip.destination, current + 1)
  }

  const topDestinations = Array.from(destinationCounts.entries())
    .map(([destination, count]) => ({ destination, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 3)

  return {
    total,
    avgDurationMinutes,
    onTimeRate,
    topDestinations,
  }
}
