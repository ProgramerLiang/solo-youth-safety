import { LocalNotifications } from '@capacitor/local-notifications'
import type { SafetyTrip } from '../domain/safetyTrip'

type PermissionResult = 'granted' | 'denied' | 'prompt'

const LAST_RISK_NOTIFICATION_AT_KEY = 'safety_v2_last_risk_notification_at'
const RISK_NOTIFICATION_COOLDOWN_MS = 30 * 60_000

export async function requestNotificationPermission(): Promise<PermissionResult> {
  try {
    const result = await LocalNotifications.requestPermissions()
    return result.display as PermissionResult
  } catch {
    return 'denied'
  }
}

export async function scheduleTripExpiryNotification(trip: SafetyTrip, leadMinutes: number): Promise<string> {
  const scheduleAt = new Date(new Date(trip.expectedArrivalAt).getTime() - leadMinutes * 60_000).getTime()
  if (scheduleAt <= Date.now()) return ''

  try {
    const result = await LocalNotifications.schedule({
      notifications: [
        {
          title: '安全行程即将超时',
          body: `${trip.destination} 预计 ${formatTime(trip.expectedArrivalAt)} 到达，请确认安全。仅本地提醒，不自动报警。`,
          schedule: { at: new Date(scheduleAt) },
          id: generateNumericId(),
        },
      ],
    })
    const numericId = result.notifications?.[0]?.id
    return numericId != null ? `trip-expiry-${numericId}` : ''
  } catch {
    return ''
  }
}

export async function scheduleRiskNotification(): Promise<string> {
  const now = Date.now()
  const lastScheduledAt = loadLastRiskNotificationAt()
  if (lastScheduledAt !== null && now - lastScheduledAt < RISK_NOTIFICATION_COOLDOWN_MS) return ''

  try {
    const result = await LocalNotifications.schedule({
      notifications: [
        {
          title: '安全提示',
          body: '检测到新的本地安全提示，请查看总览页。仅本地提醒，不自动报警。',
          schedule: { at: new Date(now + 5000) },
          id: generateNumericId(),
        },
      ],
    })
    const numericId = result.notifications?.[0]?.id
    if (numericId == null) return ''
    saveLastRiskNotificationAt(now)
    return `risk-elevated-${numericId}`
  } catch {
    return ''
  }
}

function loadLastRiskNotificationAt(): number | null {
  try {
    if (typeof localStorage === 'undefined') return null
    const raw = localStorage.getItem(LAST_RISK_NOTIFICATION_AT_KEY)
    if (!raw) return null
    const parsed = Number(raw)
    return Number.isFinite(parsed) ? parsed : null
  } catch {
    return null
  }
}

function saveLastRiskNotificationAt(timestampMs: number): void {
  try {
    if (typeof localStorage === 'undefined') return
    localStorage.setItem(LAST_RISK_NOTIFICATION_AT_KEY, String(timestampMs))
  } catch {
    // silent
  }
}

export async function cancelNotification(notificationId: string): Promise<void> {
  const parts = notificationId.split('-')
  const idPart = parts[parts.length - 1]
  if (!idPart) return
  const numericId = parseInt(idPart, 10)
  if (isNaN(numericId)) return
  try {
    await LocalNotifications.cancel({ notifications: [{ id: numericId }] })
  } catch {
    // silent
  }
}

export async function cancelAllTripNotifications(): Promise<void> {
  try {
    const pending = await LocalNotifications.getPending()
    if (pending.notifications.length > 0) {
      await LocalNotifications.cancel({ notifications: pending.notifications })
    }
  } catch {
    // silent
  }
}

let _counter = Date.now() % 100000

function generateNumericId(): number {
  return ++_counter
}

function formatTime(iso: string): string {
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}