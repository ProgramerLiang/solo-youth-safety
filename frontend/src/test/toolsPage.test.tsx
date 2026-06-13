import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { ToolsPage } from '../pages/ToolsPage'
import { useDevModeStore } from '../stores/useDevModeStore'
import type { DiagnosticReport } from '../data/diagnostics'

function sampleReport(): DiagnosticReport {
  return {
    schemaVersion: 1,
    app: { version: '0.4.22', exportedAt: '2026-06-11T01:02:03.000Z' },
    storage: { driver: 'localStorage (Web)' },
    config: { hasCallNumber: true, hasSmsNumber: true, hasSmsTemplate: true, onboardingDone: true },
    localData: {
      contacts: { count: 1 },
      sosHistory: { count: 0 },
      tracking: {
        enabled: true,
        intervalSeconds: 60,
        pendingCount: 12,
        queueCount: 12,
        historyCount: 20,
        lastCapturedAt: '2026-06-11T01:00:00.000Z',
        lastAcknowledgedAt: null,
        nextRetryAt: null,
      },
    },
    theme: { mode: 'dark', paletteMode: 'preset', presetId: 'green', hasCustomSeed: false, dynamicColorSupported: true, dynamicColorSource: 'android-bridge' },
    location: {
      native: true,
      bridge: 'system-location-manager',
      permissions: { fine: 'granted', coarse: 'granted' },
      providers: { gps: true, network: false },
      device: { sdkInt: 34, brand: 'Xiaomi', manufacturer: 'Xiaomi', model: '23013RK75C' },
      lastAttempt: { strategy: 'coarse-cached', success: true, error: null },
    },
    privacy: { manualExportOnly: true, includesExactCoordinates: false, includesContactPhones: false },
  }
}


beforeEach(() => {
  vi.stubGlobal('URL', {
    createObjectURL: vi.fn(() => 'blob:mock-url'),
    revokeObjectURL: vi.fn(),
  })
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})
describe('ToolsPage diagnostics', () => {
  it('shows a manual diagnostic export entry and current summary in developer mode', async () => {
    useDevModeStore.setState({ enabled: true, tapProgress: 0, loaded: true })

    render(<ToolsPage />)

    expect(screen.getByRole('button', { name: '导出诊断报告' })).toBeInTheDocument()
    expect(screen.getByText('诊断报告只保存在本机，由用户手动导出，不会自动上传。')).toBeInTheDocument()
    expect(await screen.findByText('诊断摘要')).toBeInTheDocument()
    expect(screen.getByText('隐私')).toBeInTheDocument()
    expect(screen.getByText('手动导出 / 不含手机号 / 不含精确坐标')).toBeInTheDocument()
  })

  it('shows the download directory hint after exporting a snapshot', async () => {
    useDevModeStore.setState({ enabled: true, tapProgress: 0, loaded: true })

    render(<ToolsPage />)
    await screen.findByText('手动导出 / 不含手机号 / 不含精确坐标')

    fireEvent.click(screen.getByRole('button', { name: '导出快照' }))

    expect(await screen.findByText('快照已导出，请到系统“下载/Downloads”目录或浏览器下载记录查看。')).toBeInTheDocument()
  })

  it('shows the download directory hint after exporting diagnostics', async () => {
    useDevModeStore.setState({ enabled: true, tapProgress: 0, loaded: true })

    render(<ToolsPage />)
    await screen.findByText('手动导出 / 不含手机号 / 不含精确坐标')

    fireEvent.click(screen.getByRole('button', { name: '导出诊断报告' }))

    expect(await screen.findByText('诊断报告已导出，请到系统“下载/Downloads”目录或浏览器下载记录查看。')).toBeInTheDocument()
  })

  it('parses pasted diagnostic JSON into readable facts and issues', async () => {
    useDevModeStore.setState({ enabled: true, tapProgress: 0, loaded: true })

    render(<ToolsPage />)
    await screen.findByText('手动导出 / 不含手机号 / 不含精确坐标')

    fireEvent.change(screen.getByLabelText('粘贴诊断 JSON'), { target: { value: JSON.stringify(sampleReport()) } })
    fireEvent.click(screen.getByRole('button', { name: '解析诊断 JSON' }))

    expect(screen.getByText('外部诊断解析')).toBeInTheDocument()
    expect(screen.getByText('Xiaomi 23013RK75C · Android SDK 34')).toBeInTheDocument()
    expect(screen.getByText('GPS 开启 / Network 关闭')).toBeInTheDocument()
    expect(screen.getByText('Network Provider 不可用')).toBeInTheDocument()
    expect(screen.getByText('本地轨迹待确认较多')).toBeInTheDocument()
  })

  it('shows a safe parse error for invalid diagnostic JSON', async () => {
    useDevModeStore.setState({ enabled: true, tapProgress: 0, loaded: true })

    render(<ToolsPage />)
    await screen.findByText('手动导出 / 不含手机号 / 不含精确坐标')

    fireEvent.change(screen.getByLabelText('粘贴诊断 JSON'), { target: { value: '{bad' } })
    fireEvent.click(screen.getByRole('button', { name: '解析诊断 JSON' }))

    expect(screen.getByText('诊断报告不是有效 JSON')).toBeInTheDocument()
  })
})
