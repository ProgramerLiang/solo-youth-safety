import { describe, expect, it } from 'vitest'
import { evaluateRule, isRuleOnCooldown, evaluateAllRules } from '../domain/ruleEngine'
import type { AutomationRule, RuleEvaluationState, RuleCondition } from '../types'

function sampleRule(overrides: Partial<AutomationRule> = {}): AutomationRule {
  return {
    id: 'rule-1',
    name: '测试规则',
    enabled: true,
    conditions: [{ signal: 'riskLevel', operator: 'gte', value: 'attention', label: '风险 ≥ attention' }],
    actions: [{ type: 'localNotification', config: { title: '通知', body: '触发' }, label: '通知' }],
    cooldownMinutes: 5,
    lastFiredAt: null,
    ...overrides,
  }
}

function sampleState(overrides: Partial<RuleEvaluationState> = {}): RuleEvaluationState {
  return {
    riskLevel: 'ok',
    tripStatus: null,
    tripOvertimeMinutes: null,
    latestGeofenceEvent: null,
    stationaryMinutes: null,
    ...overrides,
  }
}

describe('evaluateRule', () => {
  it('returns true when riskLevel condition matches', () => {
    const rule = sampleRule()
    const state = sampleState({ riskLevel: 'attention' })
    expect(evaluateRule(rule, state)).toBe(true)
  })

  it('returns false when riskLevel condition does not match', () => {
    const rule = sampleRule()
    const state = sampleState({ riskLevel: 'ok' })
    expect(evaluateRule(rule, state)).toBe(false)
  })

  it('returns false when rule is disabled', () => {
    const rule = sampleRule({ enabled: false })
    const state = sampleState({ riskLevel: 'attention' })
    expect(evaluateRule(rule, state)).toBe(false)
  })

  it('returns false when rule is on cooldown', () => {
    const now = 100_000
    const rule = sampleRule({ lastFiredAt: now - 60_000 })  // 1 min ago, cooldown is 5 min
    const state = sampleState({ riskLevel: 'attention' })
    expect(evaluateRule(rule, state, now)).toBe(false)
  })

  it('returns true when cooldown has elapsed', () => {
    const now = 100_000
    const rule = sampleRule({ lastFiredAt: now - 10 * 60_000 })  // 10 min ago, cooldown is 5 min
    const state = sampleState({ riskLevel: 'attention' })
    expect(evaluateRule(rule, state, now)).toBe(true)
  })

  it('returns true when all AND conditions are met', () => {
    const conditions: RuleCondition[] = [
      { signal: 'riskLevel', operator: 'gte', value: 'attention', label: '风险 ≥ attention' },
      { signal: 'tripStatus', operator: 'eq', value: 'overtime', label: '行程 = 超时' },
    ]
    const rule = sampleRule({ conditions })
    const state = sampleState({ riskLevel: 'warning', tripStatus: 'overtime' })
    expect(evaluateRule(rule, state)).toBe(true)
  })

  it('returns false when any AND condition is not met', () => {
    const conditions: RuleCondition[] = [
      { signal: 'riskLevel', operator: 'gte', value: 'attention', label: '风险 ≥ attention' },
      { signal: 'tripStatus', operator: 'eq', value: 'overtime', label: '行程 = 超时' },
    ]
    const rule = sampleRule({ conditions })
    const state = sampleState({ riskLevel: 'attention', tripStatus: 'arrived' })
    expect(evaluateRule(rule, state)).toBe(false)
  })

  it('evaluates tripOvertimeMinutes with gt operator', () => {
    const conditions: RuleCondition[] = [
      { signal: 'tripOvertimeMinutes', operator: 'gt', value: 10, label: '超时 > 10 分钟' },
    ]
    const rule = sampleRule({ conditions })
    expect(evaluateRule(rule, sampleState({ tripOvertimeMinutes: 15 }))).toBe(true)
    expect(evaluateRule(rule, sampleState({ tripOvertimeMinutes: 5 }))).toBe(false)
    expect(evaluateRule(rule, sampleState({ tripOvertimeMinutes: 10 }))).toBe(false) // gt, not gte
  })

  it('evaluates stationaryMinutes with gte operator', () => {
    const conditions: RuleCondition[] = [
      { signal: 'stationaryMinutes', operator: 'gte', value: 30, label: '静止 ≥ 30 分钟' },
    ]
    const rule = sampleRule({ conditions })
    expect(evaluateRule(rule, sampleState({ stationaryMinutes: 30 }))).toBe(true)
    expect(evaluateRule(rule, sampleState({ stationaryMinutes: 45 }))).toBe(true)
    expect(evaluateRule(rule, sampleState({ stationaryMinutes: 15 }))).toBe(false)
  })

  it('evaluates geofenceEvent condition', () => {
    const conditions: RuleCondition[] = [
      { signal: 'geofenceEvent', operator: 'eq', value: 'entered:火车站周边', label: '进入火车站周边' },
    ]
    const rule = sampleRule({ conditions })
    const state = sampleState({ latestGeofenceEvent: { type: 'entered', zoneName: '火车站周边' } })
    expect(evaluateRule(rule, state)).toBe(true)

    const state2 = sampleState({ latestGeofenceEvent: { type: 'left', zoneName: '火车站周边' } })
    expect(evaluateRule(rule, state2)).toBe(false)
  })

  it('returns false when signal source is null', () => {
    const conditions: RuleCondition[] = [
      { signal: 'tripStatus', operator: 'eq', value: 'overtime', label: '行程 = 超时' },
    ]
    const rule = sampleRule({ conditions })
    expect(evaluateRule(rule, sampleState({ tripStatus: null }))).toBe(false)
  })
})

describe('isRuleOnCooldown', () => {
  it('returns false when lastFiredAt is null', () => {
    expect(isRuleOnCooldown(sampleRule({ lastFiredAt: null }), 100_000)).toBe(false)
  })

  it('returns true within cooldown period', () => {
    const now = 100_000
    expect(isRuleOnCooldown(sampleRule({ lastFiredAt: now - 60_000 }), now)).toBe(true)  // 1 min
    expect(isRuleOnCooldown(sampleRule({ lastFiredAt: now - 4 * 60_000 }), now)).toBe(true)  // 4 min
  })

  it('returns false after cooldown period', () => {
    const now = 100_000
    expect(isRuleOnCooldown(sampleRule({ lastFiredAt: now - 5 * 60_000 }), now)).toBe(false)  // exactly 5 min
    expect(isRuleOnCooldown(sampleRule({ lastFiredAt: now - 10 * 60_000 }), now)).toBe(false)  // 10 min
  })
})

describe('evaluateAllRules', () => {
  it('returns only matching rules', () => {
    const rule1 = sampleRule({ id: 'r1', conditions: [{ signal: 'riskLevel', operator: 'gte', value: 'attention', label: '' }] })
    const rule2 = sampleRule({ id: 'r2', conditions: [{ signal: 'tripStatus', operator: 'eq', value: 'overtime', label: '' }] })
    const state = sampleState({ riskLevel: 'attention', tripStatus: 'arrived' })
    expect(evaluateAllRules([rule1, rule2], state).map(r => r.id)).toEqual(['r1'])
  })

  it('returns empty when no rules match', () => {
    const rule = sampleRule({ conditions: [{ signal: 'riskLevel', operator: 'gte', value: 'warning', label: '' }] })
    expect(evaluateAllRules([rule], sampleState({ riskLevel: 'ok' }))).toEqual([])
  })

  it('returns empty array for empty rules input', () => {
    expect(evaluateAllRules([], sampleState())).toEqual([])
  })
})
