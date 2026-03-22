import { useEffect, useState } from 'react'
import {
  checkHealth,
  DEFAULT_USER,
  getEmergencyConfig,
  saveEmergencyConfig,
  triggerSos,
} from './api'
import { isNativePlatform, triggerNativeEmergency } from './nativeActions'

function buildSosPayload(userId) {
  return {
    userId,
    deviceId: 'android-device-001',
    triggerType: 'manual',
    timestamp: new Date().toISOString(),
    location: {
      lat: 31.2304,
      lng: 121.4737,
      accuracy: 12,
    },
  }
}

function App() {
  const [healthText, setHealthText] = useState('未检查')
  const [resultText, setResultText] = useState('')
  const [form, setForm] = useState({
    userId: DEFAULT_USER,
    callNumber: '',
    smsNumber: '',
    smsTemplate: '[SOS] 用户{userId}触发报警，位置({lat},{lng}) 时间:{time}',
  })

  useEffect(() => {
    let ignore = false

    async function loadConfig() {
      try {
        const data = await getEmergencyConfig(DEFAULT_USER)
        if (ignore) {
          return
        }
        setForm({
          userId: data.userId,
          callNumber: data.callNumber ?? '',
          smsNumber: data.smsNumber ?? '',
          smsTemplate: data.smsTemplate,
        })
      } catch {
        if (!ignore) {
          setResultText('加载配置失败，请先启动后端服务')
        }
      }
    }

    loadConfig()
    return () => {
      ignore = true
    }
  }, [])

  async function onCheckHealth() {
    try {
      const data = await checkHealth()
      setHealthText(`${data.status} @ ${data.time}`)
    } catch (error) {
      setHealthText(`失败: ${error.message}`)
    }
  }

  function onChange(event) {
    const { name, value } = event.target
    setForm((prev) => ({ ...prev, [name]: value }))
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
      setResultText('配置保存成功（号码可留空）')
    } catch (error) {
      setResultText(`保存失败: ${error.message}`)
    }
  }

  async function onTriggerSos() {
    const payload = buildSosPayload(form.userId)

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
        <p>运行环境：{isNativePlatform() ? 'Android App' : 'Web 浏览器'}</p>
        <p>后端健康状态：{healthText}</p>
        <button type="button" onClick={onCheckHealth}>
          检查后端
        </button>

        <form className="form" onSubmit={onSaveConfig}>
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

          <button type="submit">保存配置</button>
        </form>

        <div className="actions">
          <button type="button" className="danger" onClick={onTriggerSos}>
            触发 SOS（服务端模拟 + Android 拨号/短信）
          </button>
        </div>

        <pre className="result">{resultText || '等待操作...'}</pre>
      </section>
    </main>
  )
}

export default App
