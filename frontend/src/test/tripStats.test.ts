import { describe, expect, it } from 'vitest'
import { computeTripStats } from '../domain/tripStats'
import type { SafetyTrip } from '../domain/safetyTrip'

describe('computeTripStats', () => {
  it('returns zero stats for empty trip list', () => {
    const result = computeTripStats([])
    expect(result.total).toBe(0)
    expect(result.avgDurationMinutes).toBe(0)
    expect(result.onTimeRate).toBe(0)
    expect(result.topDestinations).toEqual([])
  })

  it('computes stats for single trip', () => {
    const trips: SafetyTrip[] = [
      {
        id: 't1',
        destination: 'Home',
        createdAt: '2026-06-22T10:00:00Z',
        expectedArrivalAt: '2026-06-22T11:00:00Z',
        status: 'arrived',
        events: [
          { id: 'e1', type: 'created', timestamp: '2026-06-22T10:00:00Z' },
          { id: 'e2', type: 'arrived', timestamp: '2026-06-22T10:30:00Z' },
        ],
      },
    ]

    const result = computeTripStats(trips)
    expect(result.total).toBe(1)
    expect(result.avgDurationMinutes).toBe(30)
    expect(result.onTimeRate).toBe(1)
    expect(result.topDestinations).toEqual([{ destination: 'Home', count: 1 }])
  })

  it('computes average duration across multiple trips', () => {
    const trips: SafetyTrip[] = [
      {
        id: 't1',
        destination: 'Home',
        createdAt: '2026-06-22T10:00:00Z',
        expectedArrivalAt: '2026-06-22T11:00:00Z',
        status: 'arrived',
        events: [
          { id: 'e1', type: 'created', timestamp: '2026-06-22T10:00:00Z' },
          { id: 'e2', type: 'arrived', timestamp: '2026-06-22T10:30:00Z' },
        ],
      },
      {
        id: 't2',
        destination: 'Office',
        createdAt: '2026-06-22T14:00:00Z',
        expectedArrivalAt: '2026-06-22T15:00:00Z',
        status: 'arrived',
        events: [
          { id: 'e3', type: 'created', timestamp: '2026-06-22T14:00:00Z' },
          { id: 'e4', type: 'arrived', timestamp: '2026-06-22T15:00:00Z' },
        ],
      },
    ]

    const result = computeTripStats(trips)
    expect(result.total).toBe(2)
    expect(result.avgDurationMinutes).toBe(45) // (30 + 60) / 2
  })

  it('computes on-time rate correctly', () => {
    const trips: SafetyTrip[] = [
      {
        id: 't1',
        destination: 'Home',
        createdAt: '2026-06-22T10:00:00Z',
        expectedArrivalAt: '2026-06-22T11:00:00Z',
        status: 'arrived',
        events: [
          { id: 'e1', type: 'created', timestamp: '2026-06-22T10:00:00Z' },
          { id: 'e2', type: 'arrived', timestamp: '2026-06-22T10:30:00Z' },
        ],
      },
      {
        id: 't2',
        destination: 'Office',
        createdAt: '2026-06-22T14:00:00Z',
        expectedArrivalAt: '2026-06-22T15:00:00Z',
        status: 'arrived',
        events: [
          { id: 'e3', type: 'created', timestamp: '2026-06-22T14:00:00Z' },
          { id: 'e4', type: 'arrived', timestamp: '2026-06-22T15:30:00Z' }, // late
        ],
      },
      {
        id: 't3',
        destination: 'Park',
        createdAt: '2026-06-22T16:00:00Z',
        expectedArrivalAt: '2026-06-22T17:00:00Z',
        status: 'cancelled',
        events: [
          { id: 'e5', type: 'created', timestamp: '2026-06-22T16:00:00Z' },
          { id: 'e6', type: 'cancelled', timestamp: '2026-06-22T16:15:00Z' },
        ],
      },
    ]

    const result = computeTripStats(trips)
    expect(result.total).toBe(3)
    expect(result.onTimeRate).toBeCloseTo(0.333, 2) // 1 on-time out of 3
  })

  it('counts top 3 destinations by frequency', () => {
    const trips: SafetyTrip[] = [
      {
        id: 't1',
        destination: 'Home',
        createdAt: '2026-06-22T10:00:00Z',
        expectedArrivalAt: '2026-06-22T11:00:00Z',
        status: 'arrived',
        events: [
          { id: 'e1', type: 'created', timestamp: '2026-06-22T10:00:00Z' },
          { id: 'e2', type: 'arrived', timestamp: '2026-06-22T10:30:00Z' },
        ],
      },
      {
        id: 't2',
        destination: 'Office',
        createdAt: '2026-06-22T11:00:00Z',
        expectedArrivalAt: '2026-06-22T12:00:00Z',
        status: 'arrived',
        events: [
          { id: 'e3', type: 'created', timestamp: '2026-06-22T11:00:00Z' },
          { id: 'e4', type: 'arrived', timestamp: '2026-06-22T11:45:00Z' },
        ],
      },
      {
        id: 't3',
        destination: 'Home',
        createdAt: '2026-06-22T17:00:00Z',
        expectedArrivalAt: '2026-06-22T18:00:00Z',
        status: 'arrived',
        events: [
          { id: 'e5', type: 'created', timestamp: '2026-06-22T17:00:00Z' },
          { id: 'e6', type: 'arrived', timestamp: '2026-06-22T17:40:00Z' },
        ],
      },
      {
        id: 't4',
        destination: 'Home',
        createdAt: '2026-06-23T17:00:00Z',
        expectedArrivalAt: '2026-06-23T18:00:00Z',
        status: 'arrived',
        events: [
          { id: 'e7', type: 'created', timestamp: '2026-06-23T17:00:00Z' },
          { id: 'e8', type: 'arrived', timestamp: '2026-06-23T17:35:00Z' },
        ],
      },
      {
        id: 't5',
        destination: 'Gym',
        createdAt: '2026-06-23T08:00:00Z',
        expectedArrivalAt: '2026-06-23T09:00:00Z',
        status: 'arrived',
        events: [
          { id: 'e9', type: 'created', timestamp: '2026-06-23T08:00:00Z' },
          { id: 'e10', type: 'arrived', timestamp: '2026-06-23T08:25:00Z' },
        ],
      },
    ]

    const result = computeTripStats(trips)
    expect(result.topDestinations).toEqual([
      { destination: 'Home', count: 3 },
      { destination: 'Office', count: 1 },
      { destination: 'Gym', count: 1 },
    ])
  })

  it('limits top destinations to 3', () => {
    const trips: SafetyTrip[] = [
      { id: 't1', destination: 'A', createdAt: '2026-06-22T10:00:00Z', expectedArrivalAt: '2026-06-22T11:00:00Z', status: 'arrived', events: [{ id: 'e1', type: 'created', timestamp: '2026-06-22T10:00:00Z' }] },
      { id: 't2', destination: 'A', createdAt: '2026-06-22T10:00:00Z', expectedArrivalAt: '2026-06-22T11:00:00Z', status: 'arrived', events: [{ id: 'e2', type: 'created', timestamp: '2026-06-22T10:00:00Z' }] },
      { id: 't3', destination: 'A', createdAt: '2026-06-22T10:00:00Z', expectedArrivalAt: '2026-06-22T11:00:00Z', status: 'arrived', events: [{ id: 'e3', type: 'created', timestamp: '2026-06-22T10:00:00Z' }] },
      { id: 't4', destination: 'B', createdAt: '2026-06-22T10:00:00Z', expectedArrivalAt: '2026-06-22T11:00:00Z', status: 'arrived', events: [{ id: 'e4', type: 'created', timestamp: '2026-06-22T10:00:00Z' }] },
      { id: 't5', destination: 'B', createdAt: '2026-06-22T10:00:00Z', expectedArrivalAt: '2026-06-22T11:00:00Z', status: 'arrived', events: [{ id: 'e5', type: 'created', timestamp: '2026-06-22T10:00:00Z' }] },
      { id: 't6', destination: 'C', createdAt: '2026-06-22T10:00:00Z', expectedArrivalAt: '2026-06-22T11:00:00Z', status: 'arrived', events: [{ id: 'e6', type: 'created', timestamp: '2026-06-22T10:00:00Z' }] },
      { id: 't7', destination: 'D', createdAt: '2026-06-22T10:00:00Z', expectedArrivalAt: '2026-06-22T11:00:00Z', status: 'arrived', events: [{ id: 'e7', type: 'created', timestamp: '2026-06-22T10:00:00Z' }] },
    ]

    const result = computeTripStats(trips)
    expect(result.topDestinations).toHaveLength(3)
    expect(result.topDestinations[0]).toEqual({ destination: 'A', count: 3 })
    expect(result.topDestinations[1]).toEqual({ destination: 'B', count: 2 })
  })

  it('handles trip without final event by using createdAt', () => {
    const trips: SafetyTrip[] = [
      {
        id: 't1',
        destination: 'Home',
        createdAt: '2026-06-22T10:00:00Z',
        expectedArrivalAt: '2026-06-22T11:00:00Z',
        status: 'active',
        events: [
          { id: 'e1', type: 'created', timestamp: '2026-06-22T10:00:00Z' },
        ],
      },
    ]

    const result = computeTripStats(trips)
    expect(result.total).toBe(1)
    expect(result.avgDurationMinutes).toBe(0) // createdAt to createdAt
  })

  it('excludes trips without arrived status from onTimeRate calculation', () => {
    const trips: SafetyTrip[] = [
      {
        id: 't1',
        destination: 'Home',
        createdAt: '2026-06-22T10:00:00Z',
        expectedArrivalAt: '2026-06-22T11:00:00Z',
        status: 'active',
        events: [
          { id: 'e1', type: 'created', timestamp: '2026-06-22T10:00:00Z' },
        ],
      },
    ]

    const result = computeTripStats(trips)
    expect(result.onTimeRate).toBe(0) // no arrived trips
  })
})
