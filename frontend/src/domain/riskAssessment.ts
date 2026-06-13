import type { SosResult, TrackingPoint } from '../types'
import { haversineDistanceM } from './geo'
import type { GeofenceResult } from './geofence'

export type RiskLevel = 'ok' | 'attention' | 'warning'

export interface RiskItem {
  title: string
  detail: string
  severity: RiskLevel
}

export interface RiskReport {
  level: RiskLevel
  items: RiskItem[]
}

const MIN_MOVEMENT_DISTANCE_M = 5
const SUSPICIOUS_PAUSE_MIN_MS = 30 * 60 * 1000
const SUSPICIOUS_PAUSE_MAX_RADIUS_M = 50
const LONG_GAP_MIN_MS = 60 * 60 * 1000
const STALE_DATA_MIN_MS = 60 * 60 * 1000
const HIGH_SPEED_KMH = 80

function highestLevel(...levels: RiskLevel[]): RiskLevel {
  for (const level of ['warning', 'attention', 'ok'] as const) {
    if (levels.includes(level)) return level
  }
  return 'ok'
}

function findSuspiciousPauses(sorted: TrackingPoint[]): { startedAt: number; endedAt: number; count: number }[] {
  const pauses: { startedAt: number; endedAt: number; count: number }[] = []
  if (sorted.length < 2) return pauses

  let windowStart = 0
  for (let i = 1; i <= sorted.length; i++) {
    if (i === sorted.length) {
      const windowPts = sorted.slice(windowStart)
      if (windowPts.length >= 2) {
        const wFirst = windowPts[0]!
        const wLast = windowPts[windowPts.length - 1]!
        const duration = wLast.timestamp - wFirst.timestamp
        if (duration >= SUSPICIOUS_PAUSE_MIN_MS) {
          pauses.push({ startedAt: wFirst.timestamp, endedAt: wLast.timestamp, count: windowPts.length })
        }
      }
      break
    }

    const anchor = sorted[windowStart]!
    const windowEnd = sorted[i]!
    if (haversineDistanceM(windowEnd.lat, windowEnd.lng, anchor.lat, anchor.lng) > SUSPICIOUS_PAUSE_MAX_RADIUS_M) {
      const closedPts = sorted.slice(windowStart, i)
      if (closedPts.length >= 2) {
        const wFirst = closedPts[0]!
        const wLast = closedPts[closedPts.length - 1]!
        const duration = wLast.timestamp - wFirst.timestamp
        if (duration >= SUSPICIOUS_PAUSE_MIN_MS) {
          pauses.push({ startedAt: wFirst.timestamp, endedAt: wLast.timestamp, count: closedPts.length })
        }
      }
      windowStart = i
    }
  }
  return pauses
}

function findLongGaps(sorted: TrackingPoint[]): { startedAt: number; endedAt: number; gapMs: number }[] {
  const gaps: { startedAt: number; endedAt: number; gapMs: number }[] = []
  for (let i = 1; i < sorted.length; i++) {
    const gapMs = sorted[i]!.timestamp - sorted[i - 1]!.timestamp
    if (gapMs >= LONG_GAP_MIN_MS) {
      gaps.push({ startedAt: sorted[i - 1]!.timestamp, endedAt: sorted[i]!.timestamp, gapMs })
    }
  }
  return gaps
}

function findHighSpeedSegments(sorted: TrackingPoint[]): { from: TrackingPoint; to: TrackingPoint; speedKmh: number }[] {
  const segments: { from: TrackingPoint; to: TrackingPoint; speedKmh: number }[] = []
  for (let i = 1; i < sorted.length; i++) {
    const from = sorted[i - 1]!
    const to = sorted[i]!
    const d = haversineDistanceM(from.lat, from.lng, to.lat, to.lng)
    if (d < MIN_MOVEMENT_DISTANCE_M) continue
    const dt = to.timestamp - from.timestamp
    if (dt <= 0) continue
    const speedKmh = (d / dt) * 3600
    if (speedKmh >= HIGH_SPEED_KMH) {
      segments.push({ from, to, speedKmh: Math.round(speedKmh * 10) / 10 })
    }
  }
  return segments
}

export function assessMovementRisk(points: TrackingPoint[], sosHistory: SosResult[]): RiskReport {
  const items: RiskItem[] = []
  const sorted = [...points].sort((a, b) => a.timestamp - b.timestamp)

  if (sorted.length === 0) {
    if (sosHistory.length > 0) {
      items.push({
        title: 'SOS 发生时无轨迹',
        detail: `${sosHistory.length} 次 SOS 事件，但缺少对应轨迹点进行位置对照`,
        severity: 'attention',
      })
    } else {
      items.push({ title: '无轨迹数据', detail: '暂无足够轨迹点进行评估', severity: 'ok' })
    }
    return { level: highestLevel(...items.map((i) => i.severity)), items }
  }

  const pauses = findSuspiciousPauses(sorted)
  for (const p of pauses) {
    items.push({
      title: '可疑长停',
      detail: `${new Date(p.startedAt).toLocaleString('zh-CN')} – ${new Date(p.endedAt).toLocaleString('zh-CN')} · ${p.count} 个采样点 · ${Math.round((p.endedAt - p.startedAt) / 60000)} 分钟`,
      severity: 'warning',
    })
  }

  const gaps = findLongGaps(sorted)
  for (const g of gaps) {
    items.push({
      title: '轨迹长时间间断',
      detail: `${new Date(g.startedAt).toLocaleString('zh-CN')} → ${new Date(g.endedAt).toLocaleString('zh-CN')} · 间隔 ${Math.round(g.gapMs / 60000)} 分钟`,
      severity: 'attention',
    })
  }

  const speedSegs = findHighSpeedSegments(sorted)
  for (const s of speedSegs) {
    items.push({
      title: '高速移动',
      detail: `${new Date(s.from.timestamp).toLocaleString('zh-CN')} → ${new Date(s.to.timestamp).toLocaleString('zh-CN')} · ${s.speedKmh} km/h`,
      severity: 'attention',
    })
  }

  if (sosHistory.length > 0) {
    let sosWithoutNearby = 0
    for (const sos of sosHistory) {
      if (!sos.location || !sos.triggeredAt) {
        sosWithoutNearby++
        continue
      }
      const nearby = sorted.some(
        (p) => haversineDistanceM(p.lat, p.lng, sos.location!.lat, sos.location!.lng) <= 200,
      )
      if (!nearby) sosWithoutNearby++
    }
    if (sosWithoutNearby > 0) {
      items.push({
        title: 'SOS 附近无轨迹',
        detail: `${sosWithoutNearby} 次 SOS 附近 200m 内无轨迹点`,
        severity: 'attention',
      })
    }
  }

  const lastTimestamp = sorted[sorted.length - 1]!.timestamp
  const agoMs = Date.now() - lastTimestamp
  if (agoMs > STALE_DATA_MIN_MS) {
    items.push({
      title: '轨迹数据过旧',
      detail: `最后轨迹点距今 ${Math.round(agoMs / 60000)} 分钟`,
      severity: 'attention',
    })
  }

  const level = items.length > 0
    ? highestLevel(...items.map((item) => item.severity))
    : 'ok'

  if (items.length === 0) {
    items.push({ title: '轨迹正常', detail: '未检测到异常风险项', severity: 'ok' })
  }

  return { level, items }
}

export interface RiskDataInput {
  points: TrackingPoint[]
  sosHistory: SosResult[]
  config: { callNumber: string; smsNumber: string }
  contacts: { id: string; name: string; phone: string }[]
  locationAgeMs: number
  geofenceEvents?: GeofenceResult[]
}

const LOCATION_STALE_MS = 5 * 60 * 1000

export function aggregateRiskData(input: RiskDataInput): RiskReport {
  const items: RiskItem[] = []

  const movement = assessMovementRisk(input.points, input.sosHistory)
  items.push(...movement.items)

  if (!input.config.callNumber.trim()) {
    items.push({ title: '未配置紧急电话', detail: '请前往配置页设置紧急呼叫号码', severity: 'warning' })
  }
  if (!input.config.smsNumber.trim()) {
    items.push({ title: '未配置短信号码', detail: '请前往配置页设置短信号码', severity: 'warning' })
  }
  if (input.contacts.length === 0) {
    items.push({ title: '无紧急联系人', detail: '请前往联系人页添加至少一个联系人', severity: 'warning' })
  }
  if (input.locationAgeMs > LOCATION_STALE_MS) {
    items.push({ title: '位置信息过期', detail: `上一次定位距今 ${Math.round(input.locationAgeMs / 60000)} 分钟`, severity: 'attention' })
  }

  for (const event of input.geofenceEvents ?? []) {
    if (event.event === 'exit') {
      items.push({
        title: `离开${event.zoneLabel}`,
        detail: `${new Date(event.at).toLocaleString('zh-CN')} · 距离中心约 ${event.distanceM} 米`,
        severity: 'warning',
      })
    } else if (event.event === 'enter') {
      items.push({
        title: `进入${event.zoneLabel}`,
        detail: `${new Date(event.at).toLocaleString('zh-CN')} · 距离中心约 ${event.distanceM} 米`,
        severity: 'attention',
      })
    }
  }

  const level = items.length > 0
    ? highestLevel(...items.map((item) => item.severity))
    : 'ok'

  return { level, items }
}