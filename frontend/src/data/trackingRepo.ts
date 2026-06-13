import { storage } from './storage'
import type { TrackingSnapshot } from '../types'

export const TRACKING_STATE_KEY = 'safety_v2_tracking_state'

export async function loadTrackingState(): Promise<TrackingSnapshot | null> {
  return storage.getJson<TrackingSnapshot>(TRACKING_STATE_KEY)
}

export async function saveTrackingState(snapshot: TrackingSnapshot): Promise<void> {
  await storage.setJson(TRACKING_STATE_KEY, snapshot)
}