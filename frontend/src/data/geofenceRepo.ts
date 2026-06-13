import { storage } from './storage'
import type { GeofenceZone } from '../domain/geofence'

export const GEOFENCE_KEY = 'safety_v2_geofence'

export async function loadGeofenceZones(): Promise<GeofenceZone[]> {
  return (await storage.getJson<GeofenceZone[]>(GEOFENCE_KEY)) ?? []
}

export async function saveGeofenceZones(zones: GeofenceZone[]): Promise<void> {
  await storage.setJson(GEOFENCE_KEY, zones)
}