import { storage } from './storage'
import type { PrivacyLockConfig } from '../types'

export const PRIVACY_LOCK_KEY = 'safety_v2_privacy_lock'

export async function loadPrivacyLockConfig(): Promise<PrivacyLockConfig | null> {
  return storage.getJson<PrivacyLockConfig>(PRIVACY_LOCK_KEY)
}

export async function savePrivacyLockConfig(config: PrivacyLockConfig): Promise<void> {
  await storage.setJson(PRIVACY_LOCK_KEY, config)
}
