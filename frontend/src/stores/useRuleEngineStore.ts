import { useSosStore } from './useSosStore'
import { scheduleRuleNotification } from '../data/localNotificationRepo'
import { create } from 'zustand'
import { loadRules, saveRules } from '../data/ruleEngineRepo'
import { evaluateAllRules } from '../domain/ruleEngine'
import type { AutomationRule, RuleEvaluationState } from '../types'

interface RuleEngineState {
  rules: AutomationRule[]
  loaded: boolean
  initialize: () => Promise<void>
  addRule: (input: Omit<AutomationRule, 'id' | 'lastFiredAt'>) => Promise<void>
  updateRule: (id: string, updates: Partial<AutomationRule>) => Promise<void>
  deleteRule: (id: string) => Promise<void>
  setEnabled: (id: string, enabled: boolean) => Promise<void>
  evaluate: (state: RuleEvaluationState, now?: number) => AutomationRule[]
}

let nextIdCounter = 0
function generateId(): string {
  nextIdCounter++
  return `rule-${Date.now()}-${nextIdCounter}`
}

export const useRuleEngineStore = create<RuleEngineState>((set, get) => ({
  rules: [],
  loaded: false,

  initialize: async () => {
    const rules = await loadRules()
    set({ rules, loaded: true })
  },

  addRule: async (input) => {
    const newRule: AutomationRule = {
      ...input,
      id: generateId(),
      lastFiredAt: null,
    }
    const rules = [...get().rules, newRule]
    await saveRules(rules)
    set({ rules })
  },

  updateRule: async (id, updates) => {
    const rules = get().rules.map(r => r.id === id ? { ...r, ...updates } : r)
    await saveRules(rules)
    set({ rules })
  },

  deleteRule: async (id) => {
    const rules = get().rules.filter(r => r.id !== id)
    await saveRules(rules)
    set({ rules })
  },

  setEnabled: async (id, enabled) => {
    await get().updateRule(id, { enabled })
  },

  evaluate: (state, now) => {
    const now_ = now ?? Date.now()
    const rules = get().rules
    const fired = evaluateAllRules(rules, state, now_)
    if (fired.length > 0) {
      // Update lastFiredAt for fired rules
      const updated = rules.map(r =>
        fired.some(f => f.id === r.id) ? { ...r, lastFiredAt: now_ } : r,
      )
      // Fire and forget persist
      saveRules(updated)
      set({ rules: updated })
    }
    // Process actions for each fired rule
    for (const rule of fired) {
      for (const action of rule.actions) {
        if (action.type === 'localNotification') {
          const title = action.config.title ?? '规则提醒'
          const bodyText = action.config.body ?? '规则已触发'
          scheduleRuleNotification(rule.name, title, bodyText)
        } else if (action.type === 'preArmSos') {
          useSosStore.getState().preArmRule(rule.name)
        }
      }
    }
    return fired
  },
}))
