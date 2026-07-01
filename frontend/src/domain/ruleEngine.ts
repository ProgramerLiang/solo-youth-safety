import type { AutomationRule, RuleCondition, RuleEvaluationState, RuleSignal } from '../types'

export function evaluateRule(rule: AutomationRule, state: RuleEvaluationState, now?: number): boolean {
  if (!rule.enabled) return false
  if (isRuleOnCooldown(rule, now)) return false
  return rule.conditions.every(cond => evaluateCondition(cond, state))
}

export function isRuleOnCooldown(rule: AutomationRule, now?: number): boolean {
  if (rule.lastFiredAt === null) return false
  const t = now ?? Date.now()
  return (t - rule.lastFiredAt) < rule.cooldownMinutes * 60_000
}

export function evaluateAllRules(
  rules: AutomationRule[],
  state: RuleEvaluationState,
  now?: number,
): AutomationRule[] {
  return rules.filter(rule => evaluateRule(rule, state, now))
}

const RISK_LEVEL_ORDINAL: Record<string, number> = {
  ok: 0,
  attention: 1,
  warning: 2,
}

function compareValues(a: string | number, b: string | number, signal: RuleSignal): number {
  if (signal === 'riskLevel') {
    const ordA = RISK_LEVEL_ORDINAL[String(a)] ?? -1
    const ordB = RISK_LEVEL_ORDINAL[String(b)] ?? -1
    return ordA - ordB
  }
  return Number(a) - Number(b)
}

function evaluateCondition(cond: RuleCondition, state: RuleEvaluationState): boolean {
  const actual = getSignalValue(cond.signal, state)
  if (actual === null || actual === undefined) return false

  switch (cond.operator) {
    case 'eq': return String(actual) === String(cond.value)
    case 'gte': return compareValues(actual, cond.value, cond.signal) >= 0
    case 'gt': return compareValues(actual, cond.value, cond.signal) > 0
    default: return false
  }
}

function getSignalValue(signal: RuleSignal, state: RuleEvaluationState): string | number | null {
  switch (signal) {
    case 'riskLevel': return state.riskLevel
    case 'tripStatus': return state.tripStatus
    case 'tripOvertimeMinutes': return state.tripOvertimeMinutes
    case 'stationaryMinutes': return state.stationaryMinutes
    case 'geofenceEvent':
      return state.latestGeofenceEvent ? `${state.latestGeofenceEvent.type}:${state.latestGeofenceEvent.zoneName}` : null
  }
}
