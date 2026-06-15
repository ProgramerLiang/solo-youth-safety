import { describe, expect, it } from 'vitest'
import { assessMovementRisk, aggregateRiskData } from '../domain/riskAssessment'
import { DEFAULT_RISK_RULE_CONFIG } from '../domain/riskRules'
import type { SosResult, TrackingPoint, Contact, AppConfig } from '../types'

function pt(lat: number, lng: number, ts: number): TrackingPoint {
  return { lat, lng, accuracy: 10, timestamp: ts }
}

const sosTemplate: SosResult = {
  stage: 'done',
  steps: {
    location: { label: '', badge: '', detail: '', tone: 'idle' },
    persistence: { label: '', badge: '', detail: '', tone: 'idle' },
    sms: { label: '', badge: '', detail: '', tone: 'idle' },
    call: { label: '', badge: '', detail: '', tone: 'idle' },
  },
  finalStatus: 'success',
  finalLabel: 'done',
  summary: '',
}

describe('assessMovementRisk', () => {
  it('returns ok for empty points with no SOS', () => {
    const report = assessMovementRisk([], [])
    expect(report.level).toBe('ok')
  })

  it('flags stale data when last point > 1h old', () => {
    const oldTs = Date.now() - 2 * 3600_000
    const points = [pt(31, 121, oldTs)]
    const report = assessMovementRisk(points, [])
    expect(report.items.some((i) => i.title === '轨迹数据过旧')).toBe(true)
  })

  it('returns ok for recent single point', () => {
    const points = [pt(31, 121, Date.now() - 60_000)]
    const report = assessMovementRisk(points, [])
    expect(report.level).toBe('ok')
  })

  it('flags suspicious pause >= 30min within 50m radius', () => {
    const now = Date.now()
    const points: TrackingPoint[] = Array.from({ length: 4 }, (_, i) =>
      pt(31.0001 + i * 0.00001, 121.0001 + i * 0.00001, now - (240 - i * 10) * 60_000),
    )
    points.push(pt(31.5, 121.5, now))
    const report = assessMovementRisk(points, [])
    const pauseItems = report.items.filter((i) => i.title === '可疑长停')
    expect(pauseItems.length).toBe(1)
    expect(pauseItems[0]!.severity).toBe('warning')
    expect(report.level).toBe('warning')
  })

  it('flags long gaps (>= 1h) between successive points', () => {
    const now = Date.now()
    const points = [pt(31, 121, now - 5400_000), pt(31.2, 121.2, now)]
    const report = assessMovementRisk(points, [])
    const gapItems = report.items.filter((i) => i.title === '轨迹长时间间断')
    expect(gapItems.length).toBe(1)
    expect(report.level).toBe('attention')
  })

  it('flags high speed segments over 80 km/h', () => {
    const now = Date.now()
    const speedMps = 90
    const dtMs = 10000
    const distM = (speedMps / 3600) * dtMs
    const latDelta = distM / 111_000
    const points = [pt(31, 121, now - dtMs), pt(31 + latDelta, 121, now)]
    const report = assessMovementRisk(points, [])
    const speedItems = report.items.filter((i) => i.title === '高速移动')
    expect(speedItems.length).toBe(1)
    expect(speedItems[0]!.severity).toBe('attention')
  })

  it('respects disabled high speed rule', () => {
    const now = Date.now()
    const speedMps = 90
    const dtMs = 10000
    const distM = (speedMps / 3600) * dtMs
    const latDelta = distM / 111_000
    const points = [pt(31, 121, now - dtMs), pt(31 + latDelta, 121, now)]
    const report = assessMovementRisk(points, [], {
      ...DEFAULT_RISK_RULE_CONFIG,
      highSpeed: { ...DEFAULT_RISK_RULE_CONFIG.highSpeed, enabled: false },
    })
    expect(report.items.some((i) => i.title === '高速移动')).toBe(false)
  })

  it('respects custom long gap threshold', () => {
    const now = Date.now()
    const points = [pt(31, 121, now - 90 * 60_000), pt(31.2, 121.2, now)]
    const report = assessMovementRisk(points, [], {
      ...DEFAULT_RISK_RULE_CONFIG,
      longGap: { ...DEFAULT_RISK_RULE_CONFIG.longGap, maxGapMinutes: 120 },
    })
    expect(report.items.some((i) => i.title === '轨迹长时间间断')).toBe(false)
  })

  it('flags SOS without tracking data', () => {
    const sos: SosResult = {
      ...sosTemplate,
      triggeredAt: Date.now(),
      location: { lat: 31, lng: 121, accuracy: 10 },
    }
    const report = assessMovementRisk([], [sos])
    expect(report.items.some((i) => i.title === 'SOS 发生时无轨迹')).toBe(true)
  })

  it('flags SOS when tracking exists but SOS location is far', () => {
    const now = Date.now()
    const points = [pt(31, 121, now - 60_000), pt(31.001, 121.001, now)]
    const sos: SosResult = {
      ...sosTemplate,
      triggeredAt: now,
      location: { lat: 33, lng: 123, accuracy: 10 },
    }
    const report = assessMovementRisk(points, [sos])
    expect(report.items.some((i) => i.title === 'SOS 附近无轨迹')).toBe(true)
  })

  it('returns clean report for recent normal movement', () => {
    const now = Date.now()
    const points = [
      pt(31, 121, now - 120_000),
      pt(31.001, 121.001, now - 60_000),
      pt(31.002, 121.002, now),
    ]
    const report = assessMovementRisk(points, [])
    expect(report.level).toBe('ok')
  })
})

// ---- aggregateRiskData tests ----

function emptyConfig(): AppConfig {
  return { callNumber: '', smsNumber: '', smsTemplate: '', onboardingDone: false }
}

function configured(): AppConfig {
  return { callNumber: '110', smsNumber: '110', smsTemplate: 'SOS', onboardingDone: true }
}

describe('aggregateRiskData', () => {
  const now = Date.now()

  it('returns ok when everything is normal', () => {
    const cfg = configured()
    const contacts: Contact[] = [{ id: '1', name: 'A', phone: '110' }]
    const pts = [pt(31, 121, now - 60_000), pt(31.001, 121.001, now)]
    const result = aggregateRiskData({ points: pts, sosHistory: [], config: cfg, contacts, locationAgeMs: 30_000 })
    expect(result.level).toBe('ok')
  })

  it('flags missing call number', () => {
    const cfg = { ...configured(), callNumber: '' }
    const contacts: Contact[] = [{ id: '1', name: 'A', phone: '110' }]
    const pts = [pt(31, 121, now - 60_000), pt(31.001, 121.001, now)]
    const result = aggregateRiskData({ points: pts, sosHistory: [], config: cfg, contacts, locationAgeMs: 30_000 })
    expect(result.items.some((i) => i.title === '未配置紧急电话')).toBe(true)
    expect(result.level).toBe('warning')
  })

  it('flags missing sms number', () => {
    const cfg = { ...configured(), smsNumber: '' }
    const contacts: Contact[] = [{ id: '1', name: 'A', phone: '110' }]
    const pts = [pt(31, 121, now - 60_000), pt(31.001, 121.001, now)]
    const result = aggregateRiskData({ points: pts, sosHistory: [], config: cfg, contacts, locationAgeMs: 30_000 })
    expect(result.items.some((i) => i.title === '未配置短信号码')).toBe(true)
    expect(result.level).toBe('warning')
  })

  it('flags empty contacts', () => {
    const cfg = configured()
    const pts = [pt(31, 121, now - 60_000), pt(31.001, 121.001, now)]
    const result = aggregateRiskData({ points: pts, sosHistory: [], config: cfg, contacts: [], locationAgeMs: 30_000 })
    expect(result.items.some((i) => i.title === '无紧急联系人')).toBe(true)
    expect(result.level).toBe('warning')
  })

  it('flags stale location', () => {
    const cfg = configured()
    const contacts: Contact[] = [{ id: '1', name: 'A', phone: '110' }]
    const pts = [pt(31, 121, now - 120_000)]
    const result = aggregateRiskData({ points: pts, sosHistory: [], config: cfg, contacts, locationAgeMs: 100 * 60_000 })
    expect(result.items.some((i) => i.title === '位置信息过期')).toBe(true)
    expect(result.level).toBe('attention')
  })

  it('level is max of all items', () => {
    const cfg = emptyConfig()
    const pts = [pt(31, 121, now - 2 * 3600_000)]
    const result = aggregateRiskData({ points: pts, sosHistory: [], config: cfg, contacts: [], locationAgeMs: 100 * 60_000 })
    expect(result.level).toBe('warning')
  })

  it('includes movement risk items from assessMovementRisk', () => {
    const cfg = configured()
    const contacts: Contact[] = [{ id: '1', name: 'A', phone: '110' }]
    const points = [pt(31, 121, now - 5400_000), pt(31.2, 121.2, now)]
    const result = aggregateRiskData({ points, sosHistory: [], config: cfg, contacts, locationAgeMs: 30_000 })
    expect(result.items.some((i) => i.title === '轨迹长时间间断')).toBe(true)
  })

  it('empty points returns ok item for movement', () => {
    const cfg = configured()
    const contacts: Contact[] = [{ id: '1', name: 'A', phone: '110' }]
    const result = aggregateRiskData({ points: [], sosHistory: [], config: cfg, contacts, locationAgeMs: 30_000 })
    expect(result.level).toBe('ok')
    expect(result.items.some((i) => i.title === '无轨迹数据')).toBe(true)
  })

  it('flags exit from geofence zone', () => {
    const cfg = configured()
    const contacts: Contact[] = [{ id: '1', name: 'A', phone: '110' }]
    const pts = [pt(31, 121, now - 60_000), pt(31.001, 121.001, now)]
    const events = [{ zoneId: 'z1', zoneLabel: '安全区', event: 'exit' as const, at: now, lat: 31.001, lng: 121.001, distanceM: 500 }]
    const result = aggregateRiskData({ points: pts, sosHistory: [], config: cfg, contacts, locationAgeMs: 30_000, geofenceEvents: events })
    expect(result.level).toBe('warning')
    expect(result.items.some((i) => i.title === '离开安全区')).toBe(true)
  })

  it('flags enter into geofence zone as attention', () => {
    const cfg = configured()
    const contacts: Contact[] = [{ id: '1', name: 'A', phone: '110' }]
    const pts = [pt(31.5, 121.5, now - 120_000), pt(31, 121, now)]
    const events = [{ zoneId: 'z1', zoneLabel: '风险区', event: 'enter' as const, at: now, lat: 31, lng: 121, distanceM: 10 }]
    const result = aggregateRiskData({ points: pts, sosHistory: [], config: cfg, contacts, locationAgeMs: 30_000, geofenceEvents: events })
    expect(result.level).toBe('attention')
    expect(result.items.some((i) => i.title === '进入风险区')).toBe(true)
  })

  it('ignores empty geofence events', () => {
    const cfg = configured()
    const contacts: Contact[] = [{ id: '1', name: 'A', phone: '110' }]
    const pts = [pt(31, 121, now - 60_000), pt(31.001, 121.001, now)]
    const result = aggregateRiskData({ points: pts, sosHistory: [], config: cfg, contacts, locationAgeMs: 30_000, geofenceEvents: [] })
    expect(result.level).toBe('ok')
    expect(result.items.every((i) => !i.title.includes('安全区') && !i.title.includes('风险区'))).toBe(true)
  })

  it('respects disabled geofence rule', () => {
    const cfg = configured()
    const contacts: Contact[] = [{ id: '1', name: 'A', phone: '110' }]
    const pts = [pt(31, 121, now - 60_000), pt(31.001, 121.001, now)]
    const events = [{ zoneId: 'z1', zoneLabel: '安全区', event: 'exit' as const, at: now, lat: 31.001, lng: 121.001, distanceM: 500 }]
    const result = aggregateRiskData({ points: pts, sosHistory: [], config: cfg, contacts, locationAgeMs: 30_000, geofenceEvents: events, riskRules: { ...DEFAULT_RISK_RULE_CONFIG, geofence: { enabled: false } } })
    expect(result.items.some((i) => i.title === '离开安全区')).toBe(false)
  })

  it('respects disabled config completeness rule', () => {
    const cfg = emptyConfig()
    const result = aggregateRiskData({ points: [], sosHistory: [], config: cfg, contacts: [], locationAgeMs: 30_000, riskRules: { ...DEFAULT_RISK_RULE_CONFIG, configCompleteness: { enabled: false } } })
    expect(result.items.some((i) => i.title === '未配置紧急电话')).toBe(false)
    expect(result.items.some((i) => i.title === '未配置短信号码')).toBe(false)
    expect(result.items.some((i) => i.title === '无紧急联系人')).toBe(false)
  })
})