import type { NotificationConfig } from '../domain/notificationChannels'

const STORAGE_KEY = 'safety_v2_notification_config'

export async function loadNotificationConfig(): Promise<NotificationConfig | null> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as NotificationConfig
  } catch {
    return null
  }
}

export async function saveNotificationConfig(config: NotificationConfig): Promise<void> {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config))
  } catch {
    // storage full or unavailable — silent
  }
}