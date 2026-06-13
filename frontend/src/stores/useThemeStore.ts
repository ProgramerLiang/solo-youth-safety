import { create } from 'zustand'
import type { ThemeMode, PaletteMode, DynamicColorInfo } from '../types'
import { loadThemePrefs, saveThemePrefs } from '../data/themeRepo'
import type { ThemePrefs } from '../data/themeRepo'

interface ThemeState {
  mode: ThemeMode
  paletteMode: PaletteMode
  presetId: string | null
  customSeed: string | null
  dynamicInfo: DynamicColorInfo | null
  initialized: boolean
  initialize: () => Promise<void>
  setMode: (mode: ThemeMode) => void
  setPaletteMode: (paletteMode: PaletteMode) => void
  setPresetId: (presetId: string | null) => void
  setCustomSeed: (customSeed: string | null) => void
  loadDynamic: (info: DynamicColorInfo) => void
  persist: () => Promise<void>
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  mode: 'auto',
  paletteMode: 'dynamic',
  presetId: 'purple',
  customSeed: null,
  dynamicInfo: null,
  initialized: false,

  initialize: async () => {
    const prefs = await loadThemePrefs()
    if (prefs) {
      set({
        mode: prefs.mode,
        paletteMode: prefs.paletteMode,
        presetId: prefs.presetId,
        customSeed: prefs.customSeed,
        dynamicInfo: prefs.dynamicInfo,
        initialized: true,
      })
    } else {
      set({ initialized: true })
    }
  },

  setMode: (mode) => {
    set({ mode })
    get().persist()
  },

  setPaletteMode: (paletteMode) => {
    const extra: Partial<ThemeState> = {}
    if (paletteMode === 'dynamic') {
      extra.presetId = null
      extra.customSeed = null
    } else if (paletteMode === 'preset') {
      extra.dynamicInfo = null
      extra.customSeed = null
    } else if (paletteMode === 'custom') {
      extra.dynamicInfo = null
      extra.presetId = null
    }
    set({ paletteMode, ...extra })
    get().persist()
  },

  setPresetId: (presetId) => {
    set({ presetId })
    get().persist()
  },

  setCustomSeed: (customSeed) => {
    set({ customSeed })
    get().persist()
  },

  loadDynamic: (dynamicInfo) => {
    set({ dynamicInfo, paletteMode: 'dynamic' })
    get().persist()
  },

  persist: async () => {
    const { mode, paletteMode, presetId, customSeed, dynamicInfo } = get()
    await saveThemePrefs({ mode, paletteMode, presetId, customSeed, dynamicInfo } as ThemePrefs)
  },
}))