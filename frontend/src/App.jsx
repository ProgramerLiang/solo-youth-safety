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

function App() {
  const [healthText, setHealthText] = useState('未检查')
  const [resultText, setResultText] = useState('')
  const [permissionText, setPermissionText] = useState('首次启动将自动申请权限')
  const [latestLocation, setLatestLocation] = useState(null)
  const [loadingInit, setLoadingInit] = useState(true)
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

  useEffect(() => {
    let ignore = false

    async function bootstrap() {
      const permissionResult = await requestInitialPermissions()
      if (ignore) return
      setPermissionText(permissionResult.message)
      setLatestLocation(permissionResult.location)

      try {
        const data = await getEmergencyConfig(DEFAULT_USER)
        if (ignore) return
        setForm({
          userId: data.userId,
          callNumber: data.callNumber ?? '',
          smsNumber: data.smsNumber ?? '',
          smsTemplate: data.smsTemplate || defaultTemplate,
        })
        setResultText('请先完成紧急通知配置，然后可触发 SOS')
      } catch {
        if (!ignore) {
          setResultText('加载配置失败，请先启动后端服务')
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

  function onChange(event) {
    const { name, value } = event.target
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
    try {
      const data = await saveEmergencyConfig(form)
      setForm((prev) => ({
        ...prev,
        callNumber: data.callNumber ?? '',
        smsNumber: data.smsNumber ?? '',
        smsTemplate: data.smsTemplate,
      }))
      setResultText('配置保存成功，已可触发 SOS')
    } catch (error) {
      setResultText(`保存失败: ${error.message}`)
    }
  }

  async function onTriggerSos() {
    const payload = createSosPayload(form.userId, latestLocation)
    try {
      const [serverData, nativeLogs] = await Promise.all([
        triggerSos(payload),
        triggerNativeEmergency(form, payload),
      ])
      const serverLines = serverData.notifications.map(
        (n) => `server/${n.channel}: ${n.status} (${n.detail})`
      )
      const nativeLines = nativeLogs.map(
        (n) => `native/${n.channel}: ${n.status} (${n.detail})`
      )
      setResultText(['SOS 已上报', ...serverLines, ...nativeLines].join('\n'))
    } catch (error) {
      setResultText(`SOS 上报失败: ${error.message}`)
    }
  }

  return (
    <main className="page">
      <section className="card">
        <h1>独行青年安全守护（Android MVP）</h1>
        <p>运行环境：{envText}</p>
        <p>权限状态：{permissionText}</p>
        <p>后端健康状态：{healthText}</p>

        <div className="actions">
          <button type="button" onClick={onCheckHealth}>
            检查后端
          </button>
        </div>

        <form className="form" onSubmit={onSaveConfig}>
          <h2>首次引导：紧急通知配置</h2>

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

          <button type="submit" disabled={loadingInit}>
            保存配置
          </button>
        </form>

        <div className="actions">
          <button
            type="button"
            className="danger"
            onClick={onTriggerSos}
            disabled={loadingInit}
          >
            触发 SOS（服务端 + Android）
          </button>
        </div>

        <pre className="result">{resultText || '等待操作...'}</pre>
      </section>
    </main>
  )
}

export default App
