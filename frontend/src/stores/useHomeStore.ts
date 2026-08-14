import { create } from 'zustand'
import { loadHomeLayout, saveHomeLayout } from '../data/homeRepo'
import { DEFAULT_HOME_SLOTS, type HomeSlotKey } from '../types/home'

interface HomeState {
  slots: HomeSlotKey[]
  companionEnabled: boolean
  loaded: boolean
  initialize: () => Promise<void>
  setSlot: (index: number, key: HomeSlotKey) => void
  setCompanionEnabled: (enabled: boolean) => void
}

export const useHomeStore = create<HomeState>((set, get) => ({
  slots: [...DEFAULT_HOME_SLOTS],
  companionEnabled: true,
  loaded: false,

  initialize: async () => {
    const layout = await loadHomeLayout()
    set({ slots: layout.slots, companionEnabled: layout.companionEnabled, loaded: true })
  },

  setSlot: (index, key) => {
    const slots = [...get().slots]
    if (index < 0 || index >= slots.length) return
    slots[index] = key
    set({ slots })
    void saveHomeLayout({ slots, companionEnabled: get().companionEnabled })
  },

  setCompanionEnabled: (enabled) => {
    set({ companionEnabled: enabled })
    void saveHomeLayout({ slots: get().slots, companionEnabled: enabled })
  },
}))