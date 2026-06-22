import { describe, expect, it, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SosPage } from '../pages/SosPage'
import { useSosStore } from '../stores/useSosStore'
import { useConfigStore } from '../stores/useConfigStore'
import { useIdentityStore } from '../stores/useIdentityStore'

beforeEach(() => {
  useSosStore.setState({ sosResult: { stage: 'idle', steps: { location: { label: '等待中', badge: '-', detail: '', tone: 'idle' }, persistence: { label: '等待中', badge: '-', detail: '', tone: 'idle' }, sms: { label: '等待中', badge: '-', detail: '', tone: 'idle' }, call: { label: '等待中', badge: '-', detail: '', tone: 'idle' } }, finalStatus: 'idle', finalLabel: '未触发', summary: '' }, arming: false, countdownActive: false })
  useConfigStore.setState({ callNumber: '110', smsNumber: '110', smsTemplate: '测试', onboardingDone: true })
  useIdentityStore.setState({ userId: 'u1', deviceId: 'd1' })
})

describe('SosPage simulation training', () => {
  it('shows simulation training card', () => {
    render(<SosPage />)
    expect(screen.getByText('模拟训练')).toBeInTheDocument()
    expect(screen.getByText('开始模拟训练')).toBeInTheDocument()
  })

  it('starts countdown when simulation training is triggered', () => {
    render(<SosPage />)
    fireEvent.click(screen.getByText('开始模拟训练'))
    expect(screen.getByText(/取消/)).toBeInTheDocument()
  })
})