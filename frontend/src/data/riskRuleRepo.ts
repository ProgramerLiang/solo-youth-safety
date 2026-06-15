import { storage } from './storage'
import { DEFAULT_RISK_RULE_CONFIG, mergeRiskRuleConfig } from '../domain/riskRules'
import type { RiskRuleConfig } from '../domain/riskRules'

export const RISK_RULE_CONFIG_KEY = 'safety_v2_risk_rule_config'

export async function loadRiskRuleConfig(): Promise<RiskRuleConfig> {
  const saved = await storage.getJson<Partial<RiskRuleConfig>>(RISK_RULE_CONFIG_KEY)
  return saved ? mergeRiskRuleConfig(saved) : DEFAULT_RISK_RULE_CONFIG
}

export async function saveRiskRuleConfig(config: RiskRuleConfig): Promise<void> {
  await storage.setJson(RISK_RULE_CONFIG_KEY, config)
}
