import { useEffect, useMemo, useRef, useState } from 'react'
import {
  checkHealth,
  clearLocalBackendData,
  createContact,
  createTrackingPoints,
  deleteContact,
  exportLocalBackendBundle,
  getEmergencyConfig,
  getLocalBackendSnapshot,
  getTrackingTimeline,
  importLocalBackendBundle,
  isLocalBackendMode,
  listContacts,
  listSosEvents,
  saveEmergencyConfig,
  triggerSos,
  updateContact,
} from './api'
import { isNativePlatform, triggerNativeEmergency } from './nativeActions'
import { refreshCurrentLocation, requestInitialPermissions } from './permissions'
import {
  applyThemeState,
  buildThemeState,
  loadDynamicThemeInfo,
  presetPalettes,
  readThemePreferences,
  writeThemePreferences,
} from './theme'
import { getPersistedIdentity, savePersistedIdentity } from './identity'
import {
  clearTrackingData,
  createTrackingPointFromLocation,
  enqueueTrackingPoint,
  flushPendingTracking,
  getTrackingSnapshot,
  recordTrackingError,
  trackingIntervalOptions,
  updateTrackingPreferences,
} from './tracking'
import {
  getStorageDriverLabel,
  readStoredJson,
  readStoredString,
  removeStoredValue,
  writeStoredJson,
  writeStoredString,
} from './storage'

const defaultTemplate = '[SOS] 用户{userId}触发报警，位置({lat},{lng}) 时间:{time}'
const compactTemplate = '[SOS]{time} {userId} @({lat},{lng})'
const configVersion = '1.0'
const cacheKey = 'safety_emergency_config_v1'
const onboardingKey = 'safety_onboarding_done_v1'
const developerModeKey = 'safety_developer_mode_v1'
const appVersion = __APP_VERSION__
const previewFallbackLocation = { lat: 31.2304, lng: 121.4737, accuracy: 12 }
const freshLocationThresholdMs = 30 * 1000
const staleLocationThresholdMs = 2 * 60 * 1000
const pageCatalog = [
  {
    id: 'overview',
    label: '总览',
    title: '状态总览',
    description: '先看当前状态，再进入具体功能页。',
  },
  {
    id: 'theme',
    label: '主题',
    title: 'Material 动态主题',
    description: '支持壁纸吸色、预设调色板与自定义配色。',
  },
  {
    id: 'config',
    label: '通知配置',
    title: '紧急通知配置',
    description: '设置号码、短信模板与配置导入导出。',
  },
  {
    id: 'contacts',
    label: '联系人',
    title: '紧急联系人管理',
    description: '新增、编辑、删除联系人，并一键填入号码。',
  },
  {
    id: 'sos',
    label: 'SOS',
    title: '一键求助',
    description: '执行 5 秒倒计时报警，并直接发送短信 / 发起拨号。',
  },
  {
    id: 'history',
    label: '历史',
    title: 'SOS 历史记录',
    description: '查看每次事件的时间、位置与通知结果。',
  },
  {
    id: 'tools',
    label: '工具',
    title: '本地数据与自检',
    description: '查看本地后端数据、快照与调试验证能力。',
  },
]
const drawerOpenSwipeThreshold = 72
const drawerCloseSwipeThreshold = 56
const drawerDragActivatePx = 10
const drawerPreviewCommitRatio = 0.35
const drawerEdgeFallbackPx = 48
const drawerScrimMaxOpacity = 0.32

function readJsonCache(key) {
  return readStoredJson(key)
}

async function writeJsonCache(key, value) {
  await writeStoredJson(key, value)
}

function downloadJsonFile(filename, payload) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: 'application/json',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function isPointInsideElement(x, y, element) {
  if (!element) {
    return false
  }
  const rect = element.getBoundingClientRect()
  return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom
}

function canStartDrawerOpenGesture(touch, mainElement) {
  if (!mainElement) {
    return typeof window === 'undefined'
      ? true
      : touch.clientX <= Math.max(drawerEdgeFallbackPx, window.innerWidth * 0.16)
  }
  if (!isPointInsideElement(touch.clientX, touch.clientY, mainElement)) {
    return true
  }
  return touch.clientX <= Math.max(drawerEdgeFallbackPx, window.innerWidth * 0.12)
}

function isDrawerGestureBlockedTarget(target) {
  if (!(target instanceof Element)) {
    return false
  }
  return Boolean(
    target.closest(
      'button, input, textarea, select, a, label, summary, [role="button"], [data-no-drawer-swipe="true"]'
    )
  )
}

function getDrawerWidth(element) {
  const width = element?.getBoundingClientRect?.().width
  return Number.isFinite(width) && width > 0 ? Math.max(280, Math.round(width)) : 320
}

function clampDrawerOffset(offset, drawerWidth) {
  return Math.min(0, Math.max(offset, -drawerWidth))
}

function getDrawerProgress(offset, drawerWidth) {
  if (!drawerWidth) {
    return 0
  }
  return 1 - Math.min(Math.abs(offset) / drawerWidth, 1)
}

function toPayloadLocation(location) {
  if (!location) {
    return null
  }
  return {
    lat: Number(location.lat),
    lng: Number(location.lng),
    accuracy: Number.isFinite(Number(location.accuracy)) ? Number(location.accuracy) : 12,
  }
}

function createSosPayload(userId, deviceId, location) {
  const safeLocation = toPayloadLocation(location)
  if (!safeLocation) {
    return null
  }
  return {
    userId,
    deviceId,
    triggerType: 'manual',
    timestamp: new Date().toISOString(),
    location: safeLocation,
  }
}

function createPreviewSosPayload(userId, deviceId, location) {
  return (
    createSosPayload(userId, deviceId, location) ||
    createSosPayload(userId, deviceId, previewFallbackLocation)
  )
}

function renderTemplate(template, payload) {
  return template
    .replaceAll('{userId}', payload.userId)
    .replaceAll('{deviceId}', payload.deviceId)
    .replaceAll('{lat}', String(payload.location.lat))
    .replaceAll('{lng}', String(payload.location.lng))
    .replaceAll('{time}', payload.timestamp)
}

function getValidationHints(form) {
  const hints = []
  const callEmpty = !form.callNumber.trim()
  const smsEmpty = !form.smsNumber.trim()
  if (callEmpty && smsEmpty) {
    hints.push('当前电话与短信号码都为空：SOS 仅会上报后端，不会执行直接短信或拨号。')
  }
  if (!form.smsTemplate.trim()) {
    hints.push('短信模板为空时将自动回退默认模板。')
  }
  if (!form.smsTemplate.includes('{time}')) {
    hints.push('建议模板包含 {time}，方便联系人判断警情时刻。')
  }
  return hints
}

function formatLogs(serverData, nativeLogs) {
  const serverLines = serverData.notifications.map(
    (n) => `server/${n.channel}: ${n.status} (${n.detail})`
  )
  const nativeLines = nativeLogs.map(
    (n) => `native/${n.channel}: ${n.status} (${n.detail})`
  )
  return ['SOS 已上报', ...serverLines, ...nativeLines].join('\n')
}

function parseImportedConfig(raw) {
  const data = JSON.parse(raw)
  if (!data || typeof data !== 'object') {
    throw new Error('配置格式无效')
  }
  if (data.version !== configVersion) {
    throw new Error(`配置版本不匹配，期望 ${configVersion}`)
  }
  if (typeof data.userId !== 'string' || !data.userId.trim()) {
    throw new Error('缺少 userId')
  }
  if (typeof data.smsTemplate !== 'string') {
    throw new Error('smsTemplate 必须为字符串')
  }
  return {
    userId: data.userId,
    callNumber: typeof data.callNumber === 'string' ? data.callNumber : '',
    smsNumber: typeof data.smsNumber === 'string' ? data.smsNumber : '',
    smsTemplate: data.smsTemplate || defaultTemplate,
  }
}

function buildImportSummary(config) {
  return {
    userId: config.userId,
    hasCallNumber: Boolean(config.callNumber.trim()),
    hasSmsNumber: Boolean(config.smsNumber.trim()),
    templateLength: config.smsTemplate.length,
  }
}

function buildDiffHints(current, incoming) {
  const hints = []
  if (current.userId !== incoming.userId) {
    hints.push(`userId: ${current.userId} → ${incoming.userId}`)
  }
  if (current.callNumber !== incoming.callNumber) {
    hints.push(`callNumber: ${current.callNumber || '空'} → ${incoming.callNumber || '空'}`)
  }
  if (current.smsNumber !== incoming.smsNumber) {
    hints.push(`smsNumber: ${current.smsNumber || '空'} → ${incoming.smsNumber || '空'}`)
  }
  if (current.smsTemplate !== incoming.smsTemplate) {
    hints.push(
      `smsTemplate 长度: ${current.smsTemplate.length} → ${incoming.smsTemplate.length}`
    )
  }
  return hints
}

function createEmptyForm(userId = getPersistedIdentity().userId) {
  return {
    userId,
    callNumber: '',
    smsNumber: '',
    smsTemplate: defaultTemplate,
  }
}

function createEmptyContactForm() {
  return {
    name: '',
    phone: '',
  }
}

function formatPanelTime(value) {
  if (!value) {
    return '暂无'
  }
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString()
}

function formatLocationText(location) {
  if (!location) {
    return '未获取'
  }
  return `${location.lat}, ${location.lng} / ±${location.accuracy ?? 12}m`
}

function formatRelativeDuration(ms) {
  const seconds = Math.max(1, Math.round(ms / 1000))
  if (seconds < 60) {
    return `${seconds} 秒`
  }
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) {
    return `${minutes} 分钟`
  }
  const hours = Math.round(minutes / 60)
  return `${hours} 小时`
}

function buildLocationFreshness(location, now = Date.now()) {
  if (!location?.capturedAt) {
    return {
      label: '未获取',
      hint: '建议先刷新当前位置',
      updatedAt: '暂无',
      needsRefresh: true,
      canUse: false,
      banner: '当前位置尚未获取，SOS 倒计时结束时会先尝试刷新；若仍失败，将取消上报。',
    }
  }

  const capturedAt = new Date(location.capturedAt)
  if (Number.isNaN(capturedAt.getTime())) {
    return {
      label: '时间未知',
      hint: '已获取位置，但刷新时间不可用',
      updatedAt: location.capturedAt,
      needsRefresh: false,
      canUse: true,
      banner: '',
    }
  }

  const ageMs = Math.max(0, now - capturedAt.getTime())
  if (ageMs <= freshLocationThresholdMs) {
    return {
      label: '刚刷新',
      hint: `${formatRelativeDuration(ageMs)}前更新，可直接用于 SOS`,
      updatedAt: formatPanelTime(location.capturedAt),
      needsRefresh: false,
      canUse: true,
      banner: '',
    }
  }

  if (ageMs <= staleLocationThresholdMs) {
    return {
      label: '较新',
      hint: `${formatRelativeDuration(ageMs)}前更新，仍可使用`,
      updatedAt: formatPanelTime(location.capturedAt),
      needsRefresh: false,
      canUse: true,
      banner: '',
    }
  }

  return {
    label: '偏旧',
    hint: `已超过 ${formatRelativeDuration(ageMs)} 未刷新，建议先更新位置`,
    updatedAt: formatPanelTime(location.capturedAt),
    needsRefresh: true,
    canUse: true,
    banner: '当前位置已偏旧，SOS 倒计时结束时会先尝试刷新；若刷新失败，将继续使用这次旧位置。',
  }
}

function createMockContactPayload(userId, count) {
  const index = count + 1
  return {
    userId,
    contact: {
      name: `测试联系人${index}`,
      phone: `1380000${String(index).padStart(4, '0')}`,
    },
  }
}

function createMockTrackingPayload(userId, deviceId, location, count) {
  const base = location ?? { lat: 31.2304, lng: 121.4737, accuracy: 12 }
  const offset = (count + 1) * 0.0005
  return {
    userId,
    deviceId,
    points: [
      {
        lat: Number((base.lat + offset).toFixed(6)),
        lng: Number((base.lng + offset).toFixed(6)),
        accuracy: base.accuracy ?? 12,
        speed: 0.8,
        heading: 90,
        timestamp: new Date().toISOString(),
      },
    ],
  }
}

function buildContactsPreview(data) {
  return {
    count: data.contacts.length,
    items: data.contacts.slice(-3).reverse(),
  }
}

function buildTrackingPreview(data) {
  return {
    count: data.count,
    items: data.points.slice(-3).reverse(),
  }
}

function buildLocalBundleSummary(bundle) {
  return {
    userId: typeof bundle?.userId === 'string' ? bundle.userId : getPersistedIdentity().userId,
    hasConfig: Boolean(bundle?.config),
    contactsCount: Array.isArray(bundle?.contacts) ? bundle.contacts.length : 0,
    trackingCount: Array.isArray(bundle?.trackingPoints) ? bundle.trackingPoints.length : 0,
    sosCount: Array.isArray(bundle?.sosEvents) ? bundle.sosEvents.length : 0,
  }
}

function summarizeNotifications(notifications = []) {
  return notifications.map((item) => `${item.channel}:${item.status}`).join(' / ') || '暂无通知记录'
}

function buildTrackingStatusHint(snapshot) {
  if (snapshot.lastError) {
    return `最近失败：${snapshot.lastError}`
  }
  if (snapshot.pendingCount > 0) {
    return `待补发 ${snapshot.pendingCount} 条，下一次重试 ${formatPanelTime(snapshot.nextRetryAt)}`
  }
  if (snapshot.lastSyncedAt) {
    return `最近同步 ${formatPanelTime(snapshot.lastSyncedAt)}`
  }
  return '开启后会按周期采样位置，并在弱网恢复后自动补发。'
}

function buildTrackingResultMessage({ captured, sentCount, snapshot, skippedReason = '' }) {
  const parts = []
  if (captured) {
    parts.push('已采样 1 个位置点')
  }
  if (sentCount > 0) {
    parts.push(`已成功写入 ${sentCount} 条轨迹`)
  }
  if (!captured && skippedReason) {
    parts.push(skippedReason)
  }
  if (snapshot.pendingCount > 0) {
    parts.push(`仍有 ${snapshot.pendingCount} 条待补发`)
  }
  if (snapshot.lastError) {
    parts.push(`最近失败：${snapshot.lastError}`)
  }
  return parts.join('；') || '轨迹状态已刷新'
}

function SummaryCard({ label, value, hint }) {
  return (
    <article className="md-summary-card">
      <span className="md-summary-label">{label}</span>
      <strong className="md-summary-value">{value}</strong>
      {hint ? <span className="md-summary-hint">{hint}</span> : null}
    </article>
  )
}

function PageButton({ page, active, onClick }) {
  return (
    <button type="button" className={`md-nav-item ${active ? 'active' : ''}`} onClick={onClick}>
      <strong>{page.label}</strong>
      <span>{page.description}</span>
    </button>
  )
}

function SidebarContent({
  currentPage,
  developerModeEnabled,
  envText,
  healthText,
  identity,
  latestLocation,
  locationFreshness,
  onboardingDone,
  pageItems,
  permissionText,
  showToolsPage,
  themeState,
  userId,
  onClose,
  onNavigate,
  onVersionChipClick,
}) {
  const statusItems = [
    ['引导', onboardingDone ? '已完成' : '待完成'],
    ['定位状态', permissionText],
    ['后端', healthText],
    ['位置', formatLocationText(latestLocation)],
    ['新鲜度', locationFreshness.label],
    ['最近刷新', locationFreshness.updatedAt],
    ['当前页面', currentPage.label],
    ['主题', themeState.label],
    ['设备 ID', identity.deviceId],
    ['开发者模式', developerModeEnabled ? '已开启' : '已隐藏'],
  ]

  return (
    <>
      <section className="md-brand">
        <div className="md-drawer-head">
          <div>
            <p className="md-page-label">独行青年安全守护</p>
            <h1>抽屉侧边栏 MVP</h1>
          </div>
          <button type="button" className="md-drawer-close" onClick={onClose} aria-label="关闭侧边栏">
            ✕
          </button>
        </div>
        <p className="md-brand-copy">可通过左上角按钮或在页面空白处从左向右滑动，呼出侧边栏切换页面。</p>
        <div className="md-chip-row">
          <span className="md-chip">{envText}</span>
          <button type="button" className="md-chip subtle md-chip-button" onClick={onVersionChipClick}>
            v{appVersion}
          </button>
          <span className="md-chip subtle">用户 {userId}</span>
          <span className={`md-chip ${showToolsPage ? 'subtle' : ''}`}>
            {showToolsPage ? '本地后端' : '远端后端'}
          </span>
        </div>
      </section>

      {!onboardingDone && <div className="md-banner">首次使用：请先进入“通知配置”完成设置。</div>}

      <nav className="md-nav">
        {pageItems.map((page) => (
          <PageButton
            key={page.id}
            page={page}
            active={page.id === currentPage.id}
            onClick={() => onNavigate(page.id)}
          />
        ))}
      </nav>

      <section className="md-sidebar-status">
        <div className="md-section-head">
          <h3>当前状态</h3>
          <span className="md-chip subtle">概要</span>
        </div>
        <div className="md-status-stack">
          {statusItems.map(([label, value]) => (
            <div key={label} className="md-status-item">
              <span>{label}</span>
              <strong>{value}</strong>
            </div>
          ))}
        </div>
      </section>
    </>
  )
}

function TrackingGuardSection({
  trackingBusy,
  trackingSnapshot,
  onRunTrackingNow,
  onToggleTracking,
  onTrackingIntervalChange,
}) {
  return (
    <section className="md-section-card md-tracking-section">
      <div className="md-section-head">
        <h3>轨迹守护</h3>
        <span className={`md-chip ${trackingSnapshot.enabled ? '' : 'subtle'}`}>
          {trackingSnapshot.enabled ? '已开启' : '已关闭'}
        </span>
      </div>
      <p className="md-section-hint">开启后会按设定周期采样当前位置并写入轨迹；若写入失败，将进入本地队列并在稍后自动补发。</p>
      <div className="md-summary-grid">
        <div className="md-kv-item">
          <span>采样周期</span>
          <strong>{trackingSnapshot.intervalSeconds} 秒</strong>
        </div>
        <div className="md-kv-item">
          <span>待补发</span>
          <strong>{trackingSnapshot.pendingCount} 条</strong>
        </div>
        <div className="md-kv-item">
          <span>最近采样</span>
          <strong>{formatPanelTime(trackingSnapshot.lastCapturedAt)}</strong>
        </div>
        <div className="md-kv-item">
          <span>最近同步</span>
          <strong>{formatPanelTime(trackingSnapshot.lastSyncedAt)}</strong>
        </div>
      </div>
      <label className="md-inline-field">
        <span>自动采样周期</span>
        <select value={trackingSnapshot.intervalSeconds} onChange={onTrackingIntervalChange}>
          {trackingIntervalOptions.map((seconds) => (
            <option key={seconds} value={seconds}>
              {seconds} 秒
            </option>
          ))}
        </select>
      </label>
      <div className="md-row-actions">
        <button type="button" className="md-btn" onClick={onToggleTracking} disabled={trackingBusy}>
          {trackingSnapshot.enabled ? '停止周期轨迹' : '开启周期轨迹'}
        </button>
        <button
          type="button"
          className="md-btn tonal"
          onClick={onRunTrackingNow}
          disabled={trackingBusy}
        >
          {trackingBusy ? '轨迹处理中...' : '立即采样并补发'}
        </button>
      </div>
      <div className="md-helper">
        <p>{buildTrackingStatusHint(trackingSnapshot)}</p>
      </div>
    </section>
  )
}

function OverviewPage({
  contactsList,
  deviceId,
  form,
  healthText,
  latestLocation,
  localPanel,
  locationFreshness,
  locationRefreshing,
  onboardingDone,
  pages,
  permissionText,
  sosHistory,
  storageDriver,
  themeState,
  trackingBusy,
  trackingSnapshot,
  onCheckHealth,
  onNavigate,
  onRefreshLocation,
  onResetOnboarding,
  onRunTrackingNow,
  onToggleTracking,
  onTrackingIntervalChange,
  showToolsPage,
}) {
  const latestSosEvent = sosHistory[0] || null

  return (
    <div className="md-page-stack">
      <section className="md-summary-grid">
        <SummaryCard
          label="引导状态"
          value={onboardingDone ? '已完成' : '待完成'}
          hint={onboardingDone ? '可直接进入 SOS' : '建议先完成配置'}
        />
        <SummaryCard
          label="通知通道"
          value={`${form.callNumber.trim() ? 1 : 0}/${form.smsNumber.trim() ? 1 : 0} 已配置`}
          hint="电话 / 短信"
        />
        <SummaryCard
          label="联系人"
          value={`${contactsList.length} 人`}
          hint={contactsList.length > 0 ? '可一键填入配置' : '建议至少维护 1 人'}
        />
        <SummaryCard
          label="SOS 历史"
          value={`${sosHistory.length} 条`}
          hint={latestSosEvent ? formatPanelTime(latestSosEvent.timestamp) : '暂无事件'}
        />
        <SummaryCard
          label="位置新鲜度"
          value={locationFreshness.label}
          hint={locationFreshness.hint}
        />
        <SummaryCard
          label="轨迹守护"
          value={trackingSnapshot.enabled ? '已开启' : '已关闭'}
          hint={buildTrackingStatusHint(trackingSnapshot)}
        />
      </section>

      <div className="md-overview-grid">
        <section className="md-section-card">
          <div className="md-section-head">
            <h3>快捷入口</h3>
            <span className="md-chip">多页面导航</span>
          </div>
          <p className="md-section-hint">已按配置、联系人、SOS、历史、自检拆分页面，减少单页堆叠。</p>
          <div className="md-quick-grid">
            {pages
              .filter((page) => page.id !== 'overview')
              .map((page) => (
                <button
                  key={page.id}
                  type="button"
                  className="md-quick-card"
                  onClick={() => onNavigate(page.id)}
                >
                  <strong>{page.label}</strong>
                  <span>{page.description}</span>
                </button>
              ))}
          </div>
        </section>

        <section className="md-section-card">
          <div className="md-section-head">
            <h3>设备状态</h3>
            <span className={`md-chip ${showToolsPage ? 'subtle' : ''}`}>
              {showToolsPage ? '本地后端' : '远端后端'}
            </span>
          </div>
          <div className="md-kv-list">
            <div className="md-kv-item">
              <span>定位状态</span>
              <strong>{permissionText}</strong>
            </div>
            <div className="md-kv-item">
              <span>后端健康</span>
              <strong>{healthText}</strong>
            </div>
            <div className="md-kv-item">
              <span>当前位置</span>
              <strong>{formatLocationText(latestLocation)}</strong>
            </div>
            <div className="md-kv-item">
              <span>位置新鲜度</span>
              <strong>{locationFreshness.label}</strong>
            </div>
            <div className="md-kv-item">
              <span>最近刷新</span>
              <strong>{locationFreshness.updatedAt}</strong>
            </div>
            <div className="md-kv-item">
              <span>最近 SOS</span>
              <strong>{latestSosEvent ? formatPanelTime(latestSosEvent.timestamp) : '暂无'}</strong>
            </div>
            <div className="md-kv-item">
              <span>持久化存储</span>
              <strong>{storageDriver}</strong>
            </div>
          </div>
          <div className="md-row-actions">
            <button
              type="button"
              className="md-btn tonal"
              onClick={onRefreshLocation}
              disabled={locationRefreshing}
            >
              {locationRefreshing ? '刷新位置中...' : '刷新当前位置'}
            </button>
            <button type="button" className="md-btn tonal" onClick={onCheckHealth}>
              检查后端
            </button>
            <button type="button" className="md-btn tonal" onClick={onResetOnboarding}>
              重置引导
            </button>
          </div>
        </section>

        <TrackingGuardSection
          trackingBusy={trackingBusy}
          trackingSnapshot={trackingSnapshot}
          onRunTrackingNow={onRunTrackingNow}
          onToggleTracking={onToggleTracking}
          onTrackingIntervalChange={onTrackingIntervalChange}
        />

        <section className="md-section-card">
          <div className="md-section-head">
            <h3>当前配置摘要</h3>
            <span className="md-chip subtle">{form.userId}</span>
          </div>
          <div className="md-kv-list">
            <div className="md-kv-item">
              <span>电话号码</span>
              <strong>{form.callNumber.trim() || '未设置'}</strong>
            </div>
            <div className="md-kv-item">
              <span>短信号码</span>
              <strong>{form.smsNumber.trim() || '未设置'}</strong>
            </div>
            <div className="md-kv-item">
              <span>模板长度</span>
              <strong>{(form.smsTemplate || defaultTemplate).length} 字符</strong>
            </div>
            <div className="md-kv-item">
              <span>本地数据</span>
              <strong>{localPanel ? `SOS ${localPanel.sosCount} / 轨迹 ${localPanel.trackingCount}` : '未启用'}</strong>
            </div>
            <div className="md-kv-item">
              <span>设备标识</span>
              <strong>{deviceId}</strong>
            </div>
          </div>
          <div className="md-row-actions">
            <button
              type="button"
              className="md-btn"
              onClick={() => onNavigate(onboardingDone ? 'sos' : 'config')}
            >
              {onboardingDone ? '前往 SOS' : '完成配置'}
            </button>
            <button type="button" className="md-btn tonal" onClick={() => onNavigate('history')}>
              查看历史
            </button>
          </div>
        </section>
      </div>
    </div>
  )
}

function ThemePage({
  themeState,
  onCustomSeedChange,
  onPresetChange,
  onThemeModeChange,
}) {
  const dynamicSupported = themeState.dynamicInfo.supported

  return (
    <div className="md-page-stack">
      <section className="md-summary-grid">
        <SummaryCard
          label="当前主题"
          value={themeState.label}
          hint={`主色 ${themeState.seedColor}`}
        />
        <SummaryCard
          label="壁纸吸色"
          value={dynamicSupported ? '已支持' : '当前设备不支持'}
          hint={dynamicSupported ? themeState.dynamicInfo.source : 'Android 12+ 可用'}
        />
        <SummaryCard label="APK 版本" value={appVersion} hint="从此版本开始使用 0.x.x 迭代" />
        <SummaryCard
          label="当前模式"
          value={
            themeState.preferences.mode === 'dynamic'
              ? '壁纸吸色'
              : themeState.preferences.mode === 'custom'
                ? '自定义'
                : '预设'
          }
          hint="修改后立即生效并持久化"
        />
      </section>

      <div className="md-overview-grid">
        <section className="md-section-card md-theme-section">
          <div className="md-section-head">
            <h3>主题模式</h3>
            <span className="md-chip">Material Design</span>
          </div>
          <p className="md-section-hint">在支持的 Android 设备上默认跟随壁纸吸色，也可随时切换到预设或自定义调色板。</p>
          <div className="md-theme-mode-grid">
            <button
              type="button"
              className={`md-theme-option ${themeState.preferences.mode === 'dynamic' ? 'active' : ''}`}
              onClick={() => onThemeModeChange('dynamic')}
              disabled={!dynamicSupported}
            >
              <strong>壁纸吸色</strong>
              <span>{dynamicSupported ? '默认启用，跟随系统 Material You' : '当前设备不支持'}</span>
            </button>
            <button
              type="button"
              className={`md-theme-option ${themeState.preferences.mode === 'preset' ? 'active' : ''}`}
              onClick={() => onThemeModeChange('preset')}
            >
              <strong>预设调色板</strong>
              <span>提供多组稳定配色，适合统一演示风格</span>
            </button>
            <button
              type="button"
              className={`md-theme-option ${themeState.preferences.mode === 'custom' ? 'active' : ''}`}
              onClick={() => onThemeModeChange('custom')}
            >
              <strong>自定义调色板</strong>
              <span>选择自己的主色，立即重算 Material 色阶</span>
            </button>
          </div>
        </section>

        <section className="md-section-card md-theme-section">
          <div className="md-section-head">
            <h3>调色板选择</h3>
            <span className="md-chip subtle">实时预览</span>
          </div>
          <div className="md-theme-palette-grid">
            {presetPalettes.map((palette) => (
              <button
                key={palette.id}
                type="button"
                className={`md-palette-card ${themeState.preferences.presetId === palette.id ? 'active' : ''}`}
                onClick={() => onPresetChange(palette.id)}
              >
                <span
                  className="md-color-dot"
                  style={{ backgroundColor: palette.seed }}
                  aria-hidden="true"
                />
                <strong>{palette.label}</strong>
                <span>{palette.seed}</span>
              </button>
            ))}
          </div>

          <label htmlFor="customSeed" className="md-theme-custom-label">
            自定义主色
          </label>
          <div className="md-theme-custom-row">
            <input
              id="customSeed"
              type="color"
              value={themeState.preferences.customSeed}
              onChange={onCustomSeedChange}
              className="md-color-input"
            />
            <div className="md-readonly-field">
              <span>当前自定义颜色</span>
              <strong>{themeState.preferences.customSeed}</strong>
            </div>
          </div>
        </section>
      </div>

      <section className="md-section-card md-theme-preview-card">
        <div className="md-section-head">
          <h3>当前主题预览</h3>
          <span className="md-chip subtle">v{appVersion}</span>
        </div>
        <div className="md-theme-preview-grid">
          <div
            className="md-theme-preview-block"
            style={{
              backgroundColor: themeState.palette.primary,
              color: themeState.palette.onPrimary,
            }}
          >
            <span style={{ color: themeState.palette.onPrimary }}>Primary</span>
            <strong style={{ color: themeState.palette.onPrimary }}>{themeState.palette.primary}</strong>
          </div>
          <div
            className="md-theme-preview-block"
            style={{
              backgroundColor: themeState.palette.primaryContainer,
              color: themeState.palette.onPrimaryContainer,
            }}
          >
            <span style={{ color: themeState.palette.onPrimaryContainer }}>Primary Container</span>
            <strong style={{ color: themeState.palette.onPrimaryContainer }}>
              {themeState.palette.primaryContainer}
            </strong>
          </div>
          <div
            className="md-theme-preview-block"
            style={{
              backgroundColor: themeState.palette.surface,
              color: themeState.palette.onSurface,
            }}
          >
            <span style={{ color: themeState.palette.onSurfaceVariant }}>Surface</span>
            <strong style={{ color: themeState.palette.onSurface }}>{themeState.palette.surface}</strong>
          </div>
          <div
            className="md-theme-preview-block"
            style={{
              backgroundColor: themeState.palette.surfaceContainer,
              color: themeState.palette.onSurface,
            }}
          >
            <span style={{ color: themeState.palette.onSurfaceVariant }}>Surface Container</span>
            <strong style={{ color: themeState.palette.onSurface }}>
              {themeState.palette.surfaceContainer}
            </strong>
          </div>
        </div>
      </section>
    </div>
  )
}

function ConfigPage({
  deviceId,
  form,
  hasPendingImport,
  loadingInit,
  pendingImportDiffs,
  pendingImportSummary,
  smsPreview,
  validationHints,
  onApplyTemplate,
  onCancelImport,
  onChange,
  onConfirmImport,
  onExportConfig,
  onImportClick,
  onResetOnboarding,
  onSaveConfig,
}) {
  return (
    <div className="md-page-stack">
      <section className="md-section-card">
        <div className="md-section-head">
          <h3>配置工具</h3>
          <span className="md-chip subtle">当前用户 {form.userId}</span>
        </div>
        <p className="md-section-hint">电话和短信号码都支持留空，短信模板支持导入、导出与自定义。</p>
        <div className="md-row-actions">
          <button type="button" className="md-btn tonal" onClick={onExportConfig}>
            导出配置
          </button>
          <button type="button" className="md-btn tonal" onClick={onImportClick}>
            导入配置
          </button>
          <button type="button" className="md-btn tonal" onClick={onResetOnboarding}>
            重置引导
          </button>
          {hasPendingImport && (
            <>
              <button type="button" className="md-btn" onClick={onConfirmImport}>
                确认导入
              </button>
              <button type="button" className="md-btn tonal" onClick={onCancelImport}>
                取消导入
              </button>
            </>
          )}
        </div>
      </section>

      {pendingImportSummary && (
        <section className="md-import-card">
          <h3>导入预览</h3>
          <div className="md-import-meta">
            <p>
              <strong>userId：</strong>
              {pendingImportSummary.userId}
            </p>
            <p>
              <strong>电话号码：</strong>
              {pendingImportSummary.hasCallNumber ? '已填写' : '留空'}
            </p>
            <p>
              <strong>短信号码：</strong>
              {pendingImportSummary.hasSmsNumber ? '已填写' : '留空'}
            </p>
            <p>
              <strong>模板长度：</strong>
              {pendingImportSummary.templateLength}
            </p>
          </div>
          <p className="md-import-diff-title">差异提示：</p>
          {pendingImportDiffs.length > 0 ? (
            <ul className="md-import-diff-list">
              {pendingImportDiffs.map((hint) => (
                <li key={hint}>{hint}</li>
              ))}
            </ul>
          ) : (
            <p className="md-import-no-diff">与当前配置一致，无变更项。</p>
          )}
        </section>
      )}

      <form className="md-form md-section-card" onSubmit={onSaveConfig}>
        <div className="md-section-head">
          <h2>紧急通知配置</h2>
          <span className="md-chip">保存后生效</span>
        </div>

        <div className="md-readonly-field">
          <span>当前 userId</span>
          <strong>{form.userId}</strong>
        </div>

        <div className="md-readonly-field">
          <span>当前 deviceId</span>
          <strong>{deviceId}</strong>
        </div>

        <label htmlFor="callNumber">电话号码（可留空）</label>
        <input
          id="callNumber"
          name="callNumber"
          value={form.callNumber}
          onChange={onChange}
          placeholder="例如 110 或联系人号码"
        />

        <label htmlFor="smsNumber">短信号码（可留空）</label>
        <input
          id="smsNumber"
          name="smsNumber"
          value={form.smsNumber}
          onChange={onChange}
          placeholder="例如 13800000000"
        />

        <label htmlFor="smsTemplate">短信模板（支持自定义）</label>
        <textarea
          id="smsTemplate"
          name="smsTemplate"
          value={form.smsTemplate}
          onChange={onChange}
          rows={5}
        />

        <div className="md-template-actions">
          <button type="button" className="md-btn tonal" onClick={() => onApplyTemplate('default')}>
            使用默认模板
          </button>
          <button type="button" className="md-btn tonal" onClick={() => onApplyTemplate('compact')}>
            使用简洁模板
          </button>
        </div>

        <div className="md-helper">
          <p>可用变量：{'{userId}'} {'{deviceId}'} {'{lat}'} {'{lng}'} {'{time}'}</p>
          {validationHints.length > 0 && (
            <ul className="md-warn-list">
              {validationHints.map((hint) => (
                <li key={hint}>{hint}</li>
              ))}
            </ul>
          )}
          <p>短信预览：</p>
          <pre className="md-preview">{smsPreview}</pre>
        </div>

        <button type="submit" className="md-btn" disabled={loadingInit}>
          保存配置
        </button>
      </form>
    </div>
  )
}

function ContactsPage({
  contactForm,
  contactsList,
  editingContactId,
  onApplyContactNumber,
  onCancelEditContact,
  onContactFormChange,
  onDeleteContact,
  onStartEditContact,
  onSubmitContact,
}) {
  return (
    <div className="md-page-stack">
      <section className="md-section-card">
        <div className="md-section-head">
          <h3>联系人页面</h3>
          <span className="md-chip">{contactsList.length} 人</span>
        </div>
        <p className="md-section-hint">此页仅负责联系人管理；将号码填入通知配置后，记得回到“通知配置”页面保存。</p>
      </section>

      <div className="md-overview-grid">
        <form className="md-section-card md-contact-form" onSubmit={onSubmitContact}>
          <div className="md-section-head">
            <h2>{editingContactId ? '编辑联系人' : '新增联系人'}</h2>
            <span className="md-chip subtle">表单</span>
          </div>
          <div className="md-contact-form-grid">
            <div>
              <label htmlFor="contactName">联系人姓名</label>
              <input
                id="contactName"
                name="name"
                value={contactForm.name}
                onChange={onContactFormChange}
                placeholder="例如 家人 / 室友 / 朋友"
              />
            </div>
            <div>
              <label htmlFor="contactPhone">联系电话</label>
              <input
                id="contactPhone"
                name="phone"
                value={contactForm.phone}
                onChange={onContactFormChange}
                placeholder="例如 13800000000"
              />
            </div>
          </div>
          <div className="md-row-actions">
            <button type="submit" className="md-btn">
              {editingContactId ? '保存联系人' : '新增联系人'}
            </button>
            {editingContactId && (
              <button type="button" className="md-btn tonal" onClick={onCancelEditContact}>
                取消编辑
              </button>
            )}
          </div>
        </form>

        <section className="md-section-card md-contact-section">
          <div className="md-section-head">
            <h2>联系人列表</h2>
            <span className="md-chip subtle">可直接填入号码</span>
          </div>

          {contactsList.length > 0 ? (
            <ul className="md-contact-list">
              {contactsList.map((contact) => (
                <li key={contact.id} className="md-contact-item">
                  <div className="md-contact-main">
                    <strong>{contact.name}</strong>
                    <span>{contact.phone}</span>
                  </div>
                  <div className="md-row-actions">
                    <button
                      type="button"
                      className="md-btn tonal"
                      onClick={() => onApplyContactNumber('callNumber', contact.phone)}
                    >
                      设为电话
                    </button>
                    <button
                      type="button"
                      className="md-btn tonal"
                      onClick={() => onApplyContactNumber('smsNumber', contact.phone)}
                    >
                      设为短信
                    </button>
                    <button
                      type="button"
                      className="md-btn tonal"
                      onClick={() => onStartEditContact(contact)}
                    >
                      编辑
                    </button>
                    <button
                      type="button"
                      className="md-btn tonal"
                      onClick={() => onDeleteContact(contact)}
                    >
                      删除
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="md-data-empty">当前用户还没有联系人，请先新增至少 1 位可信联系人。</p>
          )}
        </section>
      </div>
    </div>
  )
}

function SosPage({
  arming,
  countdown,
  form,
  historyCount,
  latestLocation,
  latestSosEvent,
  loadingInit,
  locationFreshness,
  locationRefreshing,
  onboardingDone,
  onArmSos,
  onCancelSos,
  onNavigate,
  onRefreshLocation,
}) {
  return (
    <div className="md-page-stack">
      {!onboardingDone && <div className="md-banner">建议先在“通知配置”页面完成保存，再进入 SOS 流程。</div>}
      {locationFreshness.banner && <div className="md-banner">{locationFreshness.banner}</div>}

      <section className="md-summary-grid">
        <SummaryCard
          label="电话通道"
          value={form.callNumber.trim() ? '已配置' : '未配置'}
          hint={form.callNumber.trim() || '留空时自动跳过'}
        />
        <SummaryCard
          label="短信通道"
          value={form.smsNumber.trim() ? '已配置' : '未配置'}
          hint={form.smsNumber.trim() || '留空时自动跳过'}
        />
        <SummaryCard
          label="模板状态"
          value={`${(form.smsTemplate || defaultTemplate).length} 字符`}
          hint="支持变量占位符"
        />
        <SummaryCard
          label="历史记录"
          value={`${historyCount} 条`}
          hint={latestSosEvent ? formatPanelTime(latestSosEvent.timestamp) : '暂无历史'}
        />
        <SummaryCard
          label="位置新鲜度"
          value={locationFreshness.label}
          hint={locationFreshness.hint}
        />
      </section>

      <div className="md-overview-grid">
        <section className="md-sos-panel md-section-card">
          <div className="md-section-head">
            <h2>SOS 快速操作</h2>
            <span className="md-chip">5 秒倒计时</span>
          </div>
          <p>触发后会先写入后端事件，再尝试直接发送短信并直接发起拨号。</p>
          {!arming ? (
            <button
              type="button"
              className="md-btn danger"
              onClick={onArmSos}
              disabled={loadingInit}
            >
              触发 SOS（倒计时 5 秒）
            </button>
          ) : (
            <button type="button" className="md-btn" onClick={onCancelSos}>
              取消 SOS（剩余 {countdown}s）
            </button>
          )}
        </section>

        <section className="md-section-card">
          <div className="md-section-head">
            <h3>位置确认与触发说明</h3>
            <span className="md-chip subtle">SOS 前建议先确认位置</span>
          </div>

          <div className="md-kv-list">
            <div className="md-kv-item">
              <span>当前位置</span>
              <strong>{formatLocationText(latestLocation)}</strong>
            </div>
            <div className="md-kv-item">
              <span>位置新鲜度</span>
              <strong>{locationFreshness.label}</strong>
            </div>
            <div className="md-kv-item">
              <span>最近刷新</span>
              <strong>{locationFreshness.updatedAt}</strong>
            </div>
          </div>

          <div className="md-row-actions">
            <button
              type="button"
              className="md-btn tonal"
              onClick={onRefreshLocation}
              disabled={locationRefreshing}
            >
              {locationRefreshing ? '刷新位置中...' : '刷新当前位置'}
            </button>
            <button type="button" className="md-btn tonal" onClick={() => onNavigate('config')}>
              检查配置
            </button>
            <button type="button" className="md-btn tonal" onClick={() => onNavigate('history')}>
              查看历史
            </button>
          </div>

          <ul className="md-bullet-list">
            <li>电话与短信号码都可留空，空值会显示为 skipped。</li>
            <li>首次触发原生动作时会按需申请短信 / 电话权限。</li>
            <li>短信内容按当前模板与实时位置变量渲染，并直接发送。</li>
            <li>倒计时结束时若位置缺失或偏旧，会优先尝试刷新当前位置。</li>
            <li>触发完成后，可前往“历史”页面查看事件详情。</li>
          </ul>

          {latestSosEvent ? (
            <div className="md-kv-list">
              <div className="md-kv-item">
                <span>最近事件</span>
                <strong>{formatPanelTime(latestSosEvent.timestamp)}</strong>
              </div>
              <div className="md-kv-item">
                <span>位置</span>
                <strong>
                  {latestSosEvent.location.lat}, {latestSosEvent.location.lng}
                </strong>
              </div>
            </div>
          ) : (
            <p className="md-data-empty">当前还没有 SOS 记录，触发一次后即可在历史页查看。</p>
          )}
        </section>
      </div>
    </div>
  )
}

function HistoryPage({ onRefreshSosHistory, selectedSosEvent, setSelectedSosId, sosHistory }) {
  return (
    <div className="md-page-stack">
      <section className="md-section-card md-history-section">
        <div className="md-data-card-header">
          <h2>SOS 历史记录</h2>
          <span className="md-chip">最近 {sosHistory.length} 条</span>
        </div>
        <p className="md-section-hint">列表与详情拆分展示，方便在手机上逐条查看通知结果。</p>
        <div className="md-row-actions">
          <button type="button" className="md-btn tonal" onClick={onRefreshSosHistory}>
            刷新历史
          </button>
        </div>

        {sosHistory.length > 0 ? (
          <div className="md-history-layout">
            <ul className="md-history-list">
              {sosHistory.map((event) => (
                <li key={event.id}>
                  <button
                    type="button"
                    className={`md-history-item ${selectedSosEvent?.id === event.id ? 'active' : ''}`}
                    onClick={() => setSelectedSosId(event.id)}
                  >
                    <strong>{formatPanelTime(event.timestamp)}</strong>
                    <span>{event.triggerType === 'manual' ? '手动触发' : '自动触发'}</span>
                    <span>{summarizeNotifications(event.notifications)}</span>
                  </button>
                </li>
              ))}
            </ul>

            {selectedSosEvent && (
              <article className="md-history-detail">
                <div className="md-history-detail-grid">
                  <p>
                    <strong>事件 ID：</strong>
                    {selectedSosEvent.id}
                  </p>
                  <p>
                    <strong>触发时间：</strong>
                    {formatPanelTime(selectedSosEvent.timestamp)}
                  </p>
                  <p>
                    <strong>触发方式：</strong>
                    {selectedSosEvent.triggerType === 'manual' ? '手动' : '自动'}
                  </p>
                  <p>
                    <strong>设备：</strong>
                    {selectedSosEvent.deviceId}
                  </p>
                  <p>
                    <strong>位置：</strong>
                    ({selectedSosEvent.location.lat}, {selectedSosEvent.location.lng})
                  </p>
                  <p>
                    <strong>精度：</strong>
                    {selectedSosEvent.location.accuracy}
                  </p>
                </div>

                <h3 className="md-history-subtitle">通知结果</h3>
                {selectedSosEvent.notifications.length > 0 ? (
                  <ul className="md-data-list">
                    {selectedSosEvent.notifications.map((item, index) => (
                      <li
                        key={`${selectedSosEvent.id}-${item.channel}-${index}`}
                        className="md-data-list-item"
                      >
                        <strong>
                          {item.channel.toUpperCase()} / {item.status}
                        </strong>
                        <span>{item.destination || '未设置号码'}</span>
                        <span>{item.detail}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="md-data-empty">该事件暂无通知详情。</p>
                )}
              </article>
            )}
          </div>
        ) : (
          <p className="md-data-empty">当前用户暂无 SOS 历史记录，触发一次 SOS 后会在这里展示。</p>
        )}
      </section>
    </div>
  )
}

function ToolsPage({
  contactsPreview,
  localPanel,
  storageDriver,
  trackingPreview,
  onAddMockContact,
  onAddMockTracking,
  onClearLocalPanel,
  onExportLocalBundle,
  onImportLocalBundleClick,
  onInspectContacts,
  onInspectTracking,
  onRefreshLocalPanel,
}) {
  return (
    <div className="md-page-stack">
      <section className="md-section-card">
        <div className="md-section-head">
          <h3>开发者自检页</h3>
          <span className="md-chip subtle">Debug / 验收辅助</span>
        </div>
        <p className="md-section-hint">这一页承载本地后端面板、快照与 mock 操作，避免与用户主流程混在同一屏。</p>
        <p className="md-section-hint">当前持久化驱动：{storageDriver}</p>
      </section>

      {localPanel ? (
        <section className="md-local-panel">
          <div className="md-local-panel-header">
            <h3>本地后端数据面板</h3>
            <span className="md-chip">当前用户 {localPanel.userId}</span>
          </div>
          <div className="md-local-panel-grid">
            <div className="md-stat-card">
              <span>配置</span>
              <strong>{localPanel.hasConfig ? '已保存' : '未保存'}</strong>
            </div>
            <div className="md-stat-card">
              <span>SOS 记录</span>
              <strong>{localPanel.sosCount}</strong>
            </div>
            <div className="md-stat-card">
              <span>联系人</span>
              <strong>{localPanel.contactsCount}</strong>
            </div>
            <div className="md-stat-card">
              <span>轨迹点</span>
              <strong>{localPanel.trackingCount}</strong>
            </div>
          </div>
          <p className="md-local-panel-time">最近 SOS：{formatPanelTime(localPanel.latestSos)}</p>
          <p className="md-local-panel-note">建议仅在测试 / 验收时使用下面这些工具按钮。</p>
          <div className="md-row-actions">
            <button type="button" className="md-btn tonal" onClick={() => onRefreshLocalPanel(localPanel.userId)}>
              刷新面板
            </button>
            <button type="button" className="md-btn tonal" onClick={onExportLocalBundle}>
              导出本地快照
            </button>
            <button type="button" className="md-btn tonal" onClick={onImportLocalBundleClick}>
              导入本地快照
            </button>
            <button type="button" className="md-btn tonal" onClick={onAddMockContact}>
              添加模拟联系人
            </button>
            <button type="button" className="md-btn tonal" onClick={onAddMockTracking}>
              写入模拟轨迹
            </button>
            <button type="button" className="md-btn tonal" onClick={onInspectContacts}>
              刷新联系人快照
            </button>
            <button type="button" className="md-btn tonal" onClick={onInspectTracking}>
              刷新轨迹快照
            </button>
            <button type="button" className="md-btn tonal" onClick={onClearLocalPanel}>
              清空本地数据
            </button>
          </div>
        </section>
      ) : (
        <section className="md-section-card">
          <p className="md-data-empty">当前不在本地后端模式，工具页无可展示的本地数据面板。</p>
        </section>
      )}

      {(contactsPreview || trackingPreview) && (
        <section className="md-preview-section">
          {contactsPreview && (
            <article className="md-data-card">
              <div className="md-data-card-header">
                <h3>联系人快照</h3>
                <span className="md-chip">{contactsPreview.count} 条</span>
              </div>
              {contactsPreview.items.length > 0 ? (
                <ul className="md-data-list">
                  {contactsPreview.items.map((item) => (
                    <li key={item.id || `${item.name}-${item.phone}`} className="md-data-list-item">
                      <strong>{item.name}</strong>
                      <span>{item.phone}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="md-data-empty">暂无联系人数据</p>
              )}
            </article>
          )}

          {trackingPreview && (
            <article className="md-data-card">
              <div className="md-data-card-header">
                <h3>最近 1 小时轨迹</h3>
                <span className="md-chip">{trackingPreview.count} 条</span>
              </div>
              {trackingPreview.items.length > 0 ? (
                <ul className="md-data-list">
                  {trackingPreview.items.map((point) => (
                    <li
                      key={`${point.timestamp}-${point.lat}-${point.lng}`}
                      className="md-data-list-item"
                    >
                      <strong>
                        ({point.lat}, {point.lng})
                      </strong>
                      <span>{formatPanelTime(point.timestamp)}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="md-data-empty">最近 1 小时暂无轨迹点</p>
              )}
            </article>
          )}
        </section>
      )}
    </div>
  )
}

function App() {
  const [healthText, setHealthText] = useState('未检查')
  const [resultText, setResultText] = useState('等待操作...')
  const [permissionText, setPermissionText] = useState('首次启动将自动申请定位')
  const [latestLocation, setLatestLocation] = useState(null)
  const [locationRefreshPending, setLocationRefreshPending] = useState(false)
  const [locationNow, setLocationNow] = useState(() => Date.now())
  const [loadingInit, setLoadingInit] = useState(true)
  const [identity, setIdentity] = useState(getPersistedIdentity)
  const [onboardingDone, setOnboardingDone] = useState(false)
  const [developerModeEnabled, setDeveloperModeEnabled] = useState(
    () => import.meta.env.DEV || readStoredString(developerModeKey) === 'enabled'
  )
  const [activePage, setActivePage] = useState('overview')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [drawerOffset, setDrawerOffset] = useState(null)
  const [drawerWidth, setDrawerWidth] = useState(320)
  const [arming, setArming] = useState(false)
  const [countdown, setCountdown] = useState(5)
  const [pendingImport, setPendingImport] = useState(null)
  const [pendingImportSummary, setPendingImportSummary] = useState(null)
  const [pendingImportDiffs, setPendingImportDiffs] = useState([])
  const [themePreferences, setThemePreferences] = useState(readThemePreferences)
  const [dynamicThemeInfo, setDynamicThemeInfo] = useState({
    supported: false,
    seedColor: '#6750A4',
    source: 'loading',
    sdkInt: 0,
  })
  const [localPanel, setLocalPanel] = useState(null)
  const [contactsList, setContactsList] = useState([])
  const [contactsPreview, setContactsPreview] = useState(null)
  const [trackingPreview, setTrackingPreview] = useState(null)
  const [trackingSnapshot, setTrackingSnapshot] = useState(() => getTrackingSnapshot(identity.userId))
  const [trackingBusy, setTrackingBusy] = useState(false)
  const [sosHistory, setSosHistory] = useState([])
  const [selectedSosId, setSelectedSosId] = useState(null)
  const [contactForm, setContactForm] = useState(createEmptyContactForm)
  const [editingContactId, setEditingContactId] = useState(null)
  const [form, setForm] = useState(() => createEmptyForm(identity.userId))
  const importInputRef = useRef(null)
  const localBundleInputRef = useRef(null)
  const devTapCountRef = useRef(0)
  const devTapTimerRef = useRef(null)
  const mainPanelRef = useRef(null)
  const drawerPanelRef = useRef(null)
  const touchSessionRef = useRef(null)
  const trackingJobRef = useRef(false)

  const envText = useMemo(
    () => (isNativePlatform() ? 'Android App' : 'Web 浏览器'),
    []
  )
  const storageDriver = getStorageDriverLabel()
  const currentUserId = form.userId || identity.userId
  const showToolsPage = isLocalBackendMode() && developerModeEnabled
  const pageItems = useMemo(
    () => pageCatalog.filter((page) => page.id !== 'tools' || showToolsPage),
    [showToolsPage]
  )
  const currentPage = useMemo(
    () => pageItems.find((page) => page.id === activePage) || pageItems[0],
    [activePage, pageItems]
  )
  const themeState = useMemo(
    () => buildThemeState(themePreferences, dynamicThemeInfo),
    [dynamicThemeInfo, themePreferences]
  )
  const latestSosEvent = useMemo(() => sosHistory[0] || null, [sosHistory])
  const locationFreshness = useMemo(
    () => buildLocationFreshness(latestLocation, locationNow),
    [latestLocation, locationNow]
  )

  const previewPayload = useMemo(
    () => createPreviewSosPayload(form.userId || identity.userId, identity.deviceId, latestLocation),
    [form.userId, identity.deviceId, identity.userId, latestLocation]
  )

  const smsPreview = useMemo(
    () => renderTemplate(form.smsTemplate || defaultTemplate, previewPayload),
    [form.smsTemplate, previewPayload]
  )

  const validationHints = useMemo(() => getValidationHints(form), [form])
  const selectedSosEvent = useMemo(
    () => sosHistory.find((item) => item.id === selectedSosId) || sosHistory[0] || null,
    [selectedSosId, sosHistory]
  )
  const drawerVisible = drawerOpen || drawerOffset !== null
  const drawerTransformX = drawerOffset ?? (drawerOpen ? 0 : -drawerWidth)
  const drawerScrimOpacity = drawerVisible
    ? drawerScrimMaxOpacity * getDrawerProgress(drawerTransformX, drawerWidth)
    : 0

  useEffect(() => {
    if (!latestLocation?.capturedAt) {
      return undefined
    }
    setLocationNow(Date.now())
    const timer = setInterval(() => {
      setLocationNow(Date.now())
    }, 15000)
    return () => clearInterval(timer)
  }, [latestLocation?.capturedAt])

  useEffect(() => {
    function syncDrawerWidth() {
      setDrawerWidth(getDrawerWidth(drawerPanelRef.current))
    }

    syncDrawerWidth()
    window.addEventListener('resize', syncDrawerWidth)
    return () => window.removeEventListener('resize', syncDrawerWidth)
  }, [])

  useEffect(() => {
    setDrawerOpen(false)
    setDrawerOffset(null)
  }, [activePage])

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    if (drawerVisible) {
      document.body.style.overflow = 'hidden'
    }
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [drawerVisible])

  useEffect(() => {
    applyThemeState(themeState)
    void writeThemePreferences(themeState.preferences)
  }, [themeState])

  useEffect(() => {
    let active = true

    async function loadThemeInfo() {
      const info = await loadDynamicThemeInfo()
      if (!active) {
        return
      }
      setDynamicThemeInfo(info)
      setThemePreferences((current) => {
        const resolved = buildThemeState(current, info).preferences
        return JSON.stringify(current) === JSON.stringify(resolved) ? current : resolved
      })
    }

    void loadThemeInfo()
    return () => {
      active = false
    }
  }, [])

  async function refreshLocalPanel(userId = currentUserId) {
    if (!isLocalBackendMode()) {
      setLocalPanel(null)
      return
    }
    const snapshot = await getLocalBackendSnapshot(userId)
    setLocalPanel(snapshot)
  }

  function syncLatestLocation(location) {
    if (!location) {
      return
    }
    setLatestLocation(location)
    setLocationNow(Date.now())
  }

  function refreshTrackingPanel(userId = currentUserId) {
    setTrackingSnapshot(getTrackingSnapshot(userId))
  }

  async function flushQueuedTracking(userId = currentUserId) {
    return flushPendingTracking((payload) => createTrackingPoints(payload), { userId })
  }

  async function runTrackingCycle({ capturePoint = true, silent = false } = {}) {
    const userId = currentUserId
    if (!userId) {
      return null
    }
    if (trackingJobRef.current) {
      if (!silent) {
        setResultText('轨迹任务进行中，请稍后再试')
      }
      return null
    }

    trackingJobRef.current = true
    setTrackingBusy(true)
    let captured = false
    let skippedReason = ''

    try {
      if (capturePoint) {
        const locationResult = await refreshCurrentLocation({
          reason: 'tracking',
          requestIfNeeded: false,
          force: true,
        })
        if (locationResult.location) {
          syncLatestLocation(locationResult.location)
          const point = createTrackingPointFromLocation(locationResult.location)
          if (!point) {
            skippedReason = '位置点格式无效，未写入轨迹队列'
            await recordTrackingError(userId, skippedReason)
          } else {
            await enqueueTrackingPoint({
              userId,
              deviceId: identity.deviceId,
              point,
              reason: 'periodic',
            })
            captured = true
          }
        } else {
          skippedReason = `本次未采样成功：${locationResult.message}`
          await recordTrackingError(userId, skippedReason)
        }
      }

      const flushResult = await flushQueuedTracking(userId)
      setTrackingSnapshot(flushResult.snapshot)
      if (isLocalBackendMode() && (captured || flushResult.sentCount > 0)) {
        await refreshLocalPanel(userId)
      }
      if (!silent) {
        setResultText(
          buildTrackingResultMessage({
            captured,
            sentCount: flushResult.sentCount,
            snapshot: flushResult.snapshot,
            skippedReason,
          })
        )
      }
      return flushResult
    } catch (error) {
      const message = `轨迹同步失败: ${error.message}`
      const snapshot = await recordTrackingError(userId, message)
      setTrackingSnapshot(snapshot)
      if (!silent) {
        setResultText(message)
      }
      return { sentCount: 0, error: message, snapshot }
    } finally {
      trackingJobRef.current = false
      setTrackingBusy(false)
    }
  }

  async function loadContactsPreview(userId = currentUserId) {
    const data = await listContacts(userId)
    setContactsList(data.contacts)
    setContactsPreview(buildContactsPreview(data))
    return data
  }

  async function loadTrackingPreview(userId = currentUserId) {
    const to = new Date()
    const from = new Date(to.getTime() - 60 * 60 * 1000)
    const data = await getTrackingTimeline({
      userId,
      from: from.toISOString(),
      to: to.toISOString(),
    })
    setTrackingPreview(buildTrackingPreview(data))
    return data
  }

  async function loadSosHistory(userId = currentUserId) {
    const data = await listSosEvents(userId)
    setSosHistory(data.items)
    setSelectedSosId((current) =>
      data.items.some((item) => item.id === current) ? current : (data.items[0]?.id ?? null)
    )
    return data
  }

  function resetDataPreviews() {
    setContactsPreview(null)
    setTrackingPreview(null)
  }

  function resetContactManager() {
    setContactsList([])
    setContactForm(createEmptyContactForm())
    setEditingContactId(null)
  }

  function resetSosHistory() {
    setSosHistory([])
    setSelectedSosId(null)
  }

  function updateIdentityUserId(userId) {
    const nextUserId = typeof userId === 'string' ? userId.trim() : ''
    if (!nextUserId) {
      return
    }
    setIdentity((current) => {
      const next = savePersistedIdentity({ ...current, userId: nextUserId })
      return current.userId === next.userId ? current : next
    })
  }

  function resetDeveloperTapProgress() {
    devTapCountRef.current = 0
    if (devTapTimerRef.current) {
      clearTimeout(devTapTimerRef.current)
      devTapTimerRef.current = null
    }
  }

  function navigateToPage(pageId) {
    setActivePage(pageId)
    setDrawerOpen(false)
    setDrawerOffset(null)
  }

  function openDrawer() {
    touchSessionRef.current = null
    setDrawerWidth(getDrawerWidth(drawerPanelRef.current))
    setDrawerOffset(null)
    setDrawerOpen(true)
  }

  function closeDrawer() {
    touchSessionRef.current = null
    setDrawerOffset(null)
    setDrawerOpen(false)
  }

  function finishDrawerGesture(lastX = null) {
    const session = touchSessionRef.current
    if (!session) {
      return
    }
    const finalX = lastX ?? session.lastX ?? session.startX
    const dx = finalX - session.startX
    const distance = session.mode === 'open' ? Math.max(dx, 0) : Math.max(-dx, 0)
    const commitThreshold = session.mode === 'open'
      ? drawerOpenSwipeThreshold
      : drawerCloseSwipeThreshold
    const shouldCommit =
      session.dragging &&
      (distance >= commitThreshold || distance / session.drawerWidth >= drawerPreviewCommitRatio)

    setDrawerOffset(null)
    setDrawerOpen(session.mode === 'open' ? shouldCommit : !shouldCommit)
    touchSessionRef.current = null
  }

  function onPageTouchStart(event) {
    const touch = event.touches?.[0]
    if (!touch) {
      return
    }

    const gestureBlocked = isDrawerGestureBlockedTarget(event.target)
    const measuredDrawerWidth = getDrawerWidth(drawerPanelRef.current)
    setDrawerWidth(measuredDrawerWidth)

    if (drawerOpen) {
      touchSessionRef.current = gestureBlocked
        ? null
        : {
            startX: touch.clientX,
            startY: touch.clientY,
            lastX: touch.clientX,
            mode: 'close',
            dragging: false,
            drawerWidth: measuredDrawerWidth,
          }
      return
    }

    if (gestureBlocked || !canStartDrawerOpenGesture(touch, mainPanelRef.current)) {
      touchSessionRef.current = null
      return
    }

    touchSessionRef.current = {
      startX: touch.clientX,
      startY: touch.clientY,
      lastX: touch.clientX,
      mode: 'open',
      dragging: false,
      drawerWidth: measuredDrawerWidth,
    }
  }

  function onPageTouchMove(event) {
    const touch = event.touches?.[0]
    const session = touchSessionRef.current
    if (!touch || !session) {
      return
    }

    const dx = touch.clientX - session.startX
    const dy = touch.clientY - session.startY
    const absDx = Math.abs(dx)
    const absDy = Math.abs(dy)
    session.lastX = touch.clientX

    if (absDy > 18 && absDy > absDx * 1.15) {
      touchSessionRef.current = null
      setDrawerOffset(null)
      return
    }

    if (absDx < drawerDragActivatePx || absDx <= absDy) {
      return
    }

    if (session.mode === 'open') {
      if (dx <= 0) {
        if (session.dragging) {
          setDrawerOffset(-session.drawerWidth)
        }
        return
      }
      event.preventDefault()
      session.dragging = true
      setDrawerOffset(clampDrawerOffset(dx - session.drawerWidth, session.drawerWidth))
      return
    }

    event.preventDefault()
    session.dragging = true
    setDrawerOffset(clampDrawerOffset(Math.min(dx, 0), session.drawerWidth))
  }

  function onPageTouchEnd(event) {
    const touch = event.changedTouches?.[0]
    finishDrawerGesture(touch?.clientX)
  }

  function onPageTouchCancel() {
    finishDrawerGesture()
  }

  async function onVersionChipClick() {
    devTapCountRef.current += 1
    if (devTapTimerRef.current) {
      clearTimeout(devTapTimerRef.current)
    }
    devTapTimerRef.current = setTimeout(() => {
      resetDeveloperTapProgress()
    }, 1200)

    const remaining = 5 - devTapCountRef.current
    if (remaining > 0) {
      setResultText(`再点 ${remaining} 次可切换开发者模式`)
      return
    }

    resetDeveloperTapProgress()
    const nextEnabled = !developerModeEnabled
    setDeveloperModeEnabled(nextEnabled)
    if (nextEnabled) {
      await writeStoredString(developerModeKey, 'enabled')
      setResultText('已开启开发者模式；若当前处于本地后端模式，工具页现已可见')
      return
    }

    await removeStoredValue(developerModeKey)
    setResultText('已关闭开发者模式，工具页已隐藏')
  }

  useEffect(() => {
    let ignore = false

    async function bootstrap() {
      const done = readStoredString(onboardingKey) === 'done'
      if (!ignore) {
        setOnboardingDone(done)
        setActivePage(done ? 'overview' : 'config')
      }

      const cached = readJsonCache(cacheKey)
      if (cached && !ignore) {
        setForm((prev) => ({ ...prev, ...cached }))
      }

      const permissionResult = await requestInitialPermissions()
      if (ignore) return
      setPermissionText(permissionResult.message)
      setLatestLocation(permissionResult.location)
      if (permissionResult.location) {
        setLocationNow(Date.now())
      }

      try {
        const remote = await getEmergencyConfig(identity.userId)
        if (ignore) return
        const merged = {
          userId: remote.userId || identity.userId,
          callNumber: remote.callNumber ?? cached?.callNumber ?? '',
          smsNumber: remote.smsNumber ?? cached?.smsNumber ?? '',
          smsTemplate: remote.smsTemplate || cached?.smsTemplate || defaultTemplate,
        }
        setForm(merged)
        updateIdentityUserId(merged.userId)
        await writeJsonCache(cacheKey, merged)
        await Promise.all([
          refreshLocalPanel(merged.userId),
          loadContactsPreview(merged.userId),
          loadSosHistory(merged.userId),
        ])
        refreshTrackingPanel(merged.userId)
      } finally {
        if (!ignore) {
          setLoadingInit(false)
        }
      }
    }

    bootstrap()
    return () => {
      ignore = true
    }
  }, [])

  useEffect(() => {
    if (!arming) return
    if (countdown <= 0) {
      void executeSos()
      return
    }
    const timer = setTimeout(() => setCountdown((v) => v - 1), 1000)
    return () => clearTimeout(timer)
  }, [arming, countdown])

  useEffect(() => {
    if (!showToolsPage && activePage === 'tools') {
      setActivePage(onboardingDone ? 'overview' : 'config')
    }
  }, [activePage, onboardingDone, showToolsPage])

  useEffect(() => () => resetDeveloperTapProgress(), [])

  useEffect(() => {
    resetDataPreviews()
    resetContactManager()
    resetSosHistory()
    refreshTrackingPanel(currentUserId)
    void Promise.all([
      refreshLocalPanel(currentUserId),
      loadContactsPreview(currentUserId),
      loadSosHistory(currentUserId),
    ])
  }, [currentUserId])

  useEffect(() => {
    if (!trackingSnapshot.enabled || loadingInit) {
      return undefined
    }
    const timer = setInterval(() => {
      void runTrackingCycle({ capturePoint: true, silent: true })
    }, trackingSnapshot.intervalSeconds * 1000)
    return () => clearInterval(timer)
  }, [currentUserId, identity.deviceId, loadingInit, trackingSnapshot.enabled, trackingSnapshot.intervalSeconds])

  useEffect(() => {
    function retryQueuedTracking() {
      if (trackingSnapshot.pendingCount <= 0) {
        return
      }
      void runTrackingCycle({ capturePoint: false, silent: true })
    }

    function handleVisibilityChange() {
      if (document.visibilityState === 'visible') {
        retryQueuedTracking()
      }
    }

    window.addEventListener('online', retryQueuedTracking)
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      window.removeEventListener('online', retryQueuedTracking)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [trackingSnapshot.pendingCount, currentUserId, identity.deviceId])

  function onChange(event) {
    const { name, value } = event.target
    setOnboardingDone(false)
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  async function onCheckHealth() {
    try {
      const data = await checkHealth()
      setHealthText(`${data.status} @ ${data.time}`)
      setResultText(`后端健康检查完成：${data.status}`)
    } catch (error) {
      setHealthText(`失败: ${error.message}`)
      setResultText(`后端健康检查失败：${error.message}`)
    }
  }

  async function onRefreshLocation(options = {}) {
    const { reason = 'manual', silent = false } = options
    setLocationRefreshPending(true)
    try {
      const result = await refreshCurrentLocation({ reason, requestIfNeeded: true, force: true })
      setPermissionText(result.message)
      if (result.location) {
        setLatestLocation(result.location)
        setLocationNow(Date.now())
      }
      if (!silent) {
        setResultText(
          result.location ? `${result.message}：${formatLocationText(result.location)}` : result.message
        )
      }
      return result
    } catch (error) {
      const message = `定位刷新失败: ${error.message}`
      setPermissionText(message)
      if (!silent) {
        setResultText(message)
      }
      return {
        platform: isNativePlatform() ? 'native' : 'web',
        locationPermission: 'error',
        location: null,
        message,
      }
    } finally {
      setLocationRefreshPending(false)
    }
  }

  async function onRunTrackingNow() {
    await runTrackingCycle({ capturePoint: true, silent: false })
  }

  async function onToggleTracking() {
    const nextEnabled = !trackingSnapshot.enabled
    await updateTrackingPreferences({ enabled: nextEnabled })
    refreshTrackingPanel(currentUserId)
    if (!nextEnabled) {
      setResultText('已停止周期轨迹；当前待补发队列会保留，可稍后手动继续同步')
      return
    }
    await runTrackingCycle({ capturePoint: true, silent: false })
  }

  async function onTrackingIntervalChange(event) {
    const intervalSeconds = Number(event.target.value)
    await updateTrackingPreferences({ intervalSeconds })
    const snapshot = getTrackingSnapshot(currentUserId)
    setTrackingSnapshot(snapshot)
    setResultText(`已将轨迹采样周期调整为 ${snapshot.intervalSeconds} 秒`)
  }

  async function resolveSosLocation() {
    if (latestLocation && !locationFreshness.needsRefresh) {
      return { location: latestLocation, note: '' }
    }

    const refreshed = await onRefreshLocation({ reason: 'sos', silent: true })
    if (refreshed.location) {
      return {
        location: refreshed.location,
        note: 'SOS 前已自动刷新当前位置。',
      }
    }

    if (latestLocation) {
      return {
        location: latestLocation,
        note: '位置刷新失败，已继续使用上次记录的位置。',
      }
    }

    return {
      location: null,
      note: '无法获取当前位置，已取消 SOS；请先点击“刷新当前位置”并确认定位权限。',
    }
  }

  async function onSaveConfig(event) {
    event.preventDefault()
    const safeForm = {
      ...form,
      smsTemplate: form.smsTemplate.trim() ? form.smsTemplate : defaultTemplate,
    }
    await writeJsonCache(cacheKey, safeForm)
    try {
      const data = await saveEmergencyConfig(safeForm)
      const next = {
        ...safeForm,
        callNumber: data.callNumber ?? '',
        smsNumber: data.smsNumber ?? '',
        smsTemplate: data.smsTemplate,
      }
      setForm(next)
      updateIdentityUserId(next.userId)
      await writeJsonCache(cacheKey, next)
      await refreshLocalPanel(next.userId)
      setResultText('配置保存成功，已完成引导，可前往 SOS 页面')
    } catch (error) {
      setResultText(`后端保存失败，已本地保存: ${error.message}`)
    }
    await writeStoredString(onboardingKey, 'done')
    setOnboardingDone(true)
    setActivePage('sos')
  }

  function onArmSos() {
    if (loadingInit) return
    setCountdown(5)
    setArming(true)
    if (!locationFreshness.canUse) {
      setResultText('SOS 倒计时开始；当前尚未获取位置，倒计时结束时会先尝试刷新，若仍失败将取消上报。')
      return
    }
    if (locationFreshness.needsRefresh) {
      setResultText('SOS 倒计时开始；当前位置已偏旧，倒计时结束时会先尝试刷新位置。')
      return
    }
    setResultText('SOS 倒计时开始，5 秒后触发，可取消')
  }

  function onCancelSos() {
    setArming(false)
    setCountdown(5)
    setResultText('已取消 SOS')
  }

  async function onResetOnboarding() {
    await removeStoredValue(onboardingKey)
    setOnboardingDone(false)
    setActivePage('config')
    setResultText('已重置引导状态，请重新完成配置')
  }

  function onExportConfig() {
    const payload = {
      version: configVersion,
      ...form,
      exportedAt: new Date().toISOString(),
      onboardingDone,
    }
    downloadJsonFile('safety-config.json', payload)
    setResultText('已导出当前配置 JSON')
  }

  function onImportClick() {
    importInputRef.current?.click()
  }

  async function onImportConfig(event) {
    const file = event.target.files?.[0]
    if (!file) {
      return
    }
    try {
      const text = await file.text()
      const imported = parseImportedConfig(text)
      setPendingImport(imported)
      setPendingImportSummary(buildImportSummary(imported))
      setPendingImportDiffs(buildDiffHints(form, imported))
      setResultText('已读取导入文件，请在配置页确认是否覆盖当前配置。')
      setActivePage('config')
    } catch (error) {
      setPendingImport(null)
      setPendingImportSummary(null)
      setPendingImportDiffs([])
      setResultText(`配置导入失败: ${error.message}`)
    } finally {
      event.target.value = ''
    }
  }

  async function onConfirmImport() {
    if (!pendingImport) {
      return
    }
    setForm(pendingImport)
    updateIdentityUserId(pendingImport.userId)
    await writeJsonCache(cacheKey, pendingImport)
    await refreshLocalPanel(pendingImport.userId)
    refreshTrackingPanel(pendingImport.userId)
    setOnboardingDone(false)
    setPendingImport(null)
    setPendingImportSummary(null)
    setPendingImportDiffs([])
    setActivePage('config')
    setResultText('配置导入成功，请检查后点击“保存配置”同步到后端')
  }

  function onCancelImport() {
    setPendingImport(null)
    setPendingImportSummary(null)
    setPendingImportDiffs([])
    setResultText('已取消导入')
  }

  function onThemeModeChange(mode) {
    if (mode === 'dynamic' && !dynamicThemeInfo.supported) {
      setResultText('当前设备不支持壁纸吸色，已保留现有调色板')
      return
    }
    setThemePreferences((prev) => ({ ...prev, mode }))
    setResultText(
      mode === 'dynamic'
        ? '已切换为壁纸吸色主题'
        : mode === 'custom'
          ? '已切换为自定义调色板模式'
          : '已切换为预设调色板模式'
    )
  }

  function onPresetThemeChange(presetId) {
    setThemePreferences((prev) => ({ ...prev, mode: 'preset', presetId }))
    const palette = presetPalettes.find((item) => item.id === presetId)
    setResultText(`已切换预设调色板：${palette?.label || presetId}`)
  }

  function onCustomThemeSeedChange(event) {
    const nextSeed = event.target.value
    setThemePreferences((prev) => ({ ...prev, mode: 'custom', customSeed: nextSeed }))
    setResultText(`已更新自定义调色板：${nextSeed}`)
  }

  function onApplyTemplate(kind) {
    const template = kind === 'compact' ? compactTemplate : defaultTemplate
    setForm((prev) => ({ ...prev, smsTemplate: template }))
  }

  function onContactFormChange(event) {
    const { name, value } = event.target
    setContactForm((prev) => ({ ...prev, [name]: value }))
  }

  function onStartEditContact(contact) {
    setEditingContactId(contact.id)
    setContactForm({ name: contact.name, phone: contact.phone })
  }

  function onCancelEditContact() {
    setEditingContactId(null)
    setContactForm(createEmptyContactForm())
  }

  function onApplyContactNumber(field, phone) {
    setOnboardingDone(false)
    setForm((prev) => ({ ...prev, [field]: phone }))
    setActivePage('config')
    setResultText(`已将联系人号码填入${field === 'callNumber' ? '电话' : '短信'}字段，请记得保存配置`)
  }

  async function onSubmitContact(event) {
    event.preventDefault()
    const name = contactForm.name.trim()
    const phone = contactForm.phone.trim()
    if (!name || !phone) {
      setResultText('联系人姓名和电话不能为空')
      return
    }

    const payload = { userId: form.userId || identity.userId, contact: { name, phone } }
    try {
      if (editingContactId) {
        await updateContact(editingContactId, payload)
        setResultText(`已更新联系人：${name}`)
      } else {
        await createContact(payload)
        setResultText(`已新增联系人：${name}`)
      }
      onCancelEditContact()
      await refreshLocalPanel(payload.userId)
      await loadContactsPreview(payload.userId)
    } catch (error) {
      setResultText(`${editingContactId ? '更新' : '新增'}联系人失败: ${error.message}`)
    }
  }

  async function onDeleteContact(contact) {
    const confirmed = window.confirm(`确认删除联系人 ${contact.name} 吗？`)
    if (!confirmed) {
      return
    }
    try {
      await deleteContact(contact.id, form.userId || identity.userId)
      if (editingContactId === contact.id) {
        onCancelEditContact()
      }
      await refreshLocalPanel(form.userId || identity.userId)
      await loadContactsPreview(form.userId || identity.userId)
      setResultText(`已删除联系人：${contact.name}`)
    } catch (error) {
      setResultText(`删除联系人失败: ${error.message}`)
    }
  }

  async function onClearLocalPanel() {
    try {
      await clearLocalBackendData(currentUserId)
      await clearTrackingData(currentUserId)
      await removeStoredValue(cacheKey)
      await removeStoredValue(onboardingKey)
      setForm(createEmptyForm(identity.userId))
      setOnboardingDone(false)
      setPendingImport(null)
      setPendingImportSummary(null)
      setPendingImportDiffs([])
      resetDataPreviews()
      resetContactManager()
      resetSosHistory()
      setActivePage('config')
      await refreshLocalPanel(identity.userId)
      refreshTrackingPanel(identity.userId)
      setResultText('已清空当前用户本地后端数据、轨迹补发队列，并重置引导')
    } catch (error) {
      setResultText(`清空本地数据失败: ${error.message}`)
    }
  }

  async function onExportLocalBundle() {
    try {
      const userId = form.userId || identity.userId
      const payload = await exportLocalBackendBundle(userId)
      downloadJsonFile(`safety-local-backup-${userId}.json`, payload)
      setResultText('已导出当前用户本地后端快照 JSON')
    } catch (error) {
      setResultText(`导出本地快照失败: ${error.message}`)
    }
  }

  function onImportLocalBundleClick() {
    localBundleInputRef.current?.click()
  }

  async function onImportLocalBundle(event) {
    const file = event.target.files?.[0]
    if (!file) {
      return
    }
    try {
      const text = await file.text()
      const payload = JSON.parse(text)
      const summary = buildLocalBundleSummary(payload)
      const confirmed = window.confirm(
        `将覆盖用户 ${summary.userId} 的本地数据。\n配置：${summary.hasConfig ? '有' : '无'}\n联系人：${summary.contactsCount}\n轨迹点：${summary.trackingCount}\nSOS：${summary.sosCount}`
      )
      if (!confirmed) {
        setResultText('已取消本地快照导入')
        return
      }
      await clearTrackingData(summary.userId)
      const { bundle } = await importLocalBackendBundle(payload)
      const nextForm = bundle.config
        ? {
            ...createEmptyForm(),
            ...bundle.config,
            callNumber: bundle.config.callNumber ?? '',
            smsNumber: bundle.config.smsNumber ?? '',
            smsTemplate: bundle.config.smsTemplate || defaultTemplate,
          }
        : { ...createEmptyForm(), userId: bundle.userId }
      setForm(nextForm)
      updateIdentityUserId(bundle.userId)
      await writeJsonCache(cacheKey, nextForm)
      if (bundle.config) {
        await writeStoredString(onboardingKey, 'done')
      } else {
        await removeStoredValue(onboardingKey)
      }
      setOnboardingDone(Boolean(bundle.config))
      setPendingImport(null)
      setPendingImportSummary(null)
      setPendingImportDiffs([])
      onCancelEditContact()
      resetSosHistory()
      setActivePage(bundle.config ? 'overview' : 'config')
      await refreshLocalPanel(bundle.userId)
      refreshTrackingPanel(bundle.userId)
      await Promise.all([
        loadContactsPreview(bundle.userId),
        loadTrackingPreview(bundle.userId),
        loadSosHistory(bundle.userId),
      ])
      setResultText(
        `已导入本地快照：${bundle.userId}（联系人 ${bundle.contacts.length}，轨迹 ${bundle.trackingPoints.length}，SOS ${bundle.sosEvents.length}）`
      )
    } catch (error) {
      setResultText(`导入本地快照失败: ${error.message}`)
    } finally {
      event.target.value = ''
    }
  }

  async function onAddMockContact() {
    try {
      const payload = createMockContactPayload(
        form.userId || identity.userId,
        localPanel?.contactsCount ?? 0
      )
      const data = await createContact(payload)
      await refreshLocalPanel(payload.userId)
      await loadContactsPreview(payload.userId)
      setResultText(
        `已写入模拟联系人：${payload.contact.name} / ${payload.contact.phone}（当前 ${data.count} 个）`
      )
    } catch (error) {
      setResultText(`写入模拟联系人失败: ${error.message}`)
    }
  }

  async function onAddMockTracking() {
    try {
      const payload = createMockTrackingPayload(
        form.userId || identity.userId,
        identity.deviceId,
        latestLocation,
        localPanel?.trackingCount ?? 0
      )
      const data = await createTrackingPoints(payload)
      const point = payload.points[0]
      await refreshLocalPanel(payload.userId)
      await loadTrackingPreview(payload.userId)
      setResultText(
        `已写入模拟轨迹点：(${point.lat}, ${point.lng}) @ ${point.timestamp}（本次 ${data.count} 条）`
      )
    } catch (error) {
      setResultText(`写入模拟轨迹失败: ${error.message}`)
    }
  }

  async function onInspectContacts() {
    try {
      const data = await loadContactsPreview(form.userId || identity.userId)
      setResultText(`联系人快照已刷新（共 ${data.contacts.length} 条）`)
    } catch (error) {
      setResultText(`读取联系人失败: ${error.message}`)
    }
  }

  async function onInspectTracking() {
    try {
      const data = await loadTrackingPreview(form.userId || identity.userId)
      setResultText(`轨迹快照已刷新（最近 1 小时共 ${data.count} 条）`)
    } catch (error) {
      setResultText(`读取轨迹失败: ${error.message}`)
    }
  }

  async function onRefreshSosHistory() {
    try {
      const data = await loadSosHistory(form.userId || identity.userId)
      setResultText(`SOS 历史已刷新（共 ${data.count} 条）`)
    } catch (error) {
      setResultText(`读取 SOS 历史失败: ${error.message}`)
    }
  }

  async function executeSos() {
    setArming(false)
    setCountdown(5)

    const { location, note } = await resolveSosLocation()
    if (!location) {
      setResultText(note)
      return
    }

    const payload = createSosPayload(form.userId || identity.userId, identity.deviceId, location)
    if (!payload) {
      setResultText('SOS 上报失败：当前位置无效，请先刷新位置')
      return
    }

    try {
      const [serverData, nativeLogs] = await Promise.all([
        triggerSos(payload),
        triggerNativeEmergency(form, payload),
      ])
      await Promise.all([refreshLocalPanel(payload.userId), loadSosHistory(payload.userId)])
      setResultText(note ? `${note}\n${formatLogs(serverData, nativeLogs)}` : formatLogs(serverData, nativeLogs))
    } catch (error) {
      setResultText(`SOS 上报失败: ${error.message}`)
    }
  }

  function renderPageContent() {
    switch (currentPage.id) {
      case 'theme':
        return (
          <ThemePage
            themeState={themeState}
            onCustomSeedChange={onCustomThemeSeedChange}
            onPresetChange={onPresetThemeChange}
            onThemeModeChange={onThemeModeChange}
          />
        )
      case 'config':
        return (
          <ConfigPage
            deviceId={identity.deviceId}
            form={form}
            hasPendingImport={Boolean(pendingImport)}
            loadingInit={loadingInit}
            pendingImportDiffs={pendingImportDiffs}
            pendingImportSummary={pendingImportSummary}
            smsPreview={smsPreview}
            validationHints={validationHints}
            onApplyTemplate={onApplyTemplate}
            onCancelImport={onCancelImport}
            onChange={onChange}
            onConfirmImport={onConfirmImport}
            onExportConfig={onExportConfig}
            onImportClick={onImportClick}
            onResetOnboarding={onResetOnboarding}
            onSaveConfig={onSaveConfig}
          />
        )
      case 'contacts':
        return (
          <ContactsPage
            contactForm={contactForm}
            contactsList={contactsList}
            editingContactId={editingContactId}
            onApplyContactNumber={onApplyContactNumber}
            onCancelEditContact={onCancelEditContact}
            onContactFormChange={onContactFormChange}
            onDeleteContact={onDeleteContact}
            onStartEditContact={onStartEditContact}
            onSubmitContact={onSubmitContact}
          />
        )
      case 'sos':
        return (
          <SosPage
            arming={arming}
            countdown={countdown}
            form={form}
            historyCount={sosHistory.length}
            latestLocation={latestLocation}
            latestSosEvent={latestSosEvent}
            loadingInit={loadingInit}
            locationFreshness={locationFreshness}
            locationRefreshing={locationRefreshPending}
            onboardingDone={onboardingDone}
            onArmSos={onArmSos}
            onCancelSos={onCancelSos}
            onNavigate={navigateToPage}
            onRefreshLocation={onRefreshLocation}
          />
        )
      case 'history':
        return (
          <HistoryPage
            onRefreshSosHistory={onRefreshSosHistory}
            selectedSosEvent={selectedSosEvent}
            setSelectedSosId={setSelectedSosId}
            sosHistory={sosHistory}
          />
        )
      case 'tools':
        return (
          <ToolsPage
            contactsPreview={contactsPreview}
            localPanel={localPanel}
            storageDriver={storageDriver}
            trackingPreview={trackingPreview}
            onAddMockContact={onAddMockContact}
            onAddMockTracking={onAddMockTracking}
            onClearLocalPanel={onClearLocalPanel}
            onExportLocalBundle={onExportLocalBundle}
            onImportLocalBundleClick={onImportLocalBundleClick}
            onInspectContacts={onInspectContacts}
            onInspectTracking={onInspectTracking}
            onRefreshLocalPanel={refreshLocalPanel}
          />
        )
      case 'overview':
      default:
        return (
          <OverviewPage
            contactsList={contactsList}
            deviceId={identity.deviceId}
            form={form}
            healthText={healthText}
            latestLocation={latestLocation}
            localPanel={localPanel}
            locationFreshness={locationFreshness}
            locationRefreshing={locationRefreshPending}
            onboardingDone={onboardingDone}
            pages={pageItems}
            permissionText={permissionText}
            sosHistory={sosHistory}
            storageDriver={storageDriver}
            themeState={themeState}
            trackingBusy={trackingBusy}
            trackingSnapshot={trackingSnapshot}
            onCheckHealth={onCheckHealth}
            onNavigate={navigateToPage}
            onRefreshLocation={onRefreshLocation}
            onResetOnboarding={onResetOnboarding}
            onRunTrackingNow={onRunTrackingNow}
            onToggleTracking={onToggleTracking}
            onTrackingIntervalChange={onTrackingIntervalChange}
            showToolsPage={showToolsPage}
          />
        )
    }
  }

  return (
    <main
      className="md-page"
      onTouchCancel={onPageTouchCancel}
      onTouchEnd={onPageTouchEnd}
      onTouchMove={onPageTouchMove}
      onTouchStart={onPageTouchStart}
    >
      <div
        className={`md-drawer-scrim ${drawerVisible ? 'open' : ''} ${drawerOffset !== null ? 'dragging' : ''}`}
        style={drawerVisible ? { opacity: drawerScrimOpacity } : undefined}
        onClick={closeDrawer}
        aria-hidden={!drawerVisible}
      />

      <aside
        className={`md-drawer ${drawerVisible ? 'open' : ''} ${drawerOffset !== null ? 'dragging' : ''}`}
        style={drawerVisible ? { transform: `translateX(${drawerTransformX}px)` } : undefined}
        aria-hidden={!drawerVisible}
      >
        <div ref={drawerPanelRef} className="md-sidebar">
          <SidebarContent
            currentPage={currentPage}
            developerModeEnabled={developerModeEnabled}
            envText={envText}
            healthText={healthText}
            identity={identity}
            latestLocation={latestLocation}
            locationFreshness={locationFreshness}
            onboardingDone={onboardingDone}
            pageItems={pageItems}
            permissionText={permissionText}
            showToolsPage={showToolsPage}
            themeState={themeState}
            userId={form.userId}
            onClose={closeDrawer}
            onNavigate={navigateToPage}
            onVersionChipClick={onVersionChipClick}
          />
        </div>
      </aside>

      <button
        type="button"
        className="md-menu-fab"
        onClick={drawerOpen ? closeDrawer : openDrawer}
        aria-label={drawerOpen ? '收起侧边栏' : '打开侧边栏'}
      >
        ☰
      </button>

      <div className="md-shell">
        <section ref={mainPanelRef} className="md-main">
          <header className="md-page-header">
            <div className="md-page-heading">
              <div>
                <p className="md-page-label">{currentPage.label}</p>
                <h2>{currentPage.title}</h2>
                <p>{currentPage.description}</p>
              </div>
            </div>
            <span className="md-chip subtle">抽屉导航</span>
          </header>

          <section className="md-feedback-card">
            <div className="md-section-head">
              <h3>最新操作结果</h3>
              <span className="md-chip subtle">实时反馈</span>
            </div>
            <pre className="md-feedback-text">{resultText}</pre>
          </section>

          {renderPageContent()}

          <input
            ref={importInputRef}
            type="file"
            accept="application/json"
            className="md-hidden-input"
            onChange={onImportConfig}
          />
          <input
            ref={localBundleInputRef}
            type="file"
            accept="application/json"
            className="md-hidden-input"
            onChange={onImportLocalBundle}
          />
        </section>
      </div>
    </main>
  )
}

export default App
