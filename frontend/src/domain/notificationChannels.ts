export type NotificationType = 'tripExpiring' | 'riskElevated'

export interface TripExpiringConfig {
  enabled: boolean
  leadMinutes: 1 | 5 | 10 | 15
}

export interface RiskElevatedConfig {
  enabled: boolean
}

export interface NotificationConfig {
  enabled: boolean
  tripExpiring: TripExpiringConfig
  riskElevated: RiskElevatedConfig
}

export const DEFAULT_NOTIFICATION_CONFIG: NotificationConfig = {
  enabled: true,
  tripExpiring: {
    enabled: true,
    leadMinutes: 5,
  },
  riskElevated: {
    enabled: true,
  },
}

export function mergeNotificationConfig(saved: Partial<NotificationConfig> | null | undefined): NotificationConfig {
  if (!saved) return { ...DEFAULT_NOTIFICATION_CONFIG }
  return {
    enabled: saved.enabled ?? DEFAULT_NOTIFICATION_CONFIG.enabled,
    tripExpiring: {
      enabled: saved.tripExpiring?.enabled ?? DEFAULT_NOTIFICATION_CONFIG.tripExpiring.enabled,
      leadMinutes: saved.tripExpiring?.leadMinutes ?? DEFAULT_NOTIFICATION_CONFIG.tripExpiring.leadMinutes,
    },
    riskElevated: {
      enabled: saved.riskElevated?.enabled ?? DEFAULT_NOTIFICATION_CONFIG.riskElevated.enabled,
    },
  }
}