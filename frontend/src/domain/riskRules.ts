export interface ToggleRule {
  enabled: boolean
}

export interface MinutesThresholdRule extends ToggleRule {
  maxAgeMinutes?: number
  maxGapMinutes?: number
}

export interface SuspiciousPauseRule extends ToggleRule {
  minMinutes: number
  radiusM: number
}

export interface HighSpeedRule extends ToggleRule {
  maxKmh: number
}

export interface SosNearbyTrackRule extends ToggleRule {
  maxDistanceM: number
}

export interface LocationFreshnessRule extends ToggleRule {
  maxAgeMinutes: number
}

export interface RiskRuleConfig {
  staleTrack: ToggleRule & { maxAgeMinutes: number }
  longGap: ToggleRule & { maxGapMinutes: number }
  suspiciousPause: SuspiciousPauseRule
  highSpeed: HighSpeedRule
  sosNearbyTrack: SosNearbyTrackRule
  locationFreshness: LocationFreshnessRule
  geofence: ToggleRule
  configCompleteness: ToggleRule
}

export const DEFAULT_RISK_RULE_CONFIG: RiskRuleConfig = {
  staleTrack: { enabled: true, maxAgeMinutes: 60 },
  longGap: { enabled: true, maxGapMinutes: 60 },
  suspiciousPause: { enabled: true, minMinutes: 30, radiusM: 50 },
  highSpeed: { enabled: true, maxKmh: 80 },
  sosNearbyTrack: { enabled: true, maxDistanceM: 200 },
  locationFreshness: { enabled: true, maxAgeMinutes: 5 },
  geofence: { enabled: true },
  configCompleteness: { enabled: true },
}

export function mergeRiskRuleConfig(saved: Partial<RiskRuleConfig> | null | undefined): RiskRuleConfig {
  if (!saved) return DEFAULT_RISK_RULE_CONFIG
  return {
    staleTrack: { ...DEFAULT_RISK_RULE_CONFIG.staleTrack, ...saved.staleTrack },
    longGap: { ...DEFAULT_RISK_RULE_CONFIG.longGap, ...saved.longGap },
    suspiciousPause: { ...DEFAULT_RISK_RULE_CONFIG.suspiciousPause, ...saved.suspiciousPause },
    highSpeed: { ...DEFAULT_RISK_RULE_CONFIG.highSpeed, ...saved.highSpeed },
    sosNearbyTrack: { ...DEFAULT_RISK_RULE_CONFIG.sosNearbyTrack, ...saved.sosNearbyTrack },
    locationFreshness: { ...DEFAULT_RISK_RULE_CONFIG.locationFreshness, ...saved.locationFreshness },
    geofence: { ...DEFAULT_RISK_RULE_CONFIG.geofence, ...saved.geofence },
    configCompleteness: { ...DEFAULT_RISK_RULE_CONFIG.configCompleteness, ...saved.configCompleteness },
  }
}
