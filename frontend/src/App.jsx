import { useEffect, useMemo, useRef, useState } from 'react'
import {
  checkHealth,
  DEFAULT_USER,
  getEmergencyConfig,
  saveEmergencyConfig,
  triggerSos,
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
  const [form, setForm] = useState({
    userId: DEFAULT_USER,
    callNumber: '',
    smsNumber: '',
    smsTemplate: defaultTemplate,
  })
  const importInputRef = useRef(null)

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
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'safety-config.json'
    a.click()
    URL.revokeObjectURL(url)
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

  function onConfirmImport() {
    if (!pendingImport) {
      return
    }
    setForm(pendingImport)
    writeJsonCache(cacheKey, pendingImport)
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

  async function executeSos() {
    setArming(false)
    setCountdown(5)
    const payload = createSosPayload(form.userId, latestLocation)
    try {
      const [serverData, nativeLogs] = await Promise.all([
        triggerSos(payload),
        triggerNativeEmergency(form, payload),
      ])
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
          <form className="md-form" onSubmit={onSaveConfig}>
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
