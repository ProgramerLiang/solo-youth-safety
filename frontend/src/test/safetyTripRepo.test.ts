import { beforeEach, describe, expect, it } from 'vitest'
import { loadCurrentSafetyTrip, saveCurrentSafetyTrip, loadSafetyTripHistory, appendSafetyTripHistory } from '../data/safetyTripRepo'
import type { SafetyTrip } from '../domain/safetyTrip'

const sampleTrip = (overrides: Partial<SafetyTrip> = {}): SafetyTrip => ({
  id: 't1',
  destination: '回宿舍',
  createdAt: '2026-06-15T12:00:00.000Z',
  expectedArrivalAt: '2026-06-15T12:30:00.000Z',
  status: 'arrived',
  events: [{ id: 'e1', type: 'created', timestamp: '2026-06-15T12:00:00.000Z' }],
  ...overrides,
})

beforeEach(() => {
  localStorage.clear()
})

describe('loadCurrentSafetyTrip', () => {
  it('returns null when nothing saved', async () => {
    expect(await loadCurrentSafetyTrip()).toBeNull()
  })

  it('returns saved trip', async () => {
    await saveCurrentSafetyTrip(sampleTrip())
    const loaded = await loadCurrentSafetyTrip()
    expect(loaded?.id).toBe('t1')
    expect(loaded?.destination).toBe('回宿舍')
  })

  it('returns null for corrupted data', async () => {
    localStorage.setItem('safety_v2_current_trip', '{bad json')
    expect(await loadCurrentSafetyTrip()).toBeNull()
  })
})

describe('saveCurrentSafetyTrip', () => {
  it('persists trip to localStorage', async () => {
    await saveCurrentSafetyTrip(sampleTrip())
    const raw = localStorage.getItem('safety_v2_current_trip')
    expect(raw).not.toBeNull()
    expect(JSON.parse(raw!).id).toBe('t1')
  })

  it('clears current trip when given null', async () => {
    await saveCurrentSafetyTrip(sampleTrip())
    await saveCurrentSafetyTrip(null)
    expect(await loadCurrentSafetyTrip()).toBeNull()
  })
})

describe('loadSafetyTripHistory', () => {
  it('returns empty array when nothing saved', async () => {
    expect(await loadSafetyTripHistory()).toEqual([])
  })

  it('returns corrupted as empty', async () => {
    localStorage.setItem('safety_v2_trip_history', 'not json')
    expect(await loadSafetyTripHistory()).toEqual([])
  })
})

describe('appendSafetyTripHistory', () => {
  it('appends trip to history', async () => {
    await appendSafetyTripHistory(sampleTrip({ id: 't1' }))
    await appendSafetyTripHistory(sampleTrip({ id: 't2' }))
    const history = await loadSafetyTripHistory()
    expect(history).toHaveLength(2)
  })

  it('caps history at 50 entries', async () => {
    for (let i = 0; i < 55; i++) {
      await appendSafetyTripHistory(sampleTrip({ id: `t${i}` }))
    }
    const history = await loadSafetyTripHistory()
    expect(history).toHaveLength(50)
    expect(history[0]!.id).toBe('t5')
  })
})
