import { create } from 'zustand'
import { loadGeofenceZones, saveGeofenceZones } from '../data/geofenceRepo'
import type { GeofenceZone } from '../domain/geofence'

interface GeofenceState {
  zones: GeofenceZone[]
  loaded: boolean

  initialize: () => Promise<void>
  addZone: (zone: GeofenceZone) => Promise<void>
  removeZone: (id: string) => Promise<void>
  updateZone: (zone: GeofenceZone) => Promise<void>
}

function nextId(zones: GeofenceZone[]): string {
  let max = 0
  for (const z of zones) {
    const m = z.id.match(/^zf-(\d+)$/)
    if (m) max = Math.max(max, parseInt(m[1]!, 10))
  }
  return `zf-${max + 1}`
}

export const useGeofenceStore = create<GeofenceState>((set, get) => ({
  zones: [],
  loaded: false,

  initialize: async () => {
    const data = await loadGeofenceZones()
    set({ zones: data, loaded: true })
  },

  addZone: async (zone) => {
    const { zones } = get()
    const id = zone.id || nextId(zones)
    const newZones = [...zones, { ...zone, id }]
    await saveGeofenceZones(newZones)
    set({ zones: newZones })
  },

  removeZone: async (id) => {
    const newZones = get().zones.filter((z) => z.id !== id)
    await saveGeofenceZones(newZones)
    set({ zones: newZones })
  },

  updateZone: async (zone) => {
    const newZones = get().zones.map((z) => (z.id === zone.id ? zone : z))
    await saveGeofenceZones(newZones)
    set({ zones: newZones })
  },
}))