import { useEffect, useMemo, useState } from 'react'
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
const cacheKey = 'safety_emergency_config_v1'

function readCachedConfig() {
  try {
    const raw = localStorage.getItem(cacheKey)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function cacheConfig(config) {
  localStorage.setItem(cacheKey, JSON.stringify(config))
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

function formatLogs(serverData, nativeLogs) {
  const serverLines = serverData.notifications.map(
    (n) => `server/${n.channel}: ${n.status} (${n.detail})`
  )
  const nativeLines = nativeLogs.map(
    (n) => `native/${n.channel}: ${n.status} (${n.detail})`
  )
  return ['SOS 已上报', ...serverLines, ...nativeLines].join('\n')
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

function App() {
  const [healthText, setHealthText] = useState('未检查')
  const [resultText, setResultText] = useState('等待操作...')
  const [permissionText, setPermissionText] = useState('首次启动将自动申请权限')
  const [latestLocation, setLatestLocation] = useState(null)
  const [loadingInit, setLoadingInit] = useState(true)
  const [arming, setArming] = useState(false)
  const [countdown, setCountdown] = useState(5)
  const [configSaved, setConfigSaved] = useState(false)
  const [form, setForm] = useState({
    userId: DEFAULT_USER,
    callNumber: '',
    smsNumber: '',
    smsTemplate: defaultTemplate,
  })

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

  const stepState = useMemo(() => {
    if (loadingInit) {
      return 1
    }
    return configSaved ? 3 : 2
  }, [loadingInit, configSaved])

  useEffect(() => {
    let ignore = false

    async function bootstrap() {
      const cached = readCachedConfig()
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
        cacheConfig(merged)
        setResultText('步骤 2：请检查并保存紧急通知配置')
      } catch {
        if (!ignore) {
          setResultText('后端不可用，已使用本地配置，可继续配置与测试')
        }
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
    setConfigSaved(false)
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
    cacheConfig(safeForm)
    try {
      const data = await saveEmergencyConfig(safeForm)
      const next = {
        ...safeForm,
        callNumber: data.callNumber ?? '',
        smsNumber: data.smsNumber ?? '',
        smsTemplate: data.smsTemplate,
      }
      setForm(next)
      cacheConfig(next)
      setConfigSaved(true)
      setResultText('步骤 3：配置完成，已可触发 SOS')
    } catch (error) {
      setConfigSaved(true)
      setResultText(`后端保存失败，已本地保存: ${error.message}`)
    }
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

        <ol className="md-stepper">
          <li className={stepState >= 1 ? 'active' : ''}>1. 权限申请</li>
          <li className={stepState >= 2 ? 'active' : ''}>2. 紧急配置</li>
          <li className={stepState >= 3 ? 'active' : ''}>3. 完成引导</li>
        </ol>

        <div className="md-status-grid">
          <p>权限状态：{permissionText}</p>
          <p>后端健康：{healthText}</p>
          <button type="button" className="md-btn tonal" onClick={onCheckHealth}>
            检查后端
          </button>
        </div>

        <form className="md-form" onSubmit={onSaveConfig}>
          <h2>步骤 2：紧急通知配置</h2>
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
            保存配置并完成引导
          </button>
        </form>

        <section className="md-actions">
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

        <pre className="md-log">{resultText}</pre>
      </section>
    </main>
  )
}

export default App
