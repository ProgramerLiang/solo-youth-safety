import { beforeEach, describe, expect, it } from 'vitest'
import { DEFAULT_RISK_RULE_CONFIG } from '../domain/riskRules'
import { loadRiskRuleConfig, saveRiskRuleConfig } from '../data/riskRuleRepo'

beforeEach(() => {
  localStorage.clear()
})

describe('risk rule config persistence', () => {
  it('returns defaults when no config is saved', async () => {
    await expect(loadRiskRuleConfig()).resolves.toEqual(DEFAULT_RISK_RULE_CONFIG)
  })

  it('persists risk rule config changes', async () => {
    await saveRiskRuleConfig({
      ...DEFAULT_RISK_RULE_CONFIG,
      longGap: { ...DEFAULT_RISK_RULE_CONFIG.longGap, maxGapMinutes: 120 },
      highSpeed: { ...DEFAULT_RISK_RULE_CONFIG.highSpeed, enabled: false },
    })

    const loaded = await loadRiskRuleConfig()

    expect(loaded.longGap.maxGapMinutes).toBe(120)
    expect(loaded.highSpeed.enabled).toBe(false)
  })
})
