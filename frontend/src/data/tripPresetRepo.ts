import { storage } from './storage'
import type { TripPreset } from '../types'

export const TRIP_PRESETS_KEY = 'safety_v2_trip_presets'
export const MAX_TRIP_PRESETS = 10

export async function loadTripPresets(): Promise<TripPreset[]> {
  const data = await storage.getJson<TripPreset[]>(TRIP_PRESETS_KEY)
  return Array.isArray(data) ? data : []
}

export async function saveTripPresets(presets: TripPreset[]): Promise<void> {
  const trimmed = presets.slice(0, MAX_TRIP_PRESETS)
  await storage.setJson(TRIP_PRESETS_KEY, trimmed)
}
