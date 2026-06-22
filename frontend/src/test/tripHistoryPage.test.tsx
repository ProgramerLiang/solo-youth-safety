import { describe, expect, it, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { TripHistoryPage } from '../pages/TripHistoryPage'
import { appendSafetyTripHistory, saveCurrentSafetyTrip } from '../data/safetyTripRepo'
import { storage } from '../data/storage'
import type { SafetyTrip } from '../domain/safetyTrip'

const arrivedTrip: SafetyTrip = {
  id: 't1',
  destination: '回家',
  createdAt: '2026-06-15T10:00:00.000Z',
  expectedArrivalAt: '2026-06-15T10:20:00.000Z',
  status: 'arrived',
  events: [{ id: 'e1', type: 'arrived', timestamp: '2026-06-15T10:18:00.000Z' }],
}

const cancelledTrip: SafetyTrip = {
  id: 't2',
  destination: '去超市',
  createdAt: '2026-06-14T14:00:00.000Z',
  expectedArrivalAt: '2026-06-14T14:15:00.000Z',
  status: 'cancelled',
  events: [{ id: 'e2', type: 'cancelled', timestamp: '2026-06-14T14:05:00.000Z' }],
}

beforeEach(async () => {
  await saveCurrentSafetyTrip(null)
  await storage.remove('safety_v2_trip_history')
})

describe('TripHistoryPage', () => {
  it('renders empty state when no history', async () => {
    render(<TripHistoryPage />)
    expect(await screen.findByText('暂无安全行程记录')).toBeInTheDocument()
  })

  it('renders history list with status badges', async () => {
    await appendSafetyTripHistory(arrivedTrip)
    await appendSafetyTripHistory(cancelledTrip)
    render(<TripHistoryPage />)
    expect(await screen.findByText('回家')).toBeInTheDocument()
    expect(screen.getByText('去超市')).toBeInTheDocument()
    expect(screen.getByText('已完成')).toBeInTheDocument()
    expect(screen.getByText('已取消')).toBeInTheDocument()
  })

  it('shows time and event count for each trip', async () => {
    await appendSafetyTripHistory(arrivedTrip)
    render(<TripHistoryPage />)
    expect(await screen.findByText(/2026-06-15 18:00/)).toBeInTheDocument()
    expect(screen.getByText(/1 条事件/)).toBeInTheDocument()
  })

  it('expands event timeline on click', async () => {
    await appendSafetyTripHistory(arrivedTrip)
    render(<TripHistoryPage />)
    const item = await screen.findByText('回家')
    fireEvent.click(item)
    expect(screen.getByText('到达')).toBeInTheDocument()
  })
})