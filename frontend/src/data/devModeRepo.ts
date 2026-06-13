import { storage } from './storage'

export const DEV_MODE_KEY = 'safety_v2_devmode'

export async function loadDevMode(): Promise<{ enabled: boolean } | null> {
  return storage.getJson<{ enabled: boolean }>(DEV_MODE_KEY)
}

export async function saveDevMode(data: { enabled: boolean }): Promise<void> {
  await storage.setJson(DEV_MODE_KEY, data)
}