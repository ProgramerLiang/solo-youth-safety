const SUCCESS_STATUSES = new Set(['sent', 'success', 'triggered', 'dispatched'])
const FAILED_STATUSES = new Set([
  'failed',
  'error',
  'timeout',
  'denied',
  'permission-denied',
  'cancelled',
  'canceled',
])
const SKIPPED_STATUSES = new Set(['skipped', 'unsupported', 'not-supported'])
const ATTEMPTED_STATUSES = new Set(['attempted', 'pending', 'processing', 'running'])
const STABLE_STAGES = new Set([
  'idle',
  'countdown',
  'collecting-location',
  'location-failed',
  'submitting-remote',
  'remote-failed',
  'dispatching-native',
  'partial-success',
  'success',
  'failed',
  'cancelled',
])

function asText(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function normalizeChannel(channel, fallback = 'unknown') {
  const value = asText(channel).toLowerCase()
  return value || fallback
}

function normalizeStableStage(stage) {
  const value = asText(stage).toLowerCase()
  return STABLE_STAGES.has(value) ? value : 'idle'
}

export function normalizeStepStatus(status, detail = '') {
  const normalized = asText(status).toLowerCase()
  const normalizedDetail = asText(detail).toLowerCase()
  if (SUCCESS_STATUSES.has(normalized)) {
    return 'success'
  }
  if (FAILED_STATUSES.has(normalized)) {
    return normalized === 'permission-denied' || normalized === 'denied' ? 'blocked' : 'failed'
  }
  if (SKIPPED_STATUSES.has(normalized)) {
    return 'skipped'
  }
  if (ATTEMPTED_STATUSES.has(normalized)) {
    return 'attempted'
  }
  if (normalizedDetail.includes('permission')) {
    return 'blocked'
  }
  return normalized ? 'attempted' : 'unknown'
}

export function normalizeSosActionLog(item, source = 'unknown') {
  const channel = normalizeChannel(item?.channel, source === 'native' ? 'native' : 'unknown')
  const rawStatus = asText(item?.status) || 'unknown'
  const detail = asText(item?.detail) || `${source} 未返回详细信息`
  const destination = asText(item?.destination) || null
  const status = normalizeStepStatus(rawStatus, detail)
  return { source, channel, rawStatus, status, detail, destination }
}

function dedupeRemedies(remedies) {
  return [...new Set(remedies.filter(Boolean))]
}

function summarizeActions(logs) {
  const counts = { success: 0, failed: 0, blocked: 0, skipped: 0, attempted: 0, unknown: 0 }
  for (const log of logs) {
    counts[log.status] = (counts[log.status] || 0) + 1
  }
  return counts
}

function resolveStepTone(status) {
  if (status === 'success') {
    return 'success'
  }
  if (status === 'failed' || status === 'blocked') {
    return 'failed'
  }
  if (status === 'attempted') {
    return 'running'
  }
  if (status === 'skipped') {
    return 'skipped'
  }
  if (status === 'partial') {
    return 'partial'
  }
  return 'idle'
}

function getToneLabel(tone) {
  switch (tone) {
    case 'success':
      return '成功'
    case 'failed':
      return '失败'
    case 'running':
      return '进行中'
    case 'skipped':
      return '已跳过'
    case 'partial':
      return '部分成功'
    default:
      return '待执行'
  }
}

function buildCardStep(label, status, detail) {
  const tone = resolveStepTone(status)
  return {
    label,
    status,
    tone,
    badge: getToneLabel(tone),
    detail: detail || (tone === 'idle' ? '尚未开始' : ''),
  }
}

function buildActionRemedies(log) {
  const detail = log.detail.toLowerCase()
  const detailText = log.detail
  const remedies = []
  if (log.channel === 'sms') {
    if (log.status === 'blocked' || detail.includes('permission') || detailText.includes('权限')) {
      remedies.push('请在系统设置中开启短信权限后重试。')
    }
    if (log.status === 'skipped' && !log.destination) {
      remedies.push('请先填写短信号码，避免 SOS 只能上报而不发送短信。')
    }
  }
  if (log.channel === 'call') {
    if (log.status === 'blocked' || detail.includes('permission') || detailText.includes('权限')) {
      remedies.push('请在系统设置中开启拨号/通话权限后重试。')
    }
    if (log.status === 'skipped' && !log.destination) {
      remedies.push('请先填写拨号号码，避免 SOS 无法直接呼叫联系人。')
    }
  }
  if (log.source === 'server' && (log.status === 'failed' || log.status === 'blocked')) {
    remedies.push('请检查网络连接或稍后重试 SOS 上报。')
  }
  if (log.source === 'native' && log.channel === 'native' && log.status === 'skipped') {
    remedies.push('当前为 Web/调试环境，未执行原生短信或拨号，可在 Android App 内复测。')
  }
  if (detail.includes('no activity')) {
    remedies.push('请确认设备具备可用的拨号应用后再次触发 SOS。')
  }
  if (detail.includes('timeout')) {
    remedies.push('设备响应超时，可稍后重试，并确认应用仍在前台运行且未被系统限制。')
  }
  return remedies
}

function deriveGroupStatus(logs, idleDetail) {
  if (!logs.length) {
    return { status: 'idle', detail: idleDetail }
  }
  const counts = summarizeActions(logs)
  if (counts.failed > 0 || counts.blocked > 0) {
    return {
      status: counts.success > 0 ? 'partial' : 'failed',
      detail: logs.map((item) => `${item.channel}: ${item.detail}`).join('；'),
    }
  }
  if (counts.success > 0) {
    return {
      status: 'success',
      detail: logs.map((item) => `${item.channel}: ${item.detail}`).join('；'),
    }
  }
  if (counts.skipped > 0 || counts.attempted > 0 || counts.unknown > 0) {
    return {
      status: counts.skipped === logs.length ? 'skipped' : 'attempted',
      detail: logs.map((item) => `${item.channel}: ${item.detail}`).join('；'),
    }
  }
  return { status: 'idle', detail: idleDetail }
}

function findPreferredLog(logs, channel) {
  return logs.find((item) => item.channel === channel) || null
}

function buildSummary(stage, counts) {
  switch (stage) {
    case 'idle':
      return '等待触发 SOS'
    case 'countdown':
      return 'SOS 倒计时中，可随时取消'
    case 'collecting-location':
      return '正在确认 SOS 使用的位置'
    case 'location-failed':
      return '定位失败，SOS 已取消'
    case 'submitting-remote':
      return '正在上报 SOS 事件'
    case 'remote-failed':
      return 'SOS 上报失败'
    case 'dispatching-native':
      return '远端已记录，正在触发短信 / 拨号'
    case 'partial-success':
      return `SOS 已部分完成（成功 ${counts.success} 项，失败 ${counts.failed + counts.blocked} 项）`
    case 'success':
      return 'SOS 已完成'
    case 'failed':
      return 'SOS 执行失败'
    case 'cancelled':
      return '已取消本次 SOS'
    default:
      return 'SOS 状态待确认'
  }
}

function buildFinalLabel(stage) {
  switch (stage) {
    case 'success':
      return '成功'
    case 'partial-success':
      return '部分成功'
    case 'failed':
    case 'remote-failed':
    case 'location-failed':
      return '失败'
    case 'cancelled':
      return '已取消'
    case 'countdown':
    case 'collecting-location':
    case 'submitting-remote':
    case 'dispatching-native':
      return '进行中'
    default:
      return '待执行'
  }
}

function deriveCompletionStage({ inputStage, location, serverLogs, nativeLogs, executionError }) {
  if (inputStage !== 'idle') {
    if (inputStage === 'location-failed' && !location) {
      return 'location-failed'
    }
    if (inputStage === 'remote-failed' && executionError) {
      return 'remote-failed'
    }
    if (['countdown', 'collecting-location', 'submitting-remote', 'dispatching-native', 'cancelled'].includes(inputStage)) {
      return inputStage
    }
  }

  if (!location) {
    return 'location-failed'
  }
  if (executionError && !serverLogs.length && !nativeLogs.length) {
    return 'remote-failed'
  }

  const counts = summarizeActions([...serverLogs, ...nativeLogs])
  if (counts.failed > 0 || counts.blocked > 0) {
    return counts.success > 0 ? 'partial-success' : 'failed'
  }
  if (counts.success > 0) {
    if (counts.skipped > 0 || counts.attempted > 0 || counts.unknown > 0) {
      return 'partial-success'
    }
    return 'success'
  }
  if (executionError) {
    return 'failed'
  }
  return 'failed'
}

function buildMessages({ locationNote, executionError, actionLogs }) {
  return [
    asText(locationNote),
    executionError ? `执行错误：${executionError}` : '',
    ...actionLogs.map((log) => `${log.source}/${log.channel}: ${log.rawStatus}（${log.detail}）`),
  ].filter(Boolean)
}

export function buildSosState({
  stage = 'idle',
  location = null,
  locationNote = '',
  serverData = null,
  nativeLogs = [],
  error = null,
} = {}) {
  const inputStage = normalizeStableStage(stage)
  const executionError = error ? asText(error.message) || '未知错误' : ''
  const serverLogs = Array.isArray(serverData?.notifications)
    ? serverData.notifications.map((item) => normalizeSosActionLog(item, 'server'))
    : []
  const normalizedNativeLogs = Array.isArray(nativeLogs)
    ? nativeLogs.map((item) => normalizeSosActionLog(item, 'native'))
    : []
  const actionLogs = [...serverLogs, ...normalizedNativeLogs]
  const counts = summarizeActions(actionLogs)
  const stableStage = deriveCompletionStage({ inputStage, location, serverLogs, nativeLogs: normalizedNativeLogs, executionError })
  const remedies = dedupeRemedies([
    !location && stableStage === 'location-failed' ? '请先点击“刷新当前位置”并确认定位权限，再重新触发 SOS。' : '',
    stableStage === 'remote-failed' ? '请检查网络、身份信息与后端服务状态后重试。' : '',
    executionError && stableStage === 'failed' ? '请查看失败原因并在网络恢复或权限补齐后重试。' : '',
    ...actionLogs.flatMap((log) => buildActionRemedies(log)),
  ])

  const serverStep = deriveGroupStatus(
    serverLogs,
    stableStage === 'submitting-remote' ? '等待后端响应' : stableStage === 'remote-failed' ? executionError || '远端上报失败' : '尚未开始'
  )
  const nativeStep = deriveGroupStatus(
    normalizedNativeLogs,
    stableStage === 'dispatching-native' ? '等待原生短信 / 拨号结果' : '尚未开始'
  )
  const smsLog = findPreferredLog(normalizedNativeLogs, 'sms') || findPreferredLog(serverLogs, 'sms')
  const callLog = findPreferredLog(normalizedNativeLogs, 'call') || findPreferredLog(serverLogs, 'call')
  const locationStepStatus = stableStage === 'collecting-location'
    ? 'attempted'
    : stableStage === 'location-failed'
      ? 'blocked'
      : location
        ? 'success'
        : 'idle'

  return {
    stage: stableStage,
    finalStatus: stableStage,
    summary: buildSummary(stableStage, counts),
    finalLabel: buildFinalLabel(stableStage),
    note: asText(locationNote),
    failureReasons: [executionError, ...actionLogs.filter((item) => item.status === 'failed' || item.status === 'blocked').map((item) => item.detail)].filter(Boolean),
    remedies,
    messages: buildMessages({ locationNote, executionError, actionLogs }),
    actionLogs,
    counts,
    steps: {
      location: buildCardStep(
        '定位',
        locationStepStatus,
        asText(locationNote) || (stableStage === 'countdown' ? '倒计时结束后会检查当前位置' : stableStage === 'collecting-location' ? '正在确认当前位置' : location ? '已使用当前位置' : '尚未开始')
      ),
      remote: buildCardStep('远端上报', serverStep.status, serverStep.detail),
      native: buildCardStep('原生动作', nativeStep.status, nativeStep.detail),
      sms: buildCardStep('短信', smsLog?.status || 'idle', smsLog?.detail || (stableStage === 'dispatching-native' ? '等待短信结果' : '尚未开始')),
      call: buildCardStep('拨号', callLog?.status || 'idle', callLog?.detail || (stableStage === 'dispatching-native' ? '等待拨号结果' : '尚未开始')),
    },
  }
}

export function formatSosStateText(state) {
  if (!state) {
    return 'SOS 状态待确认'
  }
  return [state.summary, ...state.messages, state.remedies.length > 0 ? `补救建议：${state.remedies.join('；')}` : '']
    .filter(Boolean)
    .join('\n')
}
