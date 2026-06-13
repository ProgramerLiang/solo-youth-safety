import { storage } from './storage'
import type { AppConfig } from '../types'

export const CONFIG_KEY = 'safety_v2_config'

export async function loadConfig(): Promise<AppConfig | null> {
  return storage.getJson<AppConfig>(CONFIG_KEY)
}

export async function saveConfig(config: AppConfig): Promise<void> {
  await storage.setJson(CONFIG_KEY, config)
}