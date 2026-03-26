import assert from 'node:assert/strict'
import test from 'node:test'

class LocalStorageMock {
  constructor() {
    this.store = new Map()
  }

  getItem(key) {
    return this.store.has(key) ? this.store.get(key) : null
  }

  setItem(key, value) {
    this.store.set(key, String(value))
  }

  removeItem(key) {
    this.store.delete(key)
  }

  clear() {
    this.store.clear()
  }
}

if (!globalThis.localStorage) {
  globalThis.localStorage = new LocalStorageMock()
}

const { Capacitor } = await import('@capacitor/core')
const apiModule = await import('./api.js')
const nativeActionsModule = await import('./nativeActions.js')
const {
  buildSmsTemplateMapUrl,
  defaultSmsTemplate,
  getSmsTemplateValidationError,
  normalizeSmsTemplate,
  renderSmsTemplate,
  validateSmsTemplate,
} = await import('./template.js')

const { clearLocalBackendData, saveEmergencyConfig, triggerSos } = apiModule
const { buildNativeEmergencyPayload } = nativeActionsModule

function createSosPayload(overrides = {}) {
  return {
    userId: 'u_test',
    deviceId: 'd_test',
    triggerType: 'manual',
    timestamp: '2026-03-25T12:00:00Z',
    location: { lat: 31.23, lng: 121.47, accuracy: 15 },
    ...overrides,
  }
}

test.beforeEach(() => {
  globalThis.localStorage.clear()
  Capacitor.isNativePlatform = () => false
})

test('normalizeSmsTemplate 在空字符串时回退默认模板', () => {
  assert.equal(normalizeSmsTemplate(''), defaultSmsTemplate)
  assert.equal(normalizeSmsTemplate('   '), defaultSmsTemplate)
})

test('getSmsTemplateValidationError 能识别未知占位符', () => {
  const error = getSmsTemplateValidationError('[SOS]{userId} {foo}')
  assert.match(error, /不支持的占位符/)
  assert.match(error, /\{foo\}/)
})

test('validateSmsTemplate 会拒绝未闭合的花括号', () => {
  assert.throws(() => validateSmsTemplate('[SOS]{userId'), /未闭合的 \{/
  )
})

test('renderSmsTemplate 会替换全部支持的占位符', () => {
  const result = renderSmsTemplate('[SOS]{userId}|{deviceId}|{lat}|{lng}|{time}|{mapUrl}', {
    userId: 'u_test',
    deviceId: 'd_test',
    location: { lat: 31.23, lng: 121.47 },
    timestamp: '2026-03-24T12:00:00Z',
  })

  assert.equal(
    result,
    '[SOS]u_test|d_test|31.23|121.47|2026-03-24T12:00:00Z|https://uri.amap.com/marker?position=121.47,31.23'
  )
})

test('renderSmsTemplate 在缺失字段时使用 unknown 占位', () => {
  const result = renderSmsTemplate('[SOS]{userId}|{lat}|{time}|{mapUrl}', { userId: 'u_only' })
  assert.equal(result, '[SOS]u_only|unknown|unknown|unknown')
})

test('buildSmsTemplateMapUrl 在有坐标时生成高德 marker 链接', () => {
  assert.equal(
    buildSmsTemplateMapUrl(createSosPayload()),
    'https://uri.amap.com/marker?position=121.47,31.23'
  )
})

test('buildSmsTemplateMapUrl 在缺少坐标时降级为 unknown', () => {
  assert.equal(buildSmsTemplateMapUrl({ location: { lat: 31.23 } }), 'unknown')
  assert.equal(buildSmsTemplateMapUrl({}), 'unknown')
})

test('triggerSos 在本地后端模式下的 simulated sms 与模板渲染一致', async () => {
  globalThis.localStorage.setItem('safety_force_local_backend', '1')
  await clearLocalBackendData('u_local')
  await saveEmergencyConfig({
    userId: 'u_local',
    callNumber: '',
    smsNumber: '13800138000',
    smsTemplate: '[SOS]{userId}|{deviceId}|{mapUrl}',
  })

  const payload = createSosPayload({ userId: 'u_local', deviceId: 'd_local' })
  const response = await triggerSos(payload)
  const smsLog = response.notifications.find((item) => item.channel === 'sms')

  assert.equal(smsLog?.status, 'sent')
  assert.equal(
    smsLog?.detail,
    'local simulated sms: [SOS]u_local|d_local|https://uri.amap.com/marker?position=121.47,31.23'
  )
})

test('buildNativeEmergencyPayload 会把发送给原生插件的 smsBody 渲染为真实模板内容', () => {
  const payload = createSosPayload({ userId: 'u_native', deviceId: 'd_native' })
  const result = buildNativeEmergencyPayload(
    {
      callNumber: ' 110 ',
      smsNumber: ' 13800138000 ',
      smsTemplate: '[SOS]{userId}|{mapUrl}|{time}',
    },
    payload
  )

  assert.deepEqual(result, {
    callNumber: '110',
    smsNumber: '13800138000',
    smsBody:
      '[SOS]u_native|https://uri.amap.com/marker?position=121.47,31.23|2026-03-25T12:00:00Z',
  })
})
