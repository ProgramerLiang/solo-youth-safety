import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { createTripPreset, updateTripPreset, validatePreset } from '../domain/tripPreset'
import { loadTripPresets, saveTripPresets, MAX_TRIP_PRESETS } from '../data/tripPresetRepo'
import type { TripPreset } from '../types'

vi.mock('../data/storage', () => ({
  storage: {
    getJson: vi.fn(),
    setJson: vi.fn(),
  },
}))

import { storage } from '../data/storage'

describe('createTripPreset', () => {
  it('creates a preset with id, destination, and duration', () => {
    const preset = createTripPreset('Home', 30)
    expect(preset.id).toBeTruthy()
    expect(preset.destination).toBe('Home')
    expect(preset.durationMinutes).toBe(30)
  })

  it('trims whitespace from destination', () => {
    const preset = createTripPreset('  Office  ', 45)
    expect(preset.destination).toBe('Office')
  })

  it('generates unique ids', () => {
    const p1 = createTripPreset('A', 10)
    const p2 = createTripPreset('B', 20)
    expect(p1.id).not.toBe(p2.id)
  })
})

describe('updateTripPreset', () => {
  const base: TripPreset = { id: 'p1', destination: 'Home', durationMinutes: 30 }

  it('updates destination only', () => {
    const updated = updateTripPreset(base, { destination: 'Office' })
    expect(updated.id).toBe('p1')
    expect(updated.destination).toBe('Office')
    expect(updated.durationMinutes).toBe(30)
  })

  it('updates duration only', () => {
    const updated = updateTripPreset(base, { durationMinutes: 45 })
    expect(updated.id).toBe('p1')
    expect(updated.destination).toBe('Home')
    expect(updated.durationMinutes).toBe(45)
  })

  it('updates both fields', () => {
    const updated = updateTripPreset(base, { destination: 'Gym', durationMinutes: 60 })
    expect(updated.destination).toBe('Gym')
    expect(updated.durationMinutes).toBe(60)
  })

  it('trims whitespace from updated destination', () => {
    const updated = updateTripPreset(base, { destination: '  School  ' })
    expect(updated.destination).toBe('School')
  })

  it('preserves id', () => {
    const updated = updateTripPreset(base, { destination: 'X' })
    expect(updated.id).toBe(base.id)
  })
})

describe('validatePreset', () => {
  it('returns true for valid preset', () => {
    const valid: TripPreset = { id: 'p1', destination: 'Home', durationMinutes: 30 }
    expect(validatePreset(valid)).toBe(true)
  })

  it('returns false for missing id', () => {
    const invalid = { id: '', destination: 'Home', durationMinutes: 30 } as TripPreset
    expect(validatePreset(invalid)).toBe(false)
  })

  it('returns false for empty destination', () => {
    const invalid = { id: 'p1', destination: '', durationMinutes: 30 } as TripPreset
    expect(validatePreset(invalid)).toBe(false)
  })

  it('returns false for whitespace-only destination', () => {
    const invalid = { id: 'p1', destination: '   ', durationMinutes: 30 } as TripPreset
    expect(validatePreset(invalid)).toBe(false)
  })

  it('returns false for zero duration', () => {
    const invalid = { id: 'p1', destination: 'Home', durationMinutes: 0 } as TripPreset
    expect(validatePreset(invalid)).toBe(false)
  })

  it('returns false for negative duration', () => {
    const invalid = { id: 'p1', destination: 'Home', durationMinutes: -10 } as TripPreset
    expect(validatePreset(invalid)).toBe(false)
  })

  it('returns false for infinite duration', () => {
    const invalid = { id: 'p1', destination: 'Home', durationMinutes: Infinity } as TripPreset
    expect(validatePreset(invalid)).toBe(false)
  })
})

describe('loadTripPresets', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('loads presets from storage', async () => {
    const presets: TripPreset[] = [
      { id: 'p1', destination: 'Home', durationMinutes: 30 },
      { id: 'p2', destination: 'Office', durationMinutes: 45 },
    ]
    vi.mocked(storage.getJson).mockResolvedValue(presets)

    const result = await loadTripPresets()
    expect(result).toEqual(presets)
    expect(storage.getJson).toHaveBeenCalledWith('safety_v2_trip_presets')
  })

  it('returns empty array when storage is empty', async () => {
    vi.mocked(storage.getJson).mockResolvedValue(null)

    const result = await loadTripPresets()
    expect(result).toEqual([])
  })

  it('returns empty array when storage contains non-array', async () => {
    vi.mocked(storage.getJson).mockResolvedValue({ invalid: 'data' })

    const result = await loadTripPresets()
    expect(result).toEqual([])
  })
})

describe('saveTripPresets', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('saves presets to storage', async () => {
    const presets: TripPreset[] = [
      { id: 'p1', destination: 'Home', durationMinutes: 30 },
    ]

    await saveTripPresets(presets)
    expect(storage.setJson).toHaveBeenCalledWith('safety_v2_trip_presets', presets)
  })

  it('trims to max 10 presets', async () => {
    const presets: TripPreset[] = Array.from({ length: 15 }, (_, i) => ({
      id: `p${i}`,
      destination: `Dest${i}`,
      durationMinutes: 30,
    }))

    await saveTripPresets(presets)
    const saved = vi.mocked(storage.setJson).mock.calls[0][1] as TripPreset[]
    expect(saved).toHaveLength(MAX_TRIP_PRESETS)
    expect(saved[0].id).toBe('p0')
    expect(saved[9].id).toBe('p9')
  })

  it('preserves order when trimming', async () => {
    const presets: TripPreset[] = [
      { id: 'first', destination: 'A', durationMinutes: 10 },
      { id: 'second', destination: 'B', durationMinutes: 20 },
      { id: 'third', destination: 'C', durationMinutes: 30 },
    ]

    await saveTripPresets(presets)
    const saved = vi.mocked(storage.setJson).mock.calls[0][1] as TripPreset[]
    expect(saved[0].id).toBe('first')
    expect(saved[1].id).toBe('second')
    expect(saved[2].id).toBe('third')
  })
})
