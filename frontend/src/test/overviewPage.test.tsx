import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { OverviewPage } from '../pages/OverviewPage'
import { useConfigStore } from '../stores/useConfigStore'
import { useContactsStore } from '../stores/useContactsStore'
import { useGeofenceStore } from '../stores/useGeofenceStore'
import { useNotificationConfigStore } from '../stores/useNotificationConfigStore'
import { useRuleEngineStore } from '../stores/useRuleEngineStore'
import { useSafetyTripStore } from '../stores/useSafetyTripStore'
import { useTrackingStore } from '../stores/useTrackingStore'
import { saveCurrentSafetyTrip } from '../data/safetyTripRepo'
import type { SafetyTrip } from '../domain/safetyTrip'

const originalRuleEvaluate = useRuleEngineStore.getState().evaluate

beforeEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
  localStorage.clear()
  useConfigStore.setState({ callNumber: '', smsNumber: '', smsTemplate: '', onboardingDone: false, loaded: true })
  useContactsStore.setState({ list: [], editingId: null, draft: { name: '', phone: '' }, loaded: true })
  useGeofenceStore.setState({ zones: [], loaded: true })
  useNotificationConfigStore.setState({ config: null, loaded: true })
  useRuleEngineStore.setState({ rules: [], loaded: true, evaluate: originalRuleEvaluate })
  useSafetyTripStore.setState({ current: null, history: [], loaded: true, _notificationId: '' })
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
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  useRuleEngineStore.setState({ evaluate: originalRuleEvaluate })
})

describe('OverviewPage', () => {
  it('does not render page shortcut navigation inside the overview content', () => {
    render(<OverviewPage />)

    expect(screen.queryByRole('button', { name: 'SOS' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '配置' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '联系人' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '历史' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '轨迹' })).not.toBeInTheDocument()
  })

  it('renders the risk card section', () => {
    render(<OverviewPage />)
    expect(screen.getByText('风险提示')).toBeInTheDocument()
    expect(screen.getByText('仅基于本机数据提示，不会自动触发 SOS。')).toBeInTheDocument()
  })

  it('renders the polished dashboard disclaimer and risk groups', () => {
    render(<OverviewPage />)

    expect(screen.getByText('所有提示仅本地生成，不会自动通知联系人或触发 SOS。')).toBeInTheDocument()
    expect(screen.getByText('配置风险')).toBeInTheDocument()
    expect(screen.getByText('轨迹追踪正常')).toBeInTheDocument()
    expect(screen.getByText('暂无围栏事件')).toBeInTheDocument()
  })

  it('evaluates smart rules with current risk, overdue trip, and geofence state', () => {
    const now = new Date('2026-06-15T12:00:00.000Z')
    vi.useFakeTimers()
    vi.setSystemTime(now)
    const evaluate = vi.spyOn(useRuleEngineStore.getState(), 'evaluate').mockReturnValue([])
    const trip: SafetyTrip = {
      id: 't1',
      destination: '回宿舍',
      createdAt: new Date(now.getTime() - 40 * 60_000).toISOString(),
      expectedArrivalAt: new Date(now.getTime() - 10 * 60_000).toISOString(),
      status: 'active',
      events: [],
    }

    useConfigStore.setState({ callNumber: '110', smsNumber: '120', smsTemplate: 'SOS', onboardingDone: true })
    useContactsStore.setState({ list: [{ id: 'c1', name: '室友', phone: '13000000000' }] })
    useSafetyTripStore.setState({ current: trip })
    useGeofenceStore.setState({ zones: [{ id: 'zf-1', label: '宿舍', lat: 31, lng: 121, radiusM: 100 }] })
    useTrackingStore.setState({
      history: [
        { lat: 31, lng: 121, accuracy: 10, timestamp: now.getTime() - 5 * 60_000 },
        { lat: 31.002, lng: 121, accuracy: 10, timestamp: now.getTime() - 4 * 60_000 },
      ],
    })

    render(<OverviewPage />)

    expect(evaluate).toHaveBeenCalledWith(expect.objectContaining({
      riskLevel: 'warning',
      tripStatus: 'overtime',
      tripOvertimeMinutes: 10,
      latestGeofenceEvent: { type: 'left', zoneName: '宿舍' },
      stationaryMinutes: null,
    }), expect.any(Number))
  })
})

describe('OverviewPage safety trip card', () => {
  it('shows create trip button when no current trip', () => {
    render(<OverviewPage />)
    expect(screen.getByText('安全行程')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '创建安全行程' })).toBeInTheDocument()
  })

  it('shows countdown when trip is active', () => {
    const trip: SafetyTrip = {
      id: 't1',
      destination: '回宿舍',
      createdAt: new Date(Date.now() - 5 * 60_000).toISOString(),
      expectedArrivalAt: new Date(Date.now() + 25 * 60_000).toISOString(),
      status: 'active',
      events: [],
    }
    useSafetyTripStore.setState({ current: trip })
    render(<OverviewPage />)
    expect(screen.getByText('回宿舍')).toBeInTheDocument()
    expect(screen.getByText(/剩余约/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '已到达' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '延长 10 分钟' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '取消' })).toBeInTheDocument()
  })

  it('shows overdue warning text when trip is overdue', () => {
    const trip: SafetyTrip = {
      id: 't1',
      destination: '回宿舍',
      createdAt: new Date(Date.now() - 40 * 60_000).toISOString(),
      expectedArrivalAt: new Date(Date.now() - 10 * 60_000).toISOString(),
      status: 'active',
      events: [],
    }
    useSafetyTripStore.setState({ current: trip })
    render(<OverviewPage />)
    expect(screen.getAllByText(/超时未确认/).length).toBeGreaterThan(0)
  })

  it('loads current trip from local storage on mount', async () => {
    const trip: SafetyTrip = {
      id: 't1',
      destination: '回宿舍',
      createdAt: new Date(Date.now() - 5 * 60_000).toISOString(),
      expectedArrivalAt: new Date(Date.now() + 25 * 60_000).toISOString(),
      status: 'active',
      events: [],
    }
    await saveCurrentSafetyTrip(trip)
    useSafetyTripStore.setState({ current: null, history: [], loaded: false })
    render(<OverviewPage />)
    await waitFor(() => expect(screen.getByText('回宿舍')).toBeInTheDocument())
  })
})
