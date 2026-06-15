import { describe, expect, it } from 'vitest'
import { DEFAULT_NOTIFICATION_CONFIG, mergeNotificationConfig } from '../domain/notificationChannels'

describe('DEFAULT_NOTIFICATION_CONFIG', () => {
  it('has all fields defined', () => {
    expect(DEFAULT_NOTIFICATION_CONFIG.enabled).toBe(true)
    expect(DEFAULT_NOTIFICATION_CONFIG.tripExpiring.enabled).toBe(true)
    expect(DEFAULT_NOTIFICATION_CONFIG.tripExpiring.leadMinutes).toBe(5)
    expect(DEFAULT_NOTIFICATION_CONFIG.riskElevated.enabled).toBe(true)
  })
})

describe('mergeNotificationConfig', () => {
  it('returns default when input is null', () => {
    expect(mergeNotificationConfig(null)).toEqual(DEFAULT_NOTIFICATION_CONFIG)
  })

  it('returns default when input is undefined', () => {
    expect(mergeNotificationConfig(undefined)).toEqual(DEFAULT_NOTIFICATION_CONFIG)
  })

  it('merges partial config with defaults', () => {
    const merged = mergeNotificationConfig({ enabled: false })
    expect(merged.enabled).toBe(false)
    expect(merged.tripExpiring.enabled).toBe(true)
    expect(merged.tripExpiring.leadMinutes).toBe(5)
    expect(merged.riskElevated.enabled).toBe(true)
  })

  it('merges nested tripExpiring overrides', () => {
    const merged = mergeNotificationConfig({ tripExpiring: { enabled: false, leadMinutes: 15 } })
    expect(merged.enabled).toBe(true)
    expect(merged.tripExpiring.enabled).toBe(false)
    expect(merged.tripExpiring.leadMinutes).toBe(15)
  })
})