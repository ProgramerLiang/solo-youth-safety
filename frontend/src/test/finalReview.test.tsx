import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { createInitialResult } from '../domain/sosState'
import { SosPage } from '../pages/SosPage'
import { ToolsPage } from '../pages/ToolsPage'
import { TRACKING_STATE_KEY } from '../data/trackingRepo'
import { useConfigStore } from '../stores/useConfigStore'
import { useContactsStore } from '../stores/useContactsStore'
import { useDevModeStore } from '../stores/useDevModeStore'
import { useIdentityStore } from '../stores/useIdentityStore'
import { useSosStore } from '../stores/useSosStore'
import { useTrackingStore } from '../stores/useTrackingStore'
import type { TrackingPoint } from '../types'

const geolocationMock = vi.hoisted(() => ({
  getCurrentPosition: vi.fn(),
}))

const nativeActionsMock = vi.hoisted(() => ({
  triggerNativeCall: vi.fn(),
  triggerNativeSms: vi.fn(),
}))

vi.mock('@capacitor/geolocation', () => ({
  Geolocation: geolocationMock,
}))

vi.mock('../native/nativeActions', () => nativeActionsMock)

const queuedPoint: TrackingPoint = {
  lat: 31,
  lng: 121,
  accuracy: 10,
  timestamp: new Date('2026-06-01T04:00:00.000Z').getTime(),
}

function resetStores() {
  useConfigStore.setState({
    callNumber: '',
    smsNumber: '',
    smsTemplate: '',
    onboardingDone: true,
    loaded: true,
    pendingImport: null,
    pendingDiffs: [],
    importPending: false,
  })
  useIdentityStore.setState({
    userId: 'user_test',
    deviceId: 'device_test',
    platform: 'web',
    loaded: true,
  })
  useSosStore.setState({
    arming: false,
    countdownActive: false,
    sosResult: createInitialResult(),
    history: [],
    initialized: true,
  })
  useContactsStore.setState({ list: [], loaded: true })
  useDevModeStore.setState({ enabled: true, tapProgress: 0, loaded: true })
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
}

beforeEach(() => {
  localStorage.clear()
  geolocationMock.getCurrentPosition.mockReset()
  nativeActionsMock.triggerNativeCall.mockReset()
  nativeActionsMock.triggerNativeSms.mockReset()
  resetStores()
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  localStorage.clear()
})

describe('final review regressions', () => {
  it('reports SOS location failure instead of sending demo coordinates', async () => {
    vi.useFakeTimers()
    geolocationMock.getCurrentPosition.mockRejectedValueOnce(new Error('permission denied'))
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    useConfigStore.setState({
      callNumber: '13800138000',
      smsNumber: '13800138001',
      smsTemplate: 'SOS {lat},{lng}',
    })
    render(<SosPage />)

    fireEvent.click(screen.getByRole('button', { name: /触发 SOS/ }))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000)
    })
    await act(async () => undefined)

    expect(useSosStore.getState().sosResult.finalStatus).toBe('location-failed')
    expect(useSosStore.getState().sosResult.steps.location.tone).toBe('danger')
    expect(JSON.stringify(useSosStore.getState().history)).not.toContain('31.2304')
    expect(JSON.stringify(useSosStore.getState().history)).not.toContain('121.4737')
    expect(nativeActionsMock.triggerNativeSms).not.toHaveBeenCalled()
    expect(nativeActionsMock.triggerNativeCall).not.toHaveBeenCalled()
    expect(consoleError.mock.calls.some(([message]) => String(message).includes('Encountered two children with the same key'))).toBe(false)
    expect(screen.queryByRole('button', { name: '重新获取位置' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '仅拨号' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '仅短信' })).not.toBeInTheDocument()
  })

  it('renders tracking backlog as local pending data in tools', async () => {
    useTrackingStore.setState({ pendingCount: 3, queue: [queuedPoint, queuedPoint, queuedPoint] })

    render(<ToolsPage />)

    await screen.findByText('手动导出 / 不含手机号 / 不含精确坐标')
    expect(screen.getByText('3 待处理')).toBeInTheDocument()
    expect(screen.queryByText(/待补发/)).not.toBeInTheDocument()
  })

  it('keeps store and persistence consistent after writing mock tracking data', async () => {
    useTrackingStore.setState({
      enabled: true,
      intervalSeconds: 10,
      pendingCount: 1,
      lastCapturedAt: queuedPoint.timestamp,
      lastAcknowledgedAt: null,
      queue: [queuedPoint],
    })
    render(<ToolsPage />)
    await screen.findByText('手动导出 / 不含手机号 / 不含精确坐标')

    fireEvent.click(screen.getByRole('button', { name: '写入模拟轨迹' }))

    await waitFor(() => expect(useTrackingStore.getState().pendingCount).toBe(0))
    const state = useTrackingStore.getState()
    expect(state.enabled).toBe(false)
    expect(state.intervalSeconds).toBe(60)
    expect(state.queue).toEqual([])
    expect(state.lastCapturedAt).not.toBeNull()
    expect(state.lastAcknowledgedAt).toBe(state.lastCapturedAt)
    expect(state.history).toHaveLength(3)
    expect(state.history[0]).toMatchObject({ lat: 31.2304, lng: 121.4737 })

    const saved = JSON.parse(localStorage.getItem(TRACKING_STATE_KEY) ?? 'null')
    expect(saved).toEqual({
      enabled: false,
      intervalSeconds: 60,
      pendingCount: 0,
      lastCapturedAt: new Date(state.lastCapturedAt as number).toISOString(),
      lastAcknowledgedAt: new Date(state.lastAcknowledgedAt as number).toISOString(),
      nextRetryAt: null,
      queue: [],
      history: state.history,
    })
  })

  it('does not let an in-flight capture overwrite mock tracking data', async () => {
    let resolvePosition!: (position: { coords: { latitude: number; longitude: number; accuracy: number } }) => void
    geolocationMock.getCurrentPosition.mockReturnValueOnce(new Promise((resolve) => {
      resolvePosition = resolve
    }))
    useTrackingStore.setState({
      enabled: true,
      intervalSeconds: 10,
      pendingCount: 0,
      lastCapturedAt: null,
      lastAcknowledgedAt: null,
      queue: [],
    })
    const capture = useTrackingStore.getState().captureNow()
    await waitFor(() => expect(useTrackingStore.getState().busy).toBe(true))
    render(<ToolsPage />)

    fireEvent.click(screen.getByRole('button', { name: '写入模拟轨迹' }))
    await waitFor(() => expect(useTrackingStore.getState().intervalSeconds).toBe(60))

    await act(async () => {
      resolvePosition({ coords: { latitude: 35, longitude: 115, accuracy: 5 } })
      await capture
    })

    const state = useTrackingStore.getState()
    expect(state.enabled).toBe(false)
    expect(state.pendingCount).toBe(0)
    expect(state.queue).toEqual([])
    expect(state.history).toHaveLength(3)
    const saved = JSON.parse(localStorage.getItem(TRACKING_STATE_KEY) ?? 'null')
    expect(saved.queue).toEqual([])
    expect(JSON.stringify(saved.queue)).not.toContain('35')
  })
})
