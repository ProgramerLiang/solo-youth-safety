import { create } from 'zustand'
import type { NotificationConfig } from '../domain/notificationChannels'
import { DEFAULT_NOTIFICATION_CONFIG, mergeNotificationConfig } from '../domain/notificationChannels'
import { loadNotificationConfig, saveNotificationConfig } from '../data/notificationConfigRepo'

interface NotificationConfigState {
  config: NotificationConfig | null
  loaded: boolean
  setConfig: (config: NotificationConfig | null) => void
  initialize: () => Promise<void>
  updateTripExpiryEnabled: (enabled: boolean) => Promise<void>
  updateTripExpiryLeadMinutes: (minutes: 1 | 5 | 10 | 15) => Promise<void>
  updateRiskElevatedEnabled: (enabled: boolean) => Promise<void>
}

export const useNotificationConfigStore = create<NotificationConfigState>((set, get) => ({
  config: null,
  loaded: false,

  setConfig: (config) => set({ config, loaded: true }),

  initialize: async () => {
    const saved = await loadNotificationConfig()
    set({ config: mergeNotificationConfig(saved), loaded: true })
  },

  updateTripExpiryEnabled: async (enabled) => {
    const current = get().config ?? DEFAULT_NOTIFICATION_CONFIG
    const updated: NotificationConfig = {
      ...current,
      tripExpiring: { ...current.tripExpiring, enabled },
    }
    await saveNotificationConfig(updated)
    set({ config: updated })
  },

  updateTripExpiryLeadMinutes: async (minutes) => {
    const current = get().config ?? DEFAULT_NOTIFICATION_CONFIG
    const updated: NotificationConfig = {
      ...current,
      tripExpiring: { ...current.tripExpiring, leadMinutes: minutes },
    }
    await saveNotificationConfig(updated)
    set({ config: updated })
  },

  updateRiskElevatedEnabled: async (enabled) => {
    const current = get().config ?? DEFAULT_NOTIFICATION_CONFIG
    const updated: NotificationConfig = {
      ...current,
      riskElevated: { ...current.riskElevated, enabled },
    }
    await saveNotificationConfig(updated)
    set({ config: updated })
  },
}))