import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { AppShell } from '../shell/AppShell'
import { useSosStore } from '../stores/useSosStore'
import { useConfigStore } from '../stores/useConfigStore'
import { useIdentityStore } from '../stores/useIdentityStore'

// 预武装倒计时会发起真实定位与短信/电话动作,测试中全部打桩。
vi.mock('../data/sosLocation', () => ({
  getSosLocation: vi.fn(async () => ({ lat: 31.23, lng: 121.47, accuracy: 8 })),
}))

const triggerMock = vi.fn(async () => {})

beforeEach(() => {
  vi.stubGlobal('__APP_VERSION__', 'test')
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
    history: [],
    triggerNow: triggerMock,
  })
  useConfigStore.setState({ callNumber: '110', smsNumber: '110', smsTemplate: '测试', onboardingDone: true })
  useIdentityStore.setState({ userId: 'u1', deviceId: 'd1' })
})

function renderShell() {
  return render(
    <AppShell activePageId="sos" onNavigate={() => {}}>
      <div>page</div>
    </AppShell>,
  )
}

describe('PreArmOverlay countdown guards', () => {
  it('manual arm never opens the pre-arm dialog', () => {
    renderShell()

    act(() => {
      useSosStore.getState().arm()
    })

    expect(triggerMock).not.toHaveBeenCalled()
    expect(document.querySelector('[role="dialog"]')).toBeNull()
  })

  it('pre-armed SOS starts a 5s countdown, then triggers with a fresh position', async () => {
    vi.useFakeTimers()
    try {
      renderShell()

      act(() => {
        useSosStore.getState().preArmRule('深夜未归')
      })

      expect(screen.getByText(/规则「深夜未归」已触发预武装 SOS/)).toBeInTheDocument()

      act(() => {
        vi.advanceTimersByTime(5100)
      })
      await act(async () => {})

      expect(triggerMock).toHaveBeenCalledTimes(1)
    } finally {
      vi.useRealTimers()
    }
  })
})
