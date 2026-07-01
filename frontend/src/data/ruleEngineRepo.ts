import { storage } from './storage'
import type { AutomationRule } from '../types'

export const RULES_STORAGE_KEY = 'safety_v2_smart_rules'

export async function loadRules(): Promise<AutomationRule[]> {
  const data = await storage.getJson<AutomationRule[]>(RULES_STORAGE_KEY)
  return Array.isArray(data) ? data : []
}

export async function saveRules(rules: AutomationRule[]): Promise<void> {
  await storage.setJson(RULES_STORAGE_KEY, rules)
}
