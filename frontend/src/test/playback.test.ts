import { describe, expect, it } from 'vitest'
import { buildPlaybackRoute } from '../domain/playback'
import type { SosResult, TrackingPoint } from '../types'

const firstPoint: TrackingPoint = {
  lat: 31.2304,
  lng: 121.4737,
  accuracy: 12,
  timestamp: new Date('2026-06-01T08:00:00.000Z').getTime(),
}

const secondPoint: TrackingPoint = {
  lat: 31.2314,
  lng: 121.4747,
  accuracy: 18,
  timestamp: new Date('2026-06-01T08:05:00.000Z').getTime(),
}

const sosEvent: SosResult = {
  stage: 'done',
  steps: {
    location: { label: '已获取位置', badge: '✓', detail: 'GPS 精度', tone: 'success' },
    persistence: { label: '已写入本地', badge: '✓', detail: '事件已记录', tone: 'success' },
    sms: { label: '短信已发送', badge: '✓', detail: '已调用系统短信', tone: 'success' },
    call: { label: '拨号已发起', badge: '✓', detail: '已拉起拨号', tone: 'success' },
  },
  finalStatus: 'success',
  finalLabel: '完成',
  summary: 'SOS 流程完成',
  triggeredAt: new Date('2026-06-01T08:03:00.000Z').getTime(),
  location: { lat: 31.2309, lng: 121.4742, accuracy: 10 },
}

describe('buildPlaybackRoute', () => {
  it('builds a chronological local route with start, end, and SOS key nodes', () => {
    const route = buildPlaybackRoute([secondPoint, firstPoint], [sosEvent])

    expect(route.totalTrackingPoints).toBe(2)
    expect(route.totalSosEvents).toBe(1)
    expect(route.durationMs).toBe(300_000)
    expect(route.bounds).toEqual({
      minLat: 31.2304,
      maxLat: 31.2314,
      minLng: 121.4737,
      maxLng: 121.4747,
    })
    expect(route.points.map((point) => point.role)).toEqual(['start', 'sos', 'end'])
    expect(route.points.map((point) => point.label)).toEqual(['开始点', 'SOS 关键节点', '结束点'])
  })

  it('ignores SOS history entries without retained coordinates', () => {
    const route = buildPlaybackRoute([firstPoint], [{ ...sosEvent, location: undefined }])

    expect(route.totalTrackingPoints).toBe(1)
    expect(route.totalSosEvents).toBe(0)
    expect(route.points).toHaveLength(1)
    expect(route.points[0]?.role).toBe('start')
  })
  it('computes speedKmh for consecutive tracking points', () => {
    const route = buildPlaybackRoute([firstPoint, secondPoint], [])
    const second = route.points.find((p) => p.label === '结束点')
    expect(second?.speedKmh).toBeDefined()
    expect(typeof second?.speedKmh).toBe('number')
  })
})
