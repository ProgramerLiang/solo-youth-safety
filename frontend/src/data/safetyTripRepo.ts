import { storage } from './storage'
import type { SafetyTrip } from '../domain/safetyTrip'

export const CURRENT_TRIP_KEY = 'safety_v2_current_trip'
export const TRIP_HISTORY_KEY = 'safety_v2_trip_history'
export const MAX_TRIP_HISTORY = 50

export async function loadCurrentSafetyTrip(): Promise<SafetyTrip | null> {
  return storage.getJson<SafetyTrip>(CURRENT_TRIP_KEY)
}

export async function saveCurrentSafetyTrip(trip: SafetyTrip | null): Promise<void> {
  if (trip === null) {
    await storage.remove(CURRENT_TRIP_KEY)
    return
  }
  await storage.setJson(CURRENT_TRIP_KEY, trip)
}

export async function loadSafetyTripHistory(): Promise<SafetyTrip[]> {
  const data = await storage.getJson<SafetyTrip[]>(TRIP_HISTORY_KEY)
  return Array.isArray(data) ? data : []
}

export async function appendSafetyTripHistory(trip: SafetyTrip): Promise<void> {
  const current = await loadSafetyTripHistory()
  const next = [...current, trip]
  const trimmed = next.length > MAX_TRIP_HISTORY ? next.slice(next.length - MAX_TRIP_HISTORY) : next
  await storage.setJson(TRIP_HISTORY_KEY, trimmed)
}
