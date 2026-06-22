import { create } from 'zustand'
import type { TripPreset } from '../types'

const STORAGE_KEY = 'safety_v2_trip_presets'

interface TripPresetState {
  presets: TripPreset[]
  loaded: boolean

  initialize: () => Promise<void>
  list: () => TripPreset[]
  add: (destination: string, durationMinutes: number) => Promise<void>
  update: (id: string, updates: Partial<Omit<TripPreset, 'id'>>) => Promise<void>
  remove: (id: string) => Promise<void>
}

function makeId(): string {
  return `preset_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`
}

async function loadPresets(): Promise<TripPreset[]> {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

async function savePresets(presets: TripPreset[]): Promise<void> {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(presets))
}

export const useTripPresetStore = create<TripPresetState>((set, get) => ({
  presets: [],
  loaded: false,

  initialize: async () => {
    const presets = await loadPresets()
    set({ presets, loaded: true })
  },

  list: () => get().presets,

  add: async (destination, durationMinutes) => {
    const newPreset: TripPreset = {
      id: makeId(),
      destination,
      durationMinutes,
    }
    const presets = [...get().presets, newPreset]
    await savePresets(presets)
    set({ presets })
  },

  update: async (id, updates) => {
    const presets = get().presets.map((p) =>
      p.id === id ? { ...p, ...updates } : p
    )
    await savePresets(presets)
    set({ presets })
  },

  remove: async (id) => {
    const presets = get().presets.filter((p) => p.id !== id)
    await savePresets(presets)
    set({ presets })
  },
}))
