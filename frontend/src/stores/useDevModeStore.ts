import { create } from 'zustand'
import { loadDevMode, saveDevMode } from '../data/devModeRepo'

interface DevModeState {
  enabled: boolean
  tapProgress: number
  loaded: boolean
  initialize: () => Promise<void>
  tap: () => void
  setEnabled: (enabled: boolean) => Promise<void>
  toggle: () => Promise<void>
}

const TAPS_REQUIRED = 7

export const useDevModeStore = create<DevModeState>((set, get) => ({
  enabled: false,
  tapProgress: 0,
  loaded: false,

  initialize: async () => {
    const stored = await loadDevMode()
    if (stored) {
      set({ enabled: stored.enabled, loaded: true })
    } else {
      set({ loaded: true })
    }
  },

  tap: () => {
    const next = get().tapProgress + 1
    if (next >= TAPS_REQUIRED) {
      set({ enabled: true, tapProgress: 0 })
      saveDevMode({ enabled: true })
    } else {
      set({ tapProgress: next })
    }
  },

  setEnabled: async (enabled) => {
    await saveDevMode({ enabled })
    set({ enabled })
  },

  toggle: async () => {
    const next = !get().enabled
    await saveDevMode({ enabled: next })
    set({ enabled: next })
  },
}))