import { create } from 'zustand'
import type { NotificationConfig } from '../domain/notificationChannels'
import { DEFAULT_NOTIFICATION_CONFIG, mergeNotificationConfig } from '../domain/notificationChannels'
import { loadNotificationConfig, saveNotificationConfig } from '../data/notificationConfigRepo'

interface NotificationConfigState {
  config: NotificationConfig | null
  loaded: boolean
  setConfig: (config: NotificationConfig | null) => void
  initialize: () => Promise<void>
  updateEnabled: (enabled: boolean) => Promise<void>
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
    if (get().loaded) return
    set({ config: mergeNotificationConfig(saved), loaded: true })
  },

  updateEnabled: async (enabled) => {
    const current = get().config ?? DEFAULT_NOTIFICATION_CONFIG
    const updated: NotificationConfig = { ...current, enabled }
    set({ config: updated, loaded: true })
    await saveNotificationConfig(updated)
  },

  updateTripExpiryEnabled: async (enabled) => {
    const current = get().config ?? DEFAULT_NOTIFICATION_CONFIG
    const updated: NotificationConfig = {
      ...current,
      tripExpiring: { ...current.tripExpiring, enabled },
    }
    set({ config: updated, loaded: true })
    await saveNotificationConfig(updated)
  },

  updateTripExpiryLeadMinutes: async (minutes) => {
    const current = get().config ?? DEFAULT_NOTIFICATION_CONFIG
    const updated: NotificationConfig = {
      ...current,
      tripExpiring: { ...current.tripExpiring, leadMinutes: minutes },
    }
    set({ config: updated, loaded: true })
    await saveNotificationConfig(updated)
  },

  updateRiskElevatedEnabled: async (enabled) => {
    const current = get().config ?? DEFAULT_NOTIFICATION_CONFIG
    const updated: NotificationConfig = {
      ...current,
      riskElevated: { ...current.riskElevated, enabled },
    }
    set({ config: updated, loaded: true })
    await saveNotificationConfig(updated)
  },
}))