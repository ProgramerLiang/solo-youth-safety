import type { TripPreset } from '../types'

export function createTripPreset(destination: string, durationMinutes: number): TripPreset {
  return {
    id: crypto.randomUUID(),
    destination: destination.trim(),
    durationMinutes,
  }
}

export function updateTripPreset(
  preset: TripPreset,
  updates: Partial<Pick<TripPreset, 'destination' | 'durationMinutes'>>
): TripPreset {
  return {
    ...preset,
    ...(updates.destination !== undefined ? { destination: updates.destination.trim() } : {}),
    ...(updates.durationMinutes !== undefined ? { durationMinutes: updates.durationMinutes } : {}),
  }
}

export function validatePreset(preset: TripPreset): boolean {
  if (!preset.id || typeof preset.id !== 'string') return false
  if (!preset.destination || typeof preset.destination !== 'string') return false
  if (preset.destination.trim().length === 0) return false
  if (typeof preset.durationMinutes !== 'number') return false
  if (preset.durationMinutes <= 0) return false
  if (!Number.isFinite(preset.durationMinutes)) return false
  return true
}
