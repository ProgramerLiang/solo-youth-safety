import { describe, expect, it, beforeEach } from 'vitest'
import { useNotificationConfigStore } from '../stores/useNotificationConfigStore'
import type { NotificationConfig } from '../domain/notificationChannels'

beforeEach(() => {
  useNotificationConfigStore.setState({ config: null, loaded: false })
  localStorage.clear()
})

describe('useNotificationConfigStore', () => {
  it('starts with unloaded state', () => {
    const state = useNotificationConfigStore.getState()
    expect(state.loaded).toBe(false)
    expect(state.config).toBeNull()
  })

  it('setConfig updates config and loaded', () => {
    const store = useNotificationConfigStore.getState()
    const cfg: NotificationConfig = {
      enabled: false,
      tripExpiring: { enabled: true, leadMinutes: 10 },
      riskElevated: { enabled: true },
    }
    store.setConfig(cfg)
    const updated = useNotificationConfigStore.getState()
    expect(updated.loaded).toBe(true)
    expect(updated.config).toEqual(cfg)
  })

  it('setConfig with null sets loaded true but config null', () => {
    const store = useNotificationConfigStore.getState()
    store.setConfig(null)
    const updated = useNotificationConfigStore.getState()
    expect(updated.loaded).toBe(true)
    expect(updated.config).toBeNull()
  })

  it('initialize loads saved config from localStorage', async () => {
    const cfg: NotificationConfig = {
      enabled: false,
      tripExpiring: { enabled: false, leadMinutes: 1 },
      riskElevated: { enabled: false },
    }
    localStorage.setItem('safety_v2_notification_config', JSON.stringify(cfg))
    await useNotificationConfigStore.getState().initialize()
    const state = useNotificationConfigStore.getState()
    expect(state.loaded).toBe(true)
    expect(state.config?.enabled).toBe(false)
    expect(state.config?.tripExpiring.leadMinutes).toBe(1)
  })

  it('updateTripExpiryEnabled persists and updates state', async () => {
    await useNotificationConfigStore.getState().initialize()
    await useNotificationConfigStore.getState().updateTripExpiryEnabled(false)
    const state = useNotificationConfigStore.getState()
    expect(state.config?.tripExpiring.enabled).toBe(false)
    const saved = JSON.parse(localStorage.getItem('safety_v2_notification_config')!)
    expect(saved.tripExpiring.enabled).toBe(false)
  })

  it('updateRiskElevatedEnabled persists and updates state', async () => {
    await useNotificationConfigStore.getState().initialize()
    await useNotificationConfigStore.getState().updateRiskElevatedEnabled(false)
    const state = useNotificationConfigStore.getState()
    expect(state.config?.riskElevated.enabled).toBe(false)
    const saved = JSON.parse(localStorage.getItem('safety_v2_notification_config')!)
    expect(saved.riskElevated.enabled).toBe(false)
  })
})