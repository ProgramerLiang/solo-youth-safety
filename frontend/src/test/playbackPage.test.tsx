import { beforeEach, describe, expect, it } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { PlaybackPage } from '../pages/PlaybackPage'
import { createInitialResult, advanceStage, computeFinalStatus, updateStepTone } from '../domain/sosState'
import { useTrackingStore } from '../stores/useTrackingStore'
import { useSosStore } from '../stores/useSosStore'
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

function buildSosResult(): SosResult {
  let result = createInitialResult()
  result = advanceStage(result, 'done', 'SOS 流程完成')
  result = updateStepTone(result, 'location', 'success', '已获取位置', 'GPS 精度 10m')
  result = updateStepTone(result, 'persistence', 'success', '已写入本地', '事件已记录')
  result = updateStepTone(result, 'sms', 'success', '短信已发送', '已调用系统短信')
  result = updateStepTone(result, 'call', 'success', '拨号已发起', '已拉起拨号')
  return {
    ...computeFinalStatus(result),
    triggeredAt: new Date('2026-06-01T08:03:00.000Z').getTime(),
    location: { lat: 31.2309, lng: 121.4742, accuracy: 10 },
  }
}

beforeEach(() => {
  useTrackingStore.setState({
    enabled: false,
    intervalSeconds: 60,
    pendingCount: 0,
    lastCapturedAt: null,
    lastAcknowledgedAt: null,
    busy: false,
    queue: [],
    history: [],
    loaded: true,
  })
  useSosStore.setState({
    arming: false,
    countdownActive: false,
    sosResult: createInitialResult(),
    history: [],
    initialized: true,
  })
})

describe('PlaybackPage', () => {
  it('renders local-only map playback with start, end, timeline, and SOS key node', () => {
    useTrackingStore.setState({ history: [secondPoint, firstPoint] })
    useSosStore.setState({ history: [buildSosResult()] })

    render(<PlaybackPage />)

    expect(screen.getByRole('heading', { name: '地图化历史回放' })).toBeInTheDocument()
    expect(screen.getByText('只读取本地轨迹 / SOS 历史，不是实时地图监护')).toBeInTheDocument()
    expect(screen.getByText('轨迹点')).toBeInTheDocument()
    expect(screen.getByText('2', { selector: 'h6' })).toBeInTheDocument()
    expect(screen.getByText('SOS 节点')).toBeInTheDocument()
    expect(screen.getByText('1', { selector: 'h6' })).toBeInTheDocument()

    const map = screen.getByLabelText('本地历史回放地图')
    expect(within(map).getByText('开始点')).toBeInTheDocument()
    expect(within(map).getByText('结束点')).toBeInTheDocument()
    expect(within(map).getByText('警')).toBeInTheDocument()

    expect(screen.getByText('时间轴')).toBeInTheDocument()
    expect(screen.getByText(/SOS 关键节点/)).toBeInTheDocument()

    // Movement analysis section
    expect(screen.getByText('移动简报')).toBeInTheDocument()
    expect(screen.getByText(/总位移/)).toBeInTheDocument()
    expect(screen.getByText(/均速/)).toBeInTheDocument()
    expect(screen.getByText(/极速/)).toBeInTheDocument()
  })

  it('shows zoom controls with +/- buttons', () => {
    useTrackingStore.setState({ history: [secondPoint, firstPoint] })
    render(<PlaybackPage />)
    expect(screen.getByLabelText('放大')).toBeInTheDocument()
    expect(screen.getByLabelText('缩小')).toBeInTheDocument()
  })

  it('shows point detail popup on click', () => {
    useTrackingStore.setState({ history: [secondPoint, firstPoint] })
    render(<PlaybackPage />)
    const startLabel = screen.getByText('起')
    fireEvent.click(startLabel)
    expect(screen.getByText(/点位详情/)).toBeInTheDocument()
    expect(screen.getByText(/纬度:/)).toBeInTheDocument()
    expect(screen.getByText(/经度:/)).toBeInTheDocument()
  })

  it('shows speed legend with color ranges', () => {
    useTrackingStore.setState({ history: [secondPoint, firstPoint] })
    render(<PlaybackPage />)
    expect(screen.getByText(/低速/)).toBeInTheDocument()
    expect(screen.getByText(/中速/)).toBeInTheDocument()
    expect(screen.getByText(/高速/)).toBeInTheDocument()
  })

  it('shows playback controls with play button and speed options', () => {
    useTrackingStore.setState({ history: [secondPoint, firstPoint] })
    render(<PlaybackPage />)
    expect(screen.getByLabelText('播放')).toBeInTheDocument()
    expect(screen.getByText('1x')).toBeInTheDocument()
    expect(screen.getByText('2x')).toBeInTheDocument()
    expect(screen.getByText('4x')).toBeInTheDocument()
  })
})
