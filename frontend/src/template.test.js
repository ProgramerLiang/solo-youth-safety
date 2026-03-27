import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
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

test('tracking 页面文案明确仅限前台采样与补发，不承诺长期后台守护', () => {
  const appSource = readFileSync(new URL('./App.jsx', import.meta.url), 'utf8')

  assert.match(appSource, /label: '采样'/)
  assert.match(appSource, /title: '轨迹采样与补发'/)
  assert.match(appSource, /description: '独立查看前台周期采样、待补发与同步状态。'/)
  assert.match(appSource, /仅会在应用前台存活期间按设定周期采样当前位置并写入轨迹/)
  assert.match(appSource, /不承诺被杀后台后继续追踪/)
  assert.match(appSource, /label="采样状态"/)
  assert.match(appSource, /前台采样已开启/)
  assert.match(appSource, /前台采样已关闭/)
  assert.match(appSource, /span>前台采样</)
  assert.match(appSource, /采样中/)
  assert.match(appSource, /前往采样页/)
  assert.match(appSource, /hint="仅应用前台存活期间自动采样"/)
  assert.match(appSource, /hint="用于判断前台采样是否在工作"/)
})

test('抽屉导航保留左缘开启、交互屏蔽与拖动提交阈值约束', () => {
  const appSource = readFileSync(new URL('./App.jsx', import.meta.url), 'utf8')

  assert.match(appSource, /touch\.clientX <= Math\.max\(drawerEdgeFallbackPx, window\.innerWidth \* 0\.12\)/)
  assert.match(appSource, /button, input, textarea, select, a, label, summary, \[role="button"\], \[data-no-drawer-swipe="true"\]/)
  assert.match(appSource, /if \(gestureBlocked \|\| !canStartDrawerOpenGesture\(touch, mainPanelRef\.current\)\) \{\s+touchSessionRef\.current = null\s+return\s+\}/s)
  assert.match(appSource, /touchSessionRef\.current = \{\s+startX: touch\.clientX,[\s\S]*mode: 'open',[\s\S]*drawerWidth: measuredDrawerWidth,\s+\}/)
  assert.match(appSource, /if \(absDx < drawerDragActivatePx \|\| absDx <= absDy\) \{\s+return\s+\}/s)
  assert.match(appSource, /setDrawerOpen\(session\.mode === 'open' \? shouldCommit : !shouldCommit\)/)
})

test('抽屉导航会在遮罩关闭、点击导航项后关闭，并同步 hash 与 hashchange', () => {
  const appSource = readFileSync(new URL('./App.jsx', import.meta.url), 'utf8')

  assert.match(appSource, /className=\{`md-drawer-scrim \$\{drawerVisible \? 'open' : ''\} \$\{drawerOffset !== null \? 'dragging' : ''\}`\}/)
  assert.match(appSource, /onClick=\{closeDrawer\}/)
  assert.match(appSource, /function navigateToPage\(pageId\) \{[\s\S]*setActivePage\(resolvePageId\(pageId, pageItems, onboardingDone \? defaultPageId : 'config'\)\)\s+setDrawerOpen\(false\)\s+setDrawerOffset\(null\)\s+\}/)
  assert.match(appSource, /<PageButton[\s\S]*onClick=\{\(\) => onNavigate\(page\.id\)\}/)
  assert.ok(appSource.includes('<MobileNavHints />'))
  assert.match(appSource, /aria-label="移动端导航提示"/)
  assert.match(appSource, /菜单入口/)
  assert.match(appSource, /点左上角或左滑空白处打开菜单/)
  assert.match(appSource, /保持单抽屉导航不变，需要切整页时优先从这里进入/)
  assert.match(appSource, /快速切页/)
  assert.match(appSource, /顶部页面条可左右滑动，也可直接点选切换/)
  assert.match(appSource, /常用页面保留在首屏，单手横滑即可继续浏览更多页面标签/)
  assert.match(appSource, /if \(typeof window !== 'undefined' && window\.location\.hash !== `#\$\{activePage\}`\) \{\s+window\.history\.replaceState\(null, '', `#\$\{activePage\}`\)\s+\}/s)
  assert.match(appSource, /window\.addEventListener\('hashchange', handleHashChange\)/)
  assert.match(appSource, /window\.removeEventListener\('hashchange', handleHashChange\)/)
})

test('overview 页面继续限制为摘要加跳转，避免长内容回流首页', () => {
  const appSource = readFileSync(new URL('./App.jsx', import.meta.url), 'utf8')

  assert.match(appSource, /label: '总览'/)
  assert.match(appSource, /title: '状态总览'/)
  assert.match(appSource, /description: '先看当前状态，再进入具体功能页。'/)
  assert.match(appSource, /const mobilePriorityPageIds = \['overview', 'sos', 'config', 'contacts', 'history', 'tracking'\]/)
  assert.match(appSource, /<h3>功能跳转<\/h3>/)
  assert.match(appSource, /每个核心功能都单独放到独立页面；总览只保留摘要和跳转，不再塞满长内容/)
  assert.match(appSource, /\.filter\(\(page\) => page\.id !== 'overview'\)/)
  assert.match(appSource, /<h3>当前位置速览<\/h3>/)
  assert.match(appSource, /<h3>主流程入口<\/h3>/)
  assert.match(appSource, /前往 SOS/)
  assert.match(appSource, /前往采样页/)
})

test('通知配置页面继续聚焦号码、模板与导入导出，不回流联系人或 SOS 触发操作', () => {
  const appSource = readFileSync(new URL('./App.jsx', import.meta.url), 'utf8')

  assert.match(appSource, /label: '通知配置'/)
  assert.match(appSource, /title: '紧急通知配置'/)
  assert.match(appSource, /description: '设置号码、短信模板与配置导入导出。'/)
  assert.match(appSource, /<h2>紧急通知配置<\/h2>/)
  assert.match(appSource, /<label htmlFor="callNumber">电话号码（可留空）<\/label>/)
  assert.match(appSource, /<label htmlFor="smsNumber">短信号码（可留空）<\/label>/)
  assert.match(appSource, /<label htmlFor="smsTemplate">短信模板（支持自定义）<\/label>/)
  assert.match(appSource, /使用默认模板/)
  assert.match(appSource, /使用简洁模板/)
  assert.match(appSource, /可用变量：\{buildSupportedPlaceholdersText\(\)\}/)
  assert.match(appSource, /短信预览：/)
  assert.match(appSource, /保存配置/)
})

test('联系人页面保留一键填充优先、次操作补充、编辑删除后置的单手流程', () => {
  const appSource = readFileSync(new URL('./App.jsx', import.meta.url), 'utf8')

  assert.match(appSource, /label: '联系人'/)
  assert.match(appSource, /title: '紧急联系人管理'/)
  assert.match(appSource, /description: '新增、编辑、删除联系人，并一键填入号码。'/)
  assert.match(appSource, /function handleApplyBoth\(phone\) \{\s+onApplyContactNumber\('callNumber', phone\)\s+onApplyContactNumber\('smsNumber', phone\)\s+\}/s)
  assert.match(appSource, /支持新增、编辑、删除联系人；高频操作前置，一键填入电话和短信，方便单手快速完成配置。/)
  assert.match(appSource, /<h2>联系人列表<\/h2>/)
  assert.match(appSource, /一键填入电话和短信/)
  assert.match(appSource, /仅填电话/)
  assert.match(appSource, /仅填短信/)
  assert.match(appSource, /编辑/)
  assert.match(appSource, /删除/)
  assert.match(appSource, /当前用户还没有联系人，请先新增至少 1 位可信联系人。/)
})

test('SOS 页面继续强调倒计时触发、先确认位置、结果摘要后置，不把历史详情塞回首屏', () => {
  const appSource = readFileSync(new URL('./App.jsx', import.meta.url), 'utf8')

  assert.match(appSource, /label: 'SOS'/)
  assert.match(appSource, /title: '一键求助'/)
  assert.match(appSource, /description: '执行 5 秒倒计时报警，并直接发送短信 \/ 发起拨号。'/)
  assert.match(appSource, /<h2>SOS 快速操作<\/h2>/)
  assert.match(appSource, /触发 SOS（倒计时 5 秒）/)
  assert.match(appSource, /取消 SOS（剩余 \{countdown\}s）/)
  assert.match(appSource, /<h3>位置确认与触发说明<\/h3>/)
  assert.match(appSource, /SOS 前建议先确认位置/)
  assert.match(appSource, /检查配置/)
  assert.match(appSource, /查看历史/)
  assert.match(appSource, /触发完成后，可前往“历史”页面查看事件详情。/)
  assert.match(appSource, /<h2>SOS 结果摘要<\/h2>/)
  assert.match(appSource, /先完成触发或位置确认，再回看执行结果与失败原因，减少首屏干扰。/)
  assert.match(appSource, /查看失败原因/)
})

test('历史页面继续保持列表在前、详情在后，只展示事件与通知结果明细', () => {
  const appSource = readFileSync(new URL('./App.jsx', import.meta.url), 'utf8')

  assert.match(appSource, /label: '历史'/)
  assert.match(appSource, /title: 'SOS 历史记录'/)
  assert.match(appSource, /description: '查看每次事件的时间、位置与通知结果。'/)
  assert.match(appSource, /<h2>SOS 历史记录<\/h2>/)
  assert.match(appSource, /列表在前、详情在后，方便在手机上先选中事件，再继续查看通知结果。/)
  assert.match(appSource, /刷新历史/)
  assert.match(appSource, /className=\{`md-history-item \$\{selectedSosEvent\?\.id === event\.id \? 'active' : ''\}`\}/)
  assert.match(appSource, /<strong>事件 ID：<\/strong>/)
  assert.match(appSource, /<strong>触发时间：<\/strong>/)
  assert.match(appSource, /<strong>触发方式：<\/strong>/)
  assert.match(appSource, /<strong>设备：<\/strong>/)
  assert.match(appSource, /<strong>位置：<\/strong>/)
  assert.match(appSource, /<h3 className="md-history-subtitle">通知结果<\/h3>/)
  assert.match(appSource, /该事件暂无通知详情。/)
  assert.match(appSource, /当前用户暂无 SOS 历史记录，触发一次 SOS 后会在这里展示。/)
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
