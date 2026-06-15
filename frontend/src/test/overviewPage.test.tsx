import { describe, expect, it, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { OverviewPage } from '../pages/OverviewPage'
import { useSafetyTripStore } from '../stores/useSafetyTripStore'
import type { SafetyTrip } from '../domain/safetyTrip'

beforeEach(() => {
  localStorage.clear()
  useSafetyTripStore.setState({ current: null, history: [], loaded: true })
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
})
