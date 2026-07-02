import { create } from 'zustand'
import {
  createSafetyTrip,
  extendSafetyTrip,
  markSafetyTripArrived,
  cancelSafetyTrip,
  deriveSafetyTripStatus,
} from '../domain/safetyTrip'
import type { SafetyTrip, SafetyTripStatus, CreateSafetyTripInput } from '../domain/safetyTrip'
import {
  loadCurrentSafetyTrip,
  saveCurrentSafetyTrip,
  loadSafetyTripHistory,
  appendSafetyTripHistory,
} from '../data/safetyTripRepo'
import {
  scheduleTripExpiryNotification,
  cancelNotification,
} from '../data/localNotificationRepo'
import { useNotificationConfigStore } from './useNotificationConfigStore'
import { useRuleEngineStore } from './useRuleEngineStore'
import type { RuleEvaluationState } from '../types'

export type { SafetyTrip, SafetyTripStatus }

function genId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return `t_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

async function scheduleTripNotification(trip: SafetyTrip): Promise<string> {
  const notifStore = useNotificationConfigStore.getState()
  const config = notifStore.config
  if (!config || !config.enabled || !config.tripExpiring.enabled) return ''
  const id = await scheduleTripExpiryNotification(trip, config.tripExpiring.leadMinutes)
  return id
}

function toRuleTripStatus(status: SafetyTripStatus | null): RuleEvaluationState['tripStatus'] {
  if (status === 'overdue') return 'overtime'
  return status
}

function tripOvertimeMinutes(trip: SafetyTrip, now: number): number | null {
  const status = deriveSafetyTripStatus(trip, now)
  if (status !== 'overdue') return null
  return Math.max(0, Math.floor((now - new Date(trip.expectedArrivalAt).getTime()) / 60_000))
}

function evaluateTripRules(trip: SafetyTrip, now: number): void {
  const status = deriveSafetyTripStatus(trip, now)
  useRuleEngineStore.getState().evaluate({
    riskLevel: 'ok',
    tripStatus: toRuleTripStatus(status),
    tripOvertimeMinutes: tripOvertimeMinutes(trip, now),
    latestGeofenceEvent: null,
    stationaryMinutes: null,
  }, now)
}

interface SafetyTripState {
  current: SafetyTrip | null
  history: SafetyTrip[]
  loaded: boolean
  _notificationId: string
  initialize: () => Promise<void>
  createTrip: (input: CreateSafetyTripInput) => Promise<void>
  arrive: () => Promise<void>
  extend: (minutes: number) => Promise<void>
  cancel: () => Promise<void>
  currentStatus: (now: number) => SafetyTripStatus | null
}

export const useSafetyTripStore = create<SafetyTripState>((set, get) => ({
  current: null,
  history: [],
  loaded: false,
  _notificationId: '',

  initialize: async () => {
    const [current, history] = await Promise.all([loadCurrentSafetyTrip(), loadSafetyTripHistory()])
    set({ current, history, loaded: true })
  },

  createTrip: async (input) => {
    if (get().current) return
    const now = Date.now()
    const trip = createSafetyTrip(input, { id: genId(), now })
    await saveCurrentSafetyTrip(trip)
    const notifId = await scheduleTripNotification(trip)
    set({ current: trip, _notificationId: notifId })
  },

  arrive: async () => {
    const trip = get().current
    if (!trip) return
    const notifId = get()._notificationId
    if (notifId) cancelNotification(notifId)
    const now = Date.now()
    const arrived = markSafetyTripArrived(trip, { id: genId(), now })
    await appendSafetyTripHistory(arrived)
    await saveCurrentSafetyTrip(null)
    set({ current: null, history: [...get().history, arrived], _notificationId: '' })
    evaluateTripRules(arrived, now)
  },
  extend: async (minutes) => {
    const trip = get().current
    if (!trip) return
    const now = Date.now()
    const extended = extendSafetyTrip(trip, minutes, { id: genId(), now })
    await saveCurrentSafetyTrip(extended)
    const oldNotifId = get()._notificationId
    if (oldNotifId) cancelNotification(oldNotifId)
    const newNotifId = await scheduleTripNotification(extended)
    set({ current: extended, _notificationId: newNotifId })
    evaluateTripRules(extended, now)
  },
  cancel: async () => {
    const trip = get().current
    if (!trip) return
    const notifId = get()._notificationId
    if (notifId) cancelNotification(notifId)
    const now = Date.now()
    const cancelled = cancelSafetyTrip(trip, { id: genId(), now })
    await appendSafetyTripHistory(cancelled)
    await saveCurrentSafetyTrip(null)
    set({ current: null, history: [...get().history, cancelled], _notificationId: '' })
    evaluateTripRules(cancelled, now)
  },

  currentStatus: (now) => {
    const trip = get().current
    return trip ? deriveSafetyTripStatus(trip, now) : null
  },
}))
