import { describe, expect, it, beforeEach, vi } from 'vitest'
import { useRuleEngineStore } from '../stores/useRuleEngineStore'
import { RULES_STORAGE_KEY } from '../data/ruleEngineRepo'
import type { AutomationRule, RuleEvaluationState } from '../types'

vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => false },
  registerPlugin: () => ({}),
}))

vi.mock('@capacitor/local-notifications', () => ({
  LocalNotifications: {
    schedule: () => Promise.resolve({ notifications: [{ id: 1 }] }),
    requestPermissions: () => Promise.resolve({ display: 'granted' }),
    cancel: () => Promise.resolve(),
  },
}))

function sampleRule(overrides: Partial<AutomationRule> = {}): AutomationRule {
  return {
    id: 'r1', name: '测试', enabled: true,
    conditions: [{ signal: 'riskLevel', operator: 'gte', value: 'attention', label: '' }],
    actions: [{ type: 'localNotification', config: { title: '通知', body: '触发' }, label: '' }],
    cooldownMinutes: 5, lastFiredAt: null,
    ...overrides,
  }
}

beforeEach(async () => {
  localStorage.clear()
  useRuleEngineStore.setState({ rules: [], loaded: false })
})

describe('useRuleEngineStore', () => {
  it('initialize loads rules from storage', async () => {
    const stored = [sampleRule()]
    localStorage.setItem(RULES_STORAGE_KEY, JSON.stringify(stored))
    await useRuleEngineStore.getState().initialize()
    expect(useRuleEngineStore.getState().rules).toEqual(stored)
    expect(useRuleEngineStore.getState().loaded).toBe(true)
  })

  it('initialize handles empty storage', async () => {
    await useRuleEngineStore.getState().initialize()
    expect(useRuleEngineStore.getState().rules).toEqual([])
    expect(useRuleEngineStore.getState().loaded).toBe(true)
  })

  it('addRule creates new rule with generated id', async () => {
    await useRuleEngineStore.getState().initialize()
    const input: Omit<AutomationRule, 'id' | 'lastFiredAt'> = {
      name: '新规则', enabled: true,
      conditions: [{ signal: 'riskLevel', operator: 'gte', value: 'warning', label: '' }],
      actions: [{ type: 'preArmSos', config: {}, label: '' }],
      cooldownMinutes: 5,
    }
    await useRuleEngineStore.getState().addRule(input)
    const state = useRuleEngineStore.getState()
    expect(state.rules).toHaveLength(1)
    expect(state.rules[0]!.name).toBe('新规则')
    expect(state.rules[0]!.id).toBeTruthy()
    expect(state.rules[0]!.lastFiredAt).toBeNull()
    // Verify persistence
    const stored = JSON.parse(localStorage.getItem(RULES_STORAGE_KEY) ?? '[]')
    expect(stored).toHaveLength(1)
  })

  it('updateRule patches existing rule fields', async () => {
    await useRuleEngineStore.getState().initialize()
    await useRuleEngineStore.getState().addRule({
      name: '旧名', enabled: true,
      conditions: [{ signal: 'riskLevel', operator: 'gte', value: 'attention', label: '' }],
      actions: [{ type: 'localNotification', config: {}, label: '' }],
      cooldownMinutes: 5,
    })
    const id = useRuleEngineStore.getState().rules[0]!.id
    await useRuleEngineStore.getState().updateRule(id, { name: '新名', cooldownMinutes: 15 })
    expect(useRuleEngineStore.getState().rules[0]!.name).toBe('新名')
    expect(useRuleEngineStore.getState().rules[0]!.cooldownMinutes).toBe(15)
  })

  it('deleteRule removes rule by id', async () => {
    await useRuleEngineStore.getState().initialize()
    await useRuleEngineStore.getState().addRule({
      name: '待删除', enabled: true,
      conditions: [{ signal: 'riskLevel', operator: 'gte', value: 'attention', label: '' }],
      actions: [{ type: 'localNotification', config: {}, label: '' }],
      cooldownMinutes: 5,
    })
    const id = useRuleEngineStore.getState().rules[0]!.id
    await useRuleEngineStore.getState().deleteRule(id)
    expect(useRuleEngineStore.getState().rules).toHaveLength(0)
  })

  it('setEnabled toggles rule on/off', async () => {
    await useRuleEngineStore.getState().initialize()
    await useRuleEngineStore.getState().addRule({
      name: '切换测试', enabled: true,
      conditions: [{ signal: 'riskLevel', operator: 'gte', value: 'attention', label: '' }],
      actions: [{ type: 'localNotification', config: {}, label: '' }],
      cooldownMinutes: 5,
    })
    const id = useRuleEngineStore.getState().rules[0]!.id
    await useRuleEngineStore.getState().setEnabled(id, false)
    expect(useRuleEngineStore.getState().rules[0]!.enabled).toBe(false)
    await useRuleEngineStore.getState().setEnabled(id, true)
    expect(useRuleEngineStore.getState().rules[0]!.enabled).toBe(true)
  })

  it('evaluate returns matching rules and updates lastFiredAt', async () => {
    await useRuleEngineStore.getState().initialize()
    await useRuleEngineStore.getState().addRule({
      name: '匹配规则', enabled: true,
      conditions: [{ signal: 'riskLevel', operator: 'gte', value: 'attention', label: '' }],
      actions: [{ type: 'localNotification', config: { title: '通知', body: '触发' }, label: '' }],
      cooldownMinutes: 5,
    })
    const state: RuleEvaluationState = {
      riskLevel: 'warning', tripStatus: null, tripOvertimeMinutes: null,
      latestGeofenceEvent: null, stationaryMinutes: null,
    }
    const fired = useRuleEngineStore.getState().evaluate(state)
    expect(fired).toHaveLength(1)
    expect(fired[0]!.id).toBeTruthy()
    expect(useRuleEngineStore.getState().rules[0]!.lastFiredAt).not.toBeNull()
  })

  it('evaluate does not return rules on cooldown', async () => {
    await useRuleEngineStore.getState().initialize()
    await useRuleEngineStore.getState().addRule({
      name: '冷却测试', enabled: true,
      conditions: [{ signal: 'riskLevel', operator: 'gte', value: 'attention', label: '' }],
      actions: [{ type: 'localNotification', config: { title: '通知', body: '触发' }, label: '' }],
      cooldownMinutes: 5,
    })
    const state: RuleEvaluationState = {
      riskLevel: 'warning', tripStatus: null, tripOvertimeMinutes: null,
      latestGeofenceEvent: null, stationaryMinutes: null,
    }
    const now = Date.now()
    useRuleEngineStore.getState().rules[0]!.lastFiredAt = now - 60_000 // 1 minute ago
    const fired = useRuleEngineStore.getState().evaluate(state, now)
    expect(fired).toHaveLength(0)
  })
})
