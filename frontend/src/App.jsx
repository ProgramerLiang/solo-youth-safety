import { useEffect, useMemo, useRef, useState } from 'react'
import {
  checkHealth,
  clearLocalBackendData,
  createContact,
  createTrackingPoints,
  DEFAULT_USER,
  deleteContact,
  exportLocalBackendBundle,
  getEmergencyConfig,
  importLocalBackendBundle,
  getLocalBackendSnapshot,
  getTrackingTimeline,
  isLocalBackendMode,
  listContacts,
  saveEmergencyConfig,
  triggerSos,
  updateContact,
} from './api'
import { isNativePlatform, triggerNativeEmergency } from './nativeActions'
import { requestInitialPermissions } from './permissions'

const defaultTemplate = '[SOS] 用户{userId}触发报警，位置({lat},{lng}) 时间:{time}'
const compactTemplate = '[SOS]{time} {userId} @({lat},{lng})'
const configVersion = '1.0'
const cacheKey = 'safety_emergency_config_v1'
const onboardingKey = 'safety_onboarding_done_v1'

function readJsonCache(key) {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function writeJsonCache(key, value) {
  localStorage.setItem(key, JSON.stringify(value))
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

function createSosPayload(userId, location) {
  const safeLocation = location ?? { lat: 31.2304, lng: 121.4737, accuracy: 12 }
  return {
    userId,
    deviceId: 'android-device-001',
    triggerType: 'manual',
    timestamp: new Date().toISOString(),
    location: safeLocation,
  }
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
    hints.push('当前电话与短信号码都为空：SOS 仅会上报后端，不会拉起拨号或短信。')
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

function createEmptyForm() {
  return {
    userId: DEFAULT_USER,
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

function createMockTrackingPayload(userId, location, count) {
  const base = location ?? { lat: 31.2304, lng: 121.4737, accuracy: 12 }
  const offset = (count + 1) * 0.0005
  return {
    userId,
    deviceId: 'android-device-001',
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
    userId: typeof bundle?.userId === 'string' ? bundle.userId : DEFAULT_USER,
    hasConfig: Boolean(bundle?.config),
    contactsCount: Array.isArray(bundle?.contacts) ? bundle.contacts.length : 0,
    trackingCount: Array.isArray(bundle?.trackingPoints) ? bundle.trackingPoints.length : 0,
    sosCount: Array.isArray(bundle?.sosEvents) ? bundle.sosEvents.length : 0,
  }
}

function App() {
  const [healthText, setHealthText] = useState('未检查')
  const [resultText, setResultText] = useState('等待操作...')
  const [permissionText, setPermissionText] = useState('首次启动将自动申请权限')
  const [latestLocation, setLatestLocation] = useState(null)
  const [loadingInit, setLoadingInit] = useState(true)
  const [onboardingDone, setOnboardingDone] = useState(false)
  const [activeTab, setActiveTab] = useState('setup')
  const [arming, setArming] = useState(false)
  const [countdown, setCountdown] = useState(5)
  const [pendingImport, setPendingImport] = useState(null)
  const [pendingImportSummary, setPendingImportSummary] = useState(null)
  const [pendingImportDiffs, setPendingImportDiffs] = useState([])
  const [localPanel, setLocalPanel] = useState(null)
  const [contactsList, setContactsList] = useState([])
  const [contactsPreview, setContactsPreview] = useState(null)
  const [trackingPreview, setTrackingPreview] = useState(null)
  const [contactForm, setContactForm] = useState(createEmptyContactForm)
  const [editingContactId, setEditingContactId] = useState(null)
  const [form, setForm] = useState(createEmptyForm)
  const importInputRef = useRef(null)
  const localBundleInputRef = useRef(null)

  const envText = useMemo(
    () => (isNativePlatform() ? 'Android App' : 'Web 浏览器'),
    []
  )

  const previewPayload = useMemo(
    () => createSosPayload(form.userId || DEFAULT_USER, latestLocation),
    [form.userId, latestLocation]
  )

  const smsPreview = useMemo(
    () => renderTemplate(form.smsTemplate || defaultTemplate, previewPayload),
    [form.smsTemplate, previewPayload]
  )

  const validationHints = useMemo(() => getValidationHints(form), [form])

  async function refreshLocalPanel(userId = form.userId || DEFAULT_USER) {
    if (!isLocalBackendMode()) {
      setLocalPanel(null)
      return
    }
    const snapshot = await getLocalBackendSnapshot(userId)
    setLocalPanel(snapshot)
  }

  async function loadContactsPreview(userId = form.userId || DEFAULT_USER) {
    const data = await listContacts(userId)
    setContactsList(data.contacts)
    setContactsPreview(buildContactsPreview(data))
    return data
  }

  async function loadTrackingPreview(userId = form.userId || DEFAULT_USER) {
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

  function resetDataPreviews() {
    setContactsPreview(null)
    setTrackingPreview(null)
  }

  function resetContactManager() {
    setContactsList([])
    setContactForm(createEmptyContactForm())
    setEditingContactId(null)
  }

  useEffect(() => {
    let ignore = false

    async function bootstrap() {
      const done = localStorage.getItem(onboardingKey) === 'done'
      if (!ignore) {
        setOnboardingDone(done)
        setActiveTab(done ? 'sos' : 'setup')
      }

      const cached = readJsonCache(cacheKey)
      if (cached && !ignore) {
        setForm((prev) => ({ ...prev, ...cached }))
      }

      const permissionResult = await requestInitialPermissions()
      if (ignore) return
      setPermissionText(permissionResult.message)
      setLatestLocation(permissionResult.location)

      try {
        const remote = await getEmergencyConfig(DEFAULT_USER)
        if (ignore) return
        const merged = {
          userId: remote.userId || DEFAULT_USER,
          callNumber: remote.callNumber ?? cached?.callNumber ?? '',
          smsNumber: remote.smsNumber ?? cached?.smsNumber ?? '',
          smsTemplate: remote.smsTemplate || cached?.smsTemplate || defaultTemplate,
        }
        setForm(merged)
        writeJsonCache(cacheKey, merged)
        await Promise.all([refreshLocalPanel(merged.userId), loadContactsPreview(merged.userId)])
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
    resetDataPreviews()
    resetContactManager()
    void Promise.all([
      refreshLocalPanel(form.userId || DEFAULT_USER),
      loadContactsPreview(form.userId || DEFAULT_USER),
    ])
  }, [form.userId])

  function onChange(event) {
    const { name, value } = event.target
    setOnboardingDone(false)
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  async function onCheckHealth() {
    try {
      const data = await checkHealth()
      setHealthText(`${data.status} @ ${data.time}`)
    } catch (error) {
      setHealthText(`失败: ${error.message}`)
    }
  }

  async function onSaveConfig(event) {
    event.preventDefault()
    const safeForm = {
      ...form,
      smsTemplate: form.smsTemplate.trim() ? form.smsTemplate : defaultTemplate,
    }
    writeJsonCache(cacheKey, safeForm)
    try {
      const data = await saveEmergencyConfig(safeForm)
      const next = {
        ...safeForm,
        callNumber: data.callNumber ?? '',
        smsNumber: data.smsNumber ?? '',
        smsTemplate: data.smsTemplate,
      }
      setForm(next)
      writeJsonCache(cacheKey, next)
      await refreshLocalPanel(next.userId)
      setResultText('配置保存成功，已完成引导，可切换到 SOS 页')
    } catch (error) {
      setResultText(`后端保存失败，已本地保存: ${error.message}`)
    }
    localStorage.setItem(onboardingKey, 'done')
    setOnboardingDone(true)
    setActiveTab('sos')
  }

  function onArmSos() {
    if (loadingInit) return
    setCountdown(5)
    setArming(true)
    setResultText('SOS 倒计时开始，5 秒后触发，可取消')
  }

  function onCancelSos() {
    setArming(false)
    setCountdown(5)
    setResultText('已取消 SOS')
  }

  function onResetOnboarding() {
    localStorage.removeItem(onboardingKey)
    setOnboardingDone(false)
    setActiveTab('setup')
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
      setResultText('已读取导入文件，请查看预览卡片并确认是否覆盖当前配置。')
      setActiveTab('setup')
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
    writeJsonCache(cacheKey, pendingImport)
    await refreshLocalPanel(pendingImport.userId)
    setOnboardingDone(false)
    setPendingImport(null)
    setPendingImportSummary(null)
    setPendingImportDiffs([])
    setResultText('配置导入成功，请检查后点击“保存配置”同步到后端')
  }

  function onCancelImport() {
    setPendingImport(null)
    setPendingImportSummary(null)
    setPendingImportDiffs([])
    setResultText('已取消导入')
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
    setActiveTab('setup')
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

    const payload = { userId: form.userId || DEFAULT_USER, contact: { name, phone } }
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
      await deleteContact(contact.id, form.userId || DEFAULT_USER)
      if (editingContactId === contact.id) {
        onCancelEditContact()
      }
      await refreshLocalPanel(form.userId || DEFAULT_USER)
      await loadContactsPreview(form.userId || DEFAULT_USER)
      setResultText(`已删除联系人：${contact.name}`)
    } catch (error) {
      setResultText(`删除联系人失败: ${error.message}`)
    }
  }

  async function onClearLocalPanel() {
    try {
      await clearLocalBackendData(form.userId || DEFAULT_USER)
      localStorage.removeItem(cacheKey)
      localStorage.removeItem(onboardingKey)
      setForm(createEmptyForm())
      setOnboardingDone(false)
      setPendingImport(null)
      setPendingImportSummary(null)
      setPendingImportDiffs([])
      resetDataPreviews()
      resetContactManager()
      setActiveTab('setup')
      await refreshLocalPanel(DEFAULT_USER)
      setResultText('已清空当前用户本地后端数据，并重置引导')
    } catch (error) {
      setResultText(`清空本地数据失败: ${error.message}`)
    }
  }

  async function onExportLocalBundle() {
    try {
      const userId = form.userId || DEFAULT_USER
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
      writeJsonCache(cacheKey, nextForm)
      if (bundle.config) {
        localStorage.setItem(onboardingKey, 'done')
      } else {
        localStorage.removeItem(onboardingKey)
      }
      setOnboardingDone(Boolean(bundle.config))
      setPendingImport(null)
      setPendingImportSummary(null)
      setPendingImportDiffs([])
      onCancelEditContact()
      setActiveTab(bundle.config ? 'sos' : 'setup')
      await refreshLocalPanel(bundle.userId)
      await Promise.all([loadContactsPreview(bundle.userId), loadTrackingPreview(bundle.userId)])
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
        form.userId || DEFAULT_USER,
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
        form.userId || DEFAULT_USER,
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
      const data = await loadContactsPreview(form.userId || DEFAULT_USER)
      setResultText(`联系人列表已刷新到下方卡片（共 ${data.contacts.length} 条）`)
    } catch (error) {
      setResultText(`读取联系人失败: ${error.message}`)
    }
  }

  async function onInspectTracking() {
    try {
      const data = await loadTrackingPreview(form.userId || DEFAULT_USER)
      setResultText(`轨迹列表已刷新到下方卡片（最近 1 小时共 ${data.count} 条）`)
    } catch (error) {
      setResultText(`读取轨迹失败: ${error.message}`)
    }
  }

  async function executeSos() {
    setArming(false)
    setCountdown(5)
    const payload = createSosPayload(form.userId, latestLocation)
    try {
      const [serverData, nativeLogs] = await Promise.all([
        triggerSos(payload),
        triggerNativeEmergency(form, payload),
      ])
      await refreshLocalPanel(payload.userId)
      setResultText(formatLogs(serverData, nativeLogs))
    } catch (error) {
      setResultText(`SOS 上报失败: ${error.message}`)
    }
  }

  return (
    <main className="md-page">
      <section className="md-surface">
        <header className="md-header">
          <h1>独行青年安全守护</h1>
          <span className="md-chip">{envText}</span>
        </header>

        {!onboardingDone && (
          <div className="md-banner">首次使用：请先完成配置，再进入 SOS 页。</div>
        )}

        <div className="md-tabs">
          <button
            type="button"
            className={`md-tab ${activeTab === 'setup' ? 'active' : ''}`}
            onClick={() => setActiveTab('setup')}
          >
            配置
          </button>
          <button
            type="button"
            className={`md-tab ${activeTab === 'sos' ? 'active' : ''}`}
            onClick={() => setActiveTab('sos')}
          >
            SOS
          </button>
        </div>

        <div className="md-status-grid">
          <p>权限状态：{permissionText}</p>
          <p>后端健康：{healthText}</p>
          <div className="md-row-actions">
            <button type="button" className="md-btn tonal" onClick={onCheckHealth}>
              检查后端
            </button>
            <button type="button" className="md-btn tonal" onClick={onResetOnboarding}>
              重置引导
            </button>
            <button type="button" className="md-btn tonal" onClick={onExportConfig}>
              导出配置
            </button>
            <button type="button" className="md-btn tonal" onClick={onImportClick}>
              导入配置
            </button>
            {pendingImport && (
              <>
                <button type="button" className="md-btn" onClick={onConfirmImport}>
                  确认导入
                </button>
                <button type="button" className="md-btn tonal" onClick={onCancelImport}>
                  取消导入
                </button>
              </>
            )}
            <input
              ref={importInputRef}
              type="file"
              accept="application/json"
              className="md-hidden-input"
              onChange={onImportConfig}
            />
          </div>
        </div>

        {localPanel && (
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
            <p className="md-local-panel-time">
              最近 SOS：{formatPanelTime(localPanel.latestSos)}
            </p>
            <p className="md-local-panel-note">可用下面的模拟按钮快速验证 contacts / tracking 流程。</p>
            <div className="md-row-actions">
              <button
                type="button"
                className="md-btn tonal"
                onClick={() => refreshLocalPanel(localPanel.userId)}
              >
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
                查看联系人
              </button>
              <button type="button" className="md-btn tonal" onClick={onInspectTracking}>
                查看轨迹
              </button>
              <button type="button" className="md-btn tonal" onClick={onClearLocalPanel}>
                清空本地数据
              </button>
              <input
                ref={localBundleInputRef}
                type="file"
                accept="application/json"
                className="md-hidden-input"
                onChange={onImportLocalBundle}
              />
            </div>
          </section>
        )}

        {(contactsPreview || trackingPreview) && (
          <section className="md-preview-section">
            {contactsPreview && (
              <article className="md-data-card">
                <div className="md-data-card-header">
                  <h3>联系人列表</h3>
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

        {activeTab === 'setup' ? (
          <section className="md-setup-stack">
            <form className="md-form md-section-card" onSubmit={onSaveConfig}>
              <h2>紧急通知配置</h2>
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
                rows={4}
              />

              <div className="md-template-actions">
                <button
                  type="button"
                  className="md-btn tonal"
                  onClick={() => onApplyTemplate('default')}
                >
                  使用默认模板
                </button>
                <button
                  type="button"
                  className="md-btn tonal"
                  onClick={() => onApplyTemplate('compact')}
                >
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

            <section className="md-section-card md-contact-section">
              <div className="md-data-card-header">
                <h2>紧急联系人管理</h2>
                <span className="md-chip">{contactsList.length} 人</span>
              </div>
              <p className="md-section-hint">可新增、编辑、删除联系人，并一键将号码填入电话或短信配置。</p>

              <form className="md-contact-form" onSubmit={onSubmitContact}>
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
          </section>
        ) : (
          <section className="md-sos-panel">
            <h2>SOS 快速操作</h2>
            <p>完成配置后即可一键触发，支持 5 秒倒计时取消。</p>
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
            <button
              type="button"
              className="md-btn tonal"
              onClick={() => setActiveTab('setup')}
            >
              返回配置页
            </button>
          </section>
        )}

        <pre className="md-log">{resultText}</pre>
      </section>
    </main>
  )
}

export default App
