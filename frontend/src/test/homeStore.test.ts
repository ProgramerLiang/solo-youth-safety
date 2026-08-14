import { beforeEach, describe, expect, it } from 'vitest'
import { useHomeStore } from '../stores/useHomeStore'
import { HOME_SLOT_CANDIDATES, type HomeSlotKey } from '../types/home'

beforeEach(() => { localStorage.clear() })

describe('useHomeStore', () => {
  it('HOME_SLOT_CANDIDATES includes the seven slot types', () => {
    expect(HOME_SLOT_CANDIDATES.map((c) => c.key)).toEqual<HomeSlotKey[]>([
      'safetyTrip', 'contacts', 'trackingFreshness', 'smartRisk',
      'recentSos', 'geofence', 'membership',
    ])
  })

  it('setSlot replaces the slot at the given index without touching others', () => {
    useHomeStore.setState({ slots: ['safetyTrip', 'contacts', 'trackingFreshness', 'smartRisk'] })
    useHomeStore.getState().setSlot(1, 'recentSos')
    expect(useHomeStore.getState().slots).toEqual(['safetyTrip', 'recentSos', 'trackingFreshness', 'smartRisk'])
  })

  it('setCompanionEnabled toggles the flag', () => {
    useHomeStore.setState({ companionEnabled: true })
    useHomeStore.getState().setCompanionEnabled(false)
    expect(useHomeStore.getState().companionEnabled).toBe(false)
  })

  it('initialize loads persisted state from storage', async () => {
    localStorage.setItem('safety_v2_home', JSON.stringify({
      slots: ['recentSos', 'geofence', 'smartRisk', 'membership'],
      companionEnabled: false,
    }))
    useHomeStore.setState({ slots: [], companionEnabled: true, loaded: false })
    await useHomeStore.getState().initialize()
    expect(useHomeStore.getState().slots).toEqual(['recentSos', 'geofence', 'smartRisk', 'membership'])
    expect(useHomeStore.getState().companionEnabled).toBe(false)
    expect(useHomeStore.getState().loaded).toBe(true)
  })
})