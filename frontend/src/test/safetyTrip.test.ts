import { describe, expect, it } from 'vitest'
import {
  createSafetyTrip,
  deriveSafetyTripStatus,
  extendSafetyTrip,
  markSafetyTripArrived,
  cancelSafetyTrip,
  summarizeSafetyTripForDiagnostics,
} from '../domain/safetyTrip'
import type { SafetyTrip } from '../domain/safetyTrip'

const NOW = new Date('2026-06-15T12:00:00.000Z').getTime()

describe('createSafetyTrip', () => {
  it('creates an active trip with expected fields', () => {
    const trip = createSafetyTrip({ destination: '回宿舍', note: '从地铁站走回', durationMinutes: 30 }, { id: 't1', now: NOW })
    expect(trip.id).toBe('t1')
    expect(trip.destination).toBe('回宿舍')
    expect(trip.note).toBe('从地铁站走回')
    expect(trip.createdAt).toBe('2026-06-15T12:00:00.000Z')
    expect(trip.expectedArrivalAt).toBe('2026-06-15T12:30:00.000Z')
    expect(trip.status).toBe('active')
    expect(trip.events[0]!.type).toBe('created')
  })

  it('strips whitespace from destination', () => {
    const trip = createSafetyTrip({ destination: '  回宿舍  ', note: undefined, durationMinutes: 15 }, { id: 't1', now: NOW })
    expect(trip.destination).toBe('回宿舍')
    expect(trip.note).toBeUndefined()
  })
})

describe('deriveSafetyTripStatus', () => {
  const baseTrip: SafetyTrip = {
    id: 't1',
    destination: '回宿舍',
    createdAt: '2026-06-15T12:00:00.000Z',
    expectedArrivalAt: '2026-06-15T12:30:00.000Z',
    status: 'active',
    events: [],
  }

  it('returns active when now is before expectedArrival', () => {
    expect(deriveSafetyTripStatus(baseTrip, NOW + 10 * 60_000)).toBe('active')
  })

  it('returns overdue when now is after expectedArrival and trip is active', () => {
    expect(deriveSafetyTripStatus(baseTrip, NOW + 31 * 60_000)).toBe('overdue')
  })

  it('returns arrived when status is already arrived regardless of time', () => {
    expect(deriveSafetyTripStatus({ ...baseTrip, status: 'arrived' }, NOW + 99 * 60_000)).toBe('arrived')
  })

  it('returns cancelled when status is already cancelled', () => {
    expect(deriveSafetyTripStatus({ ...baseTrip, status: 'cancelled' }, NOW + 99 * 60_000)).toBe('cancelled')
  })
})

describe('extendSafetyTrip', () => {
  it('pushes expectedArrival forward by given minutes and adds extend event', () => {
    const trip: SafetyTrip = {
      id: 't1',
      destination: '回宿舍',
      createdAt: '2026-06-15T12:00:00.000Z',
      expectedArrivalAt: '2026-06-15T12:30:00.000Z',
      status: 'active',
      events: [],
    }
    const extended = extendSafetyTrip(trip, 10, { id: 'e1', now: NOW + 20 * 60_000 })
    expect(extended.expectedArrivalAt).toBe('2026-06-15T12:40:00.000Z')
    expect(extended.events.some((e) => e.type === 'extended')).toBe(true)
  })
})

describe('markSafetyTripArrived', () => {
  it('sets status to arrived and adds arrived event', () => {
    const trip: SafetyTrip = {
      id: 't1',
      destination: '回宿舍',
      createdAt: '2026-06-15T12:00:00.000Z',
      expectedArrivalAt: '2026-06-15T12:30:00.000Z',
      status: 'active',
      events: [],
    }
    const arrived = markSafetyTripArrived(trip, { id: 'e1', now: NOW + 25 * 60_000 })
    expect(arrived.status).toBe('arrived')
    expect(arrived.events.some((e) => e.type === 'arrived')).toBe(true)
  })
})

describe('cancelSafetyTrip', () => {
  it('sets status to cancelled and adds cancelled event', () => {
    const trip: SafetyTrip = {
      id: 't1',
      destination: '回宿舍',
      createdAt: '2026-06-15T12:00:00.000Z',
      expectedArrivalAt: '2026-06-15T12:30:00.000Z',
      status: 'active',
      events: [],
    }
    const cancelled = cancelSafetyTrip(trip, { id: 'e1', now: NOW + 5 * 60_000 })
    expect(cancelled.status).toBe('cancelled')
    expect(cancelled.events.some((e) => e.type === 'cancelled')).toBe(true)
  })
})

describe('summarizeSafetyTripForDiagnostics', () => {
  it('returns redacted summary without destination text or note', () => {
    const trip: SafetyTrip = {
      id: 't1',
      destination: '回宿舍',
      note: '从地铁站走回',
      createdAt: '2026-06-15T12:00:00.000Z',
      expectedArrivalAt: '2026-06-15T12:30:00.000Z',
      status: 'active',
      events: [],
    }
    const summary = summarizeSafetyTripForDiagnostics(trip, NOW)
    const text = JSON.stringify(summary)
    expect(text).not.toContain('回宿舍')
    expect(text).not.toContain('从地铁站走回')
    expect(summary.destinationLength).toBe(3)
    expect(summary.derivedStatus).toBe('active')
  })
})
