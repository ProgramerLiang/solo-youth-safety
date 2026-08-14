import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MessagesPanel } from '../components/MessagesPanel'
import { useSosStore } from '../stores/useSosStore'
import { useTrackingStore } from '../stores/useTrackingStore'
import { useGeofenceStore } from '../stores/useGeofenceStore'
import { useRuleEngineStore } from '../stores/useRuleEngineStore'

beforeEach(() => {
  useSosStore.setState({ history: [], arming: false, countdownActive: false, preArmSource: null })
  useTrackingStore.setState({ history: [], loaded: true } as never)
  useGeofenceStore.setState({ zones: [], loaded: true })
  useRuleEngineStore.setState({ rules: [], loaded: true })
})

describe('MessagesPanel', () => {
  it('shows an empty state when there are no events', () => {
    render(<MessagesPanel onNavigate={vi.fn()} onClose={vi.fn()} />)
    expect(screen.getByText(/暂无消息/)).toBeInTheDocument()
  })

  it('lists recent SOS records and jumps to history on click', () => {
    useSosStore.setState({
      history: [{
        stage: 'done',
        steps: { location: { label: '定位', badge: '✓', detail: '', tone: 'success' }, persistence: { label: '记录', badge: '✓', detail: '', tone: 'success' }, sms: { label: '短信', badge: '✓', detail: '', tone: 'success' }, call: { label: '电话', badge: '✓', detail: '', tone: 'success' } },
        finalStatus: 'success', finalLabel: '已通知', summary: 'ok', triggeredAt: 1000,
      }],
      arming: false, countdownActive: false, preArmSource: null,
    })
    const onNavigate = vi.fn()
    render(<MessagesPanel onNavigate={onNavigate} onClose={vi.fn()} />)
    fireEvent.click(screen.getByText(/SOS 已通知/))
    expect(onNavigate).toHaveBeenCalledWith('history')
  })
})