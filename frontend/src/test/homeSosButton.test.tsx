import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { HomeSosButton } from '../components/HomeSosButton'
import { useSosStore } from '../stores/useSosStore'
import { useConfigStore } from '../stores/useConfigStore'
import { useTrackingStore } from '../stores/useTrackingStore'
import { useIdentityStore } from '../stores/useIdentityStore'

vi.mock('../data/sosLocation', () => ({
  getSosLocation: vi.fn(async () => ({ lat: 31.23, lng: 121.47, accuracy: 8 })),
}))

const triggerMock = vi.fn(async () => {})

beforeEach(() => {
  useSosStore.setState({
    sosResult: {
      stage: 'idle',
      steps: {
        location: { label: '等待中', badge: '-', detail: '', tone: 'idle' },
        persistence: { label: '等待中', badge: '-', detail: '', tone: 'idle' },
        sms: { label: '等待中', badge: '-', detail: '', tone: 'idle' },
        call: { label: '等待中', badge: '-', detail: '', tone: 'idle' },
      },
      finalStatus: 'idle',
      finalLabel: '未触发',
      summary: '',
    },
    arming: false,
    countdownActive: false,
    preArmSource: null,
    triggerNow: triggerMock,
  })
  useConfigStore.setState({ callNumber: '110', smsNumber: '110', smsTemplate: '测试', onboardingDone: true })
  useTrackingStore.setState({ lastCapturedAt: Date.now() - 10_000 } as never)
  useIdentityStore.setState({ userId: 'u1', deviceId: 'd1' })
})

describe('HomeSosButton', () => {
  it('renders a large round SOS trigger button', () => {
    render(<HomeSosButton onNavigate={vi.fn()} />)
    expect(screen.getByRole('button', { name: /触发 SOS/ })).toBeInTheDocument()
  })

  it('shows the one-tap config shortcut when numbers are missing', () => {
    useConfigStore.setState({ callNumber: '', smsNumber: '', smsTemplate: '测试', onboardingDone: false })
    const onNavigate = vi.fn()
    render(<HomeSosButton onNavigate={onNavigate} />)
    fireEvent.click(screen.getByRole('button', { name: '一键前往配置' }))
    expect(onNavigate).toHaveBeenCalledWith('config')
  })

  it('starts a 5s countdown on tap and cancels on second tap', () => {
    vi.useFakeTimers()
    try {
      render(<HomeSosButton onNavigate={vi.fn()} />)
      fireEvent.click(screen.getByRole('button', { name: /触发 SOS/ }))
      expect(screen.getByRole('button', { name: /取消/ })).toBeInTheDocument()
      fireEvent.click(screen.getByRole('button', { name: /取消/ }))
      expect(screen.getByRole('button', { name: /触发 SOS/ })).toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
  })
})