import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { HomePage } from '../pages/HomePage'
import { useHomeStore } from '../stores/useHomeStore'
import { useConfigStore } from '../stores/useConfigStore'
import { useContactsStore } from '../stores/useContactsStore'
import { useSafetyTripStore } from '../stores/useSafetyTripStore'
import { useTrackingStore } from '../stores/useTrackingStore'
import { useSosStore } from '../stores/useSosStore'
import { useGeofenceStore } from '../stores/useGeofenceStore'
import { useIdentityStore } from '../stores/useIdentityStore'

vi.mock('../data/sosLocation', () => ({
  getSosLocation: vi.fn(async () => ({ lat: 31.23, lng: 121.47, accuracy: 8 })),
}))

beforeEach(() => {
  useHomeStore.setState({ slots: ['safetyTrip', 'contacts', 'trackingFreshness', 'smartRisk'], companionEnabled: true, loaded: true })
  useConfigStore.setState({ callNumber: '110', smsNumber: '110', smsTemplate: '测试', onboardingDone: true, loaded: true })
  useContactsStore.setState({ list: [], editingId: null, draft: { name: '', phone: '' }, loaded: true })
  useSafetyTripStore.setState({ current: null, history: [], loaded: true, _notificationId: 'n1' })
  useTrackingStore.setState({ enabled: false, intervalSeconds: 60, pendingCount: 0, lastCapturedAt: null, lastAcknowledgedAt: null, busy: false, queue: [], history: [], loaded: true } as never)
  useSosStore.setState({
    sosResult: { stage: 'idle', steps: { location: { label: '等待中', badge: '-', detail: '', tone: 'idle' }, persistence: { label: '等待中', badge: '-', detail: '', tone: 'idle' }, sms: { label: '等待中', badge: '-', detail: '', tone: 'idle' }, call: { label: '等待中', badge: '-', detail: '', tone: 'idle' } }, finalStatus: 'idle', finalLabel: '未触发', summary: '' },
    arming: false, countdownActive: false, preArmSource: null, history: [],
  })
  useGeofenceStore.setState({ zones: [], loaded: true })
  useIdentityStore.setState({ userId: 'u1', deviceId: 'd1' })
})

describe('HomePage', () => {
  it('renders the big SOS, four slot cards and the AI companion placeholder', () => {
    render(<HomePage onNavigate={vi.fn()} />)
    expect(screen.getByRole('button', { name: /触发 SOS/ })).toBeInTheDocument()
    expect(screen.getByText('紧急联系人')).toBeInTheDocument()
    expect(screen.getByText('安全行程')).toBeInTheDocument()
    expect(screen.getByText(/AI 陪伴助手/)).toBeInTheDocument()
  })

  it('does not expose standalone page-nav buttons (cards are CardActionArea)', () => {
    render(<HomePage onNavigate={vi.fn()} />)
    expect(screen.queryByRole('tab')).not.toBeInTheDocument()
  })
})