import { describe, expect, it, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { OverviewPage } from '../pages/OverviewPage'
import { useSafetyTripStore } from '../stores/useSafetyTripStore'
import { useNotificationConfigStore } from '../stores/useNotificationConfigStore'
import { saveCurrentSafetyTrip } from '../data/safetyTripRepo'
import type { SafetyTrip } from '../domain/safetyTrip'

beforeEach(() => {
  localStorage.clear()
  useSafetyTripStore.setState({ current: null, history: [], loaded: true })
  useNotificationConfigStore.setState({ config: null, loaded: true })
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
