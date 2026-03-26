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
const identityModule = await import('./identity.js')
const nativeActionsModule = await import('./nativeActions.js')
const {
  buildSmsTemplateMapUrl,
  defaultSmsTemplate,
  getSmsTemplateValidationError,
  normalizeSmsTemplate,
  renderSmsTemplate,
  validateSmsTemplate,
} = await import('./template.js')
const { buildSosState, formatSosStateText, normalizeStepStatus } = await import('./sosState.js')

const {
  checkHealth,
  clearLocalBackendData,
  exportLocalBackendBundle,
  getEmergencyConfig,
  importLocalBackendBundle,
  listSosEvents,
  saveEmergencyConfig,
  triggerSos,
} = apiModule
const { savePersistedIdentity } = identityModule
const { buildNativeEmergencyPayload, mapNativeDetail, normalizeNativeLog } = nativeActionsModule

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
  delete globalThis.fetch
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

test('triggerSos 在本地后端模式下会返回与当前契约一致的 call/sms 状态枚举', async () => {
  globalThis.localStorage.setItem('safety_force_local_backend', '1')
  await clearLocalBackendData('u_local')
  await saveEmergencyConfig({
    userId: 'u_local',
    callNumber: '110',
    smsNumber: '13800138000',
    smsTemplate: '[SOS]{userId}|{deviceId}|{mapUrl}',
  })

  const payload = createSosPayload({ userId: 'u_local', deviceId: 'd_local' })
  const response = await triggerSos(payload)
  const smsLog = response.notifications.find((item) => item.channel === 'sms')
  const callLog = response.notifications.find((item) => item.channel === 'call')

  assert.equal(callLog?.status, 'triggered')
  assert.equal(callLog?.detail, 'local simulated call trigger')
  assert.equal(smsLog?.status, 'dispatched')
  assert.equal(
    smsLog?.detail,
    'local simulated sms dispatch: [SOS]u_local|d_local|https://uri.amap.com/marker?position=121.47,31.23'
  )
})

test('triggerSos 在本地后端缺少号码时仍保留 skipped 状态', async () => {
  globalThis.localStorage.setItem('safety_force_local_backend', '1')
  await clearLocalBackendData('u_local_skipped')
  await saveEmergencyConfig({
    userId: 'u_local_skipped',
    callNumber: '',
    smsNumber: '',
    smsTemplate: '[SOS]{userId}',
  })

  const response = await triggerSos(
    createSosPayload({ userId: 'u_local_skipped', deviceId: 'd_local_skipped' })
  )

  assert.deepEqual(
    response.notifications.map((item) => ({ channel: item.channel, status: item.status })),
    [
      { channel: 'call', status: 'skipped' },
      { channel: 'sms', status: 'skipped' },
    ]
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

test('normalizeNativeLog 会保留原始 detail，并把 Android 原生状态映射为前端统一状态与中文原因', () => {
  assert.deepEqual(
    normalizeNativeLog({
      channel: 'sms',
      status: 'attempted',
      detail: 'SmsManager invoked: 13800138000, parts=1',
    }),
    {
      channel: 'sms',
      status: 'dispatched',
      detail: '短信已尝试发送（已调用 SmsManager，非确认对方已收到）',
      rawDetail: 'SmsManager invoked: 13800138000, parts=1',
    }
  )

  assert.deepEqual(
    normalizeNativeLog({
      channel: 'call',
      status: 'launched',
      detail: 'ACTION_CALL launched: 110',
    }),
    {
      channel: 'call',
      status: 'triggered',
      detail: '拨号已尝试拉起（已启动 ACTION_CALL，非确认对方已接通）',
      rawDetail: 'ACTION_CALL launched: 110',
    }
  )
})

test('mapNativeDetail 会把 Android 权限/边界错误映射为中文可见原因', () => {
  assert.equal(
    mapNativeDetail('sms', 'failed', 'SEND_SMS permission denied'),
    '缺少短信权限，无法直接发送短信'
  )
  assert.equal(
    mapNativeDetail('call', 'failed', 'Timed out waiting for ACTION_CALL launch result'),
    '拨号拉起超时，系统未返回明确结果'
  )
})

test('normalizeStepStatus 会把原生/后端细粒度状态归一为统一步骤状态', () => {
  assert.equal(normalizeStepStatus('sent'), 'success')
  assert.equal(normalizeStepStatus('triggered'), 'success')
  assert.equal(normalizeStepStatus('permission-denied'), 'blocked')
  assert.equal(normalizeStepStatus('failed', 'SEND_SMS permission denied'), 'failed')
  assert.equal(normalizeStepStatus('skipped'), 'skipped')
})

test('buildSosState 会生成可稳定消费的部分成功摘要、补救动作与中文文案', () => {
  const state = buildSosState({
    location: createSosPayload().location,
    locationNote: '位置刷新失败，已继续使用上次记录的位置。',
    serverData: {
      notifications: [
        { channel: 'call', status: 'sent', detail: 'server call accepted', destination: '110' },
        { channel: 'sms', status: 'failed', detail: 'gateway timeout', destination: '13800138000' },
      ],
    },
    nativeLogs: [
      { channel: 'call', status: 'triggered', detail: '拨号已尝试拉起' },
      { channel: 'sms', status: 'failed', detail: '缺少短信权限，无法直接发送短信' },
    ],
  })

  assert.equal(state.finalStatus, 'partial-success')
  assert.equal(state.stage, 'partial-success')
  assert.match(state.summary, /部分完成/)
  assert.ok(state.remedies.some((item) => item.includes('短信权限')))
  assert.ok(state.remedies.some((item) => item.includes('网络连接') || item.includes('稍后重试')))
  assert.match(formatSosStateText(state), /补救建议：/)
})

test('buildSosState 在定位失败时会输出阻断状态与引导文案', () => {
  const state = buildSosState({
    location: null,
    locationNote: '无法获取当前位置，已取消 SOS；请先点击“刷新当前位置”并确认定位权限。',
  })

  assert.equal(state.finalStatus, 'location-failed')
  assert.equal(state.stage, 'location-failed')
  assert.equal(state.steps.location.status, 'blocked')
  assert.match(formatSosStateText(state), /请先点击“刷新当前位置”并确认定位权限/)
})

test('import/list/export 本地 SOS 快照时会保留 failed / triggered / dispatched 等细粒度状态', async () => {
  globalThis.localStorage.setItem('safety_force_local_backend', '1')
  await clearLocalBackendData('u_statuses')

  await importLocalBackendBundle({
    mode: 'local',
    version: '1.0',
    exportedAt: '2026-03-26T00:00:00Z',
    userId: 'u_statuses',
    config: null,
    contacts: [],
    trackingPoints: [],
    sosEvents: [
      {
        id: 'sos_status_1',
        userId: 'u_statuses',
        deviceId: 'd_statuses',
        triggerType: 'manual',
        timestamp: '2026-03-26T00:00:00Z',
        location: { lat: 31.23, lng: 121.47, accuracy: 10 },
        notifications: [
          { channel: 'call', status: 'triggered', detail: '拨号已尝试拉起', destination: '110' },
          { channel: 'sms', status: 'failed', detail: '短信网关超时', destination: '13800138000' },
          { channel: 'sms', status: 'dispatched', detail: '短信已进入发送队列', destination: '13800138000' },
        ],
      },
    ],
  })

  const history = await listSosEvents('u_statuses', 10)
  assert.deepEqual(
    history.items[0]?.notifications.map((item) => item.status),
    ['triggered', 'failed', 'dispatched']
  )

  const bundle = await exportLocalBackendBundle('u_statuses')
  assert.deepEqual(
    bundle.sosEvents[0]?.notifications.map((item) => item.status),
    ['triggered', 'failed', 'dispatched']
  )
})

test('checkHealth 会为远端请求自动注入身份请求头', async () => {
  savePersistedIdentity({ userId: 'u_header', deviceId: 'd_header', platform: 'web' })

  let capturedRequest = null
  globalThis.fetch = async (input, init = {}) => {
    capturedRequest = { input, init }
    return new Response(JSON.stringify({ status: 'ok' }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  }

  const result = await checkHealth()

  assert.equal(result.status, 'ok')
  assert.equal(capturedRequest?.input, 'http://127.0.0.1:8000/api/v1/health')
  assert.equal(capturedRequest?.init?.headers?.['X-Safety-User-Id'], 'u_header')
  assert.equal(capturedRequest?.init?.headers?.['X-Safety-Device-Id'], 'd_header')
  assert.equal(capturedRequest?.init?.headers?.['X-Safety-Client-Mode'], 'remote')
  assert.equal(capturedRequest?.init?.headers?.['Content-Type'], 'application/json')
})

test('getEmergencyConfig 在 401/403/422 时抛出友好中文错误', async () => {
  savePersistedIdentity({ userId: 'u_error', deviceId: 'd_error', platform: 'web' })

  const cases = [
    { status: 401, body: { detail: 'missing identity' }, message: '身份信息缺失，请刷新页面后重试' },
    {
      status: 403,
      body: { detail: 'resource forbidden' },
      message: '当前身份无权访问该数据，请确认使用的是同一用户/设备',
    },
    {
      status: 422,
      body: { detail: [{ msg: 'invalid header' }] },
      message: '请求参数不完整或身份信息格式无效，请检查后重试',
    },
  ]

  for (const item of cases) {
    globalThis.fetch = async () =>
      new Response(JSON.stringify(item.body), {
        status: item.status,
        headers: { 'content-type': 'application/json' },
      })

    await assert.rejects(() => getEmergencyConfig('u_error'), new Error(item.message))
  }
})
