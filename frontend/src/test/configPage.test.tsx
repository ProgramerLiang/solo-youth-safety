import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { ThemeProvider as MuiThemeProvider } from '@mui/material/styles'

const permissionMock = vi.hoisted(() => ({
  getStartupPermissionStatus: vi.fn(),
  requestStartupLocationPermission: vi.fn(),
  requestBackgroundRunPermission: vi.fn(),
  requestStorageAccessPermission: vi.fn(),
}))

vi.mock('../native/permissions', () => permissionMock)

import { ConfigPage } from '../pages/ConfigPage'
import { buildTheme } from '../theme/createTheme'
import { useGeofenceStore } from '../stores/useGeofenceStore'
import { useNotificationConfigStore } from '../stores/useNotificationConfigStore'

function emotionStyleText(): string {
  return Array.from(document.querySelectorAll('style[data-emotion]'))
    .map((style) => style.textContent ?? '')
    .join('\n')
}

function generatedClassNames(element: Element): string[] {
  return Array.from(element.classList).filter((className) => className.startsWith('css-'))
}

function hasGeneratedRule(element: Element, declarations: string[]): boolean {
  const styleText = emotionStyleText()
  return generatedClassNames(element).some((className) => {
    const selector = `.${className}`
    return declarations.every((declaration) => styleText.includes(selector) && styleText.includes(declaration))
  })
}

beforeEach(() => {
  vi.stubGlobal('__APP_VERSION__', '0.4.24-test')
  localStorage.clear()
  useGeofenceStore.setState({ zones: [], loaded: true })
  useNotificationConfigStore.setState({ config: null, loaded: false })
  permissionMock.getStartupPermissionStatus.mockResolvedValue({
    native: true,
    location: { state: 'denied', detail: '定位权限未授权' },
    backgroundRun: { state: 'manual', detail: '需要在系统设置中允许后台运行' },
    storage: { state: 'notRequired', detail: '当前 Android 版本导出无需广泛存储权限' },
  })
  permissionMock.requestStartupLocationPermission.mockResolvedValue({ state: 'granted', detail: '定位权限已授权' })
  permissionMock.requestBackgroundRunPermission.mockResolvedValue({ state: 'manual', detail: '已打开系统设置，请手动允许后台运行' })
  permissionMock.requestStorageAccessPermission.mockResolvedValue({ state: 'notRequired', detail: '当前 Android 版本导出无需广泛存储权限' })
})

afterEach(() => {
  vi.unstubAllGlobals()
  permissionMock.getStartupPermissionStatus.mockReset()
  permissionMock.requestStartupLocationPermission.mockReset()
  permissionMock.requestBackgroundRunPermission.mockReset()
  permissionMock.requestStorageAccessPermission.mockReset()
})

describe('ConfigPage version and config entry', () => {
  it('shows the unified app, Android artifact, snapshot, and storage version facts', async () => {
    vi.stubGlobal('__APP_VERSION__', '0.4.11-test')

    render(<ConfigPage />)
    await screen.findByText('定位权限')

    expect(screen.getByText('版本与配置')).toBeInTheDocument()
    expect(screen.getByText('前端 / Android')).toBeInTheDocument()
    expect(screen.getByText('v0.4.11-test')).toBeInTheDocument()
    expect(screen.getByText('本地快照')).toBeInTheDocument()
    expect(screen.getByText('跟随当前应用版本')).toBeInTheDocument()
    expect(screen.getByText('持久化')).toBeInTheDocument()
    expect(screen.getByText('localStorage (Web)')).toBeInTheDocument()
    expect(screen.getByText('远端后端')).toBeInTheDocument()
    expect(screen.getByText('未接入当前前端主线')).toBeInTheDocument()
    expect(screen.getByText('能力边界')).toBeInTheDocument()
    expect(screen.getByText('仅前台 / 应用存活期间')).toBeInTheDocument()
    expect(screen.getByText('后台 / 熄屏 / force-stop')).toBeInTheDocument()
    expect(screen.getByText('本轮真机正常，不承诺持续运行')).toBeInTheDocument()
  })
})

describe('ConfigPage theme contrast', () => {
  it('uses theme-aware colors for the SMS preview in dark mode', async () => {
    vi.stubGlobal('__APP_VERSION__', '0.4.11-test')
    const theme = buildTheme('dark', 'purple', null, null)

    render(
      <MuiThemeProvider theme={theme}>
        <ConfigPage />
      </MuiThemeProvider>,
    )
    await screen.findByText('定位权限')

    const previewText = screen.getByText(/\[SOS\]/)
    const previewBox = previewText.parentElement

    expect(previewBox).toHaveStyle({
      backgroundColor: theme.palette.action.hover,
      color: theme.palette.text.primary,
    })
  })

  it('keeps the phone configuration save button text explicit on hover', async () => {
    vi.stubGlobal('__APP_VERSION__', '0.4.11-test')
    const theme = buildTheme('light', 'purple', null, null)

    render(
      <MuiThemeProvider theme={theme}>
        <ConfigPage />
      </MuiThemeProvider>,
    )
    await screen.findByText('定位权限')

    const saveButton = screen.getByRole('button', { name: '保存' })
    const styleText = Array.from(document.querySelectorAll('style[data-emotion]'))
      .map((style) => style.textContent ?? '')
      .join('\n')
    const generatedClasses = Array.from(saveButton.classList).filter((className) => className.startsWith('css-'))

    expect(generatedClasses.some((className) => styleText.includes(`.${className}:hover`) && styleText.includes(`.${className}:hover{background-color:`) && styleText.includes(`.${className}:hover{`) && styleText.includes(`color:${theme.palette.getContrastText(theme.palette.primary.dark)}`))).toBe(true)
  })
})

describe('ConfigPage geofence layout', () => {
  it('keeps geofence inputs and saved-zone actions reachable on narrow screens', async () => {
    vi.stubGlobal('__APP_VERSION__', '0.4.21-test')
    useGeofenceStore.setState({
      loaded: true,
      zones: [{ id: 'zf-1', label: '非常长的家庭安全区域名称用于验证不会把删除按钮挤出屏幕', lat: 31.2304, lng: 121.4737, radiusM: 200 }],
    })

    render(<ConfigPage />)
    await screen.findByText('定位权限')

    const form = screen.getByTestId('geofence-form')
    const row = screen.getByTestId('geofence-zone-row-zf-1')
    expect(hasGeneratedRule(form, ['display:grid', 'grid-template-columns:repeat(auto-fit,minmax(148px,1fr))'])).toBe(true)
    expect(hasGeneratedRule(row, ['display:flex', 'flex-wrap:wrap'])).toBe(true)
    expect(screen.getByRole('button', { name: '添加围栏' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '删除' })).toBeInTheDocument()
  })
})

describe('ConfigPage first-run permission onboarding', () => {
  it('shows location, background run, and storage permission prompts on first-run config page', async () => {
    render(<ConfigPage />)

    expect(await screen.findByText('首次权限配置')).toBeInTheDocument()
    expect(screen.getByText('定位权限')).toBeInTheDocument()
    expect(screen.getByText('后台运行')).toBeInTheDocument()
    expect(screen.getByText('存储访问')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '申请定位权限' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '打开后台运行设置' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '检查存储访问' })).toBeInTheDocument()
    expect(screen.getByText('权限仅用于本地定位、SOS 与手动导出，不会自动上传数据。')).toBeInTheDocument()
  })

  it('requests system permissions from the first-run permission card', async () => {
    render(<ConfigPage />)
    await screen.findByText('首次权限配置')

    fireEvent.click(screen.getByRole('button', { name: '申请定位权限' }))
    fireEvent.click(screen.getByRole('button', { name: '打开后台运行设置' }))
    fireEvent.click(screen.getByRole('button', { name: '检查存储访问' }))

    await waitFor(() => expect(permissionMock.requestStartupLocationPermission).toHaveBeenCalledOnce())
    expect(permissionMock.requestBackgroundRunPermission).toHaveBeenCalledOnce()
    expect(permissionMock.requestStorageAccessPermission).toHaveBeenCalledOnce()
  })
})

describe('ConfigPage risk rule center', () => {
  it('shows local risk rules with editable thresholds', async () => {
    render(<ConfigPage />)

    expect(await screen.findByText('本地风险规则')).toBeInTheDocument()
    expect(screen.getByText('轨迹长时间间断')).toBeInTheDocument()
    expect(screen.getByText('高速移动')).toBeInTheDocument()
    expect(screen.getByText('SOS 附近轨迹')).toBeInTheDocument()
    expect(screen.getByLabelText('长间断阈值（分钟）')).toHaveValue(60)
    expect(screen.getByLabelText('高速阈值（km/h）')).toHaveValue(80)
    expect(screen.getByLabelText('SOS 距离阈值（米）')).toHaveValue(200)
  })

  it('saves local risk rule edits', async () => {
    render(<ConfigPage />)
    await screen.findByText('本地风险规则')

    fireEvent.change(screen.getByLabelText('长间断阈值（分钟）'), { target: { value: '120' } })
    fireEvent.click(screen.getByRole('button', { name: '保存风险规则' }))

    expect(await screen.findByText('风险规则已保存')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('长间断阈值（分钟）'), { target: { value: '90' } })
    expect(screen.queryByText('风险规则已保存')).not.toBeInTheDocument()
  })
})

describe('ConfigPage local notifications', () => {
  it('shows local notification controls and safety boundary copy', async () => {
    render(<ConfigPage />)

    expect(await screen.findByText('本地通知')).toBeInTheDocument()
    expect(screen.getByLabelText('启用本地通知')).toBeChecked()
    expect(screen.getByLabelText('行程超时提醒')).toBeChecked()
    expect(screen.getByLabelText('风险变化提醒')).toBeChecked()
    expect(screen.getByLabelText('行程通知提前时间（分钟）')).toHaveValue('5')
    expect(screen.getByText('通知仅为本机提醒，不承诺后台、熄屏或 force-stop 后送达。')).toBeInTheDocument()
  })

  it('persists local notification edits', async () => {
    render(<ConfigPage />)
    await screen.findByText('本地通知')

    fireEvent.click(screen.getByLabelText('启用本地通知'))
    fireEvent.change(screen.getByLabelText('行程通知提前时间（分钟）'), { target: { value: '10' } })

    await waitFor(() => expect(useNotificationConfigStore.getState().config?.enabled).toBe(false))
    expect(useNotificationConfigStore.getState().config?.tripExpiring.leadMinutes).toBe(10)
  })
})
