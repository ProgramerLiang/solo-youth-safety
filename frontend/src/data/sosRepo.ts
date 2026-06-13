import { storage } from './storage'
import type { SosResult } from '../types'

export const SOS_HISTORY_KEY = 'safety_v2_sos_history'

export async function loadSosHistory(): Promise<SosResult[]> {
  return (await storage.getJson<SosResult[]>(SOS_HISTORY_KEY)) ?? []
}

export async function saveSosHistory(history: SosResult[]): Promise<void> {
  await storage.setJson(SOS_HISTORY_KEY, history)
}