export type SafetyTripStatus = 'active' | 'overdue' | 'arrived' | 'cancelled'

export type SafetyTripEventType = 'created' | 'extended' | 'arrived' | 'cancelled' | 'overdue_seen'

export interface SafetyTripEvent {
  id: string
  type: SafetyTripEventType
  timestamp: string
  detail?: string
}

export interface SafetyTrip {
  id: string
  destination: string
  note?: string
  createdAt: string
  expectedArrivalAt: string
  status: SafetyTripStatus
  events: SafetyTripEvent[]
}

export interface TripContext {
  id: string
  now: number
}

export interface CreateSafetyTripInput {
  destination: string
  note?: string
  durationMinutes: number
}

function toIso(ts: number): string {
  return new Date(ts).toISOString()
}

function appendEvent(events: SafetyTripEvent[], ctx: TripContext, type: SafetyTripEventType, detail?: string): SafetyTripEvent[] {
  return [...events, { id: ctx.id, type, timestamp: toIso(ctx.now), detail }]
}

export function createSafetyTrip(input: CreateSafetyTripInput, ctx: TripContext): SafetyTrip {
  const destination = input.destination.trim()
  const note = input.note?.trim() || undefined
  const expectedArrivalAt = toIso(ctx.now + input.durationMinutes * 60_000)
  return {
    id: ctx.id,
    destination,
    note,
    createdAt: toIso(ctx.now),
    expectedArrivalAt,
    status: 'active',
    events: appendEvent([], ctx, 'created'),
  }
}

export function deriveSafetyTripStatus(trip: SafetyTrip, now: number): SafetyTripStatus {
  if (trip.status === 'arrived') return 'arrived'
  if (trip.status === 'cancelled') return 'cancelled'
  return now >= new Date(trip.expectedArrivalAt).getTime() ? 'overdue' : 'active'
}

export function extendSafetyTrip(trip: SafetyTrip, minutes: number, ctx: TripContext): SafetyTrip {
  const currentExpected = new Date(trip.expectedArrivalAt).getTime()
  const newExpected = Math.max(currentExpected, ctx.now) + minutes * 60_000
  return {
    ...trip,
    expectedArrivalAt: toIso(newExpected),
    events: appendEvent(trip.events, ctx, 'extended', `+${minutes}min`),
  }
}

export function markSafetyTripArrived(trip: SafetyTrip, ctx: TripContext): SafetyTrip {
  return {
    ...trip,
    status: 'arrived',
    events: appendEvent(trip.events, ctx, 'arrived'),
  }
}

export function cancelSafetyTrip(trip: SafetyTrip, ctx: TripContext): SafetyTrip {
  return {
    ...trip,
    status: 'cancelled',
    events: appendEvent(trip.events, ctx, 'cancelled'),
  }
}

export interface SafetyTripDiagnosticSummary {
  destinationLength: number
  hasNote: boolean
  derivedStatus: SafetyTripStatus
  createdAt: string
  expectedArrivalAt: string
}

export function summarizeSafetyTripForDiagnostics(trip: SafetyTrip, now: number = Date.now()): SafetyTripDiagnosticSummary {
  return {
    destinationLength: trip.destination.length,
    hasNote: !!trip.note,
    derivedStatus: deriveSafetyTripStatus(trip, now),
    createdAt: trip.createdAt,
    expectedArrivalAt: trip.expectedArrivalAt,
  }
}
