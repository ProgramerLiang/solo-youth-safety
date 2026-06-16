import { afterEach, describe, expect, it, vi, beforeEach } from 'vitest'
import type { SafetyTrip } from '../domain/safetyTrip'

// --- mock @capacitor/local-notifications ---
type PermissionResult = { display: 'granted' | 'denied' | 'prompt' }
type ScheduleResult = { notifications: { id: number }[] }
type PendingResult = { notifications: { id: number }[] }

vi.mock('@capacitor/local-notifications', () => ({
  LocalNotifications: {
    requestPermissions: vi.fn<() => Promise<PermissionResult>>(),
    schedule: vi.fn<(_: { notifications: { id?: number; title: string; body: string; schedule: { at: Date } }[] }) => Promise<ScheduleResult>>(),
    cancel: vi.fn<(_: { notifications: { id: number }[] }) => Promise<void>>(),
    getPending: vi.fn<() => Promise<PendingResult>>(),
  },
}))

import { LocalNotifications } from '@capacitor/local-notifications'
import {
  requestNotificationPermission,
  scheduleTripExpiryNotification,
  scheduleRiskNotification,
  cancelNotification,
  cancelAllTripNotifications,
} from '../data/localNotificationRepo'

const trip: SafetyTrip = {
  id: 't1',
  destination: '回宿舍',
  createdAt: '2026-06-15T12:00:00.000Z',
  expectedArrivalAt: '2026-06-15T12:30:00.000Z',
  status: 'active' as const,
  events: [],
}

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('requestNotificationPermission', () => {
  it('returns granted when permission is granted', async () => {
    vi.mocked(LocalNotifications.requestPermissions).mockResolvedValue({ display: 'granted' } as PermissionResult)
    const result = await requestNotificationPermission()
    expect(result).toBe('granted')
  })

  it('returns denied when permission is denied', async () => {
    vi.mocked(LocalNotifications.requestPermissions).mockResolvedValue({ display: 'denied' } as PermissionResult)
    const result = await requestNotificationPermission()
    expect(result).toBe('denied')
  })
})

describe('scheduleTripExpiryNotification', () => {
  it('schedules a notification with correct timing and returns id', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-15T12:00:00.000Z'))
    vi.mocked(LocalNotifications.schedule).mockResolvedValue({ notifications: [{ id: 42 }] } as ScheduleResult)
    const id = await scheduleTripExpiryNotification(trip, 5)
    expect(id).toBe('trip-expiry-42')
    expect(LocalNotifications.schedule).toHaveBeenCalledTimes(1)
    const call = vi.mocked(LocalNotifications.schedule).mock.calls[0]![0]
    expect(call.notifications[0].title).toContain('安全行程')
    expect(call.notifications[0].body).toContain('回宿舍')
    expect(call.notifications[0].body).toContain('仅本地提醒')
  })

  it('does not throw when schedule fails', async () => {
    vi.mocked(LocalNotifications.schedule).mockRejectedValue(new Error('noop'))
    const noDestTrip = { ...trip, destination: '未知' }
    await expect(scheduleTripExpiryNotification(noDestTrip, 5)).resolves.toBe('')
  })
})

describe('scheduleRiskNotification', () => {
  it('schedules a notification with generic risk text', async () => {
    vi.mocked(LocalNotifications.schedule).mockResolvedValue({ notifications: [{ id: 99 }] } as ScheduleResult)
    const id = await scheduleRiskNotification()
    expect(id).toBe('risk-elevated-99')
    expect(LocalNotifications.schedule).toHaveBeenCalledTimes(1)
    const call = vi.mocked(LocalNotifications.schedule).mock.calls[0]![0]
    expect(call.notifications[0].body).toContain('仅本地提醒')
  })

  it('does not schedule another risk notification within 30 minutes', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-15T12:00:00.000Z'))
    vi.mocked(LocalNotifications.schedule).mockResolvedValue({ notifications: [{ id: 100 }] } as ScheduleResult)

    const first = await scheduleRiskNotification()
    const second = await scheduleRiskNotification()

    expect(first).toBe('risk-elevated-100')
    expect(second).toBe('')
    expect(LocalNotifications.schedule).toHaveBeenCalledTimes(1)
  })
})

describe('cancelNotification', () => {
  it('calls LocalNotifications.cancel with parsed id', async () => {
    await cancelNotification('trip-expiry-42')
    expect(LocalNotifications.cancel).toHaveBeenCalledWith({ notifications: [{ id: 42 }] })
  })

  it('does not throw for unknown id format', async () => {
    await cancelNotification('unknown-xxx')
    // Should not throw — just skip
  })
})

describe('cancelAllTripNotifications', () => {
  it('cancels all pending notifications', async () => {
    vi.mocked(LocalNotifications.getPending).mockResolvedValue({ notifications: [{ id: 1 }, { id: 2 }] } as PendingResult)
    await cancelAllTripNotifications()
    expect(LocalNotifications.cancel).toHaveBeenCalledWith({ notifications: [{ id: 1 }, { id: 2 }] })
  })
})