import { Capacitor } from '@capacitor/core'
import { Preferences } from '@capacitor/preferences'

const isNative = Capacitor.isNativePlatform()

export const storage = {
  async get(key: string): Promise<string | null> {
    if (isNative) {
      const result = await Preferences.get({ key })
      return result.value ?? null
    }
    return localStorage.getItem(key)
  },

  async set(key: string, value: string): Promise<void> {
    if (isNative) {
      await Preferences.set({ key, value })
    } else {
      localStorage.setItem(key, value)
    }
  },

  async remove(key: string): Promise<void> {
    if (isNative) {
      await Preferences.remove({ key })
    } else {
      localStorage.removeItem(key)
    }
  },

  async clear(): Promise<void> {
    if (isNative) {
      return
    }
    localStorage.clear()
  },

  async getJson<T>(key: string): Promise<T | null> {
    const raw = await this.get(key)
    if (!raw) return null
    try {
      return JSON.parse(raw) as T
    } catch {
      return null
    }
  },

  async setJson(key: string, value: unknown): Promise<void> {
    await this.set(key, JSON.stringify(value))
  },
}

export function getStorageDriverLabel(): string {
  return isNative ? 'Capacitor Preferences (Native)' : 'localStorage (Web)'
}

const V1_TO_V2_KEYS: Record<string, string> = {
  safety_theme_preferences_v1: 'safety_v2_theme_prefs',
  safety_emergency_config_v1: 'safety_v2_config',
  safety_onboarding_done_v1: 'safety_v2_onboarding',
  safety_developer_mode_v1: 'safety_v2_devmode',
  safety_identity_v1: 'safety_v2_identity',
  safety_tracking_state_v1: 'safety_v2_tracking',
  safety_local_backend_v1: 'safety_v2_backend_mode',
}

export async function migrateV1ToV2(): Promise<boolean> {
  let migrated = false
  for (const [v1Key, v2Key] of Object.entries(V1_TO_V2_KEYS)) {
    const existing = await storage.get(v2Key)
    if (existing !== null) continue

    const v1Value = await storage.get(v1Key)
    if (v1Value !== null) {
      await storage.set(v2Key, v1Value)
      migrated = true
    }
  }
  return migrated
}