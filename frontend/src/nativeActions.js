import { Capacitor, registerPlugin } from '@capacitor/core'

import { renderSmsTemplate } from './template.js'

const EmergencyActions = registerPlugin('EmergencyActions')

function normalizeNumber(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function normalizeStatus(value) {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : ''

  if (normalized === 'sent' || normalized === 'attempted') {
    return 'dispatched'
  }
  if (normalized === 'launched') {
    return 'triggered'
  }
  if (normalized === 'permission-denied') {
    return 'failed'
  }

  return normalized || 'unknown'
}

function normalizeChannel(value) {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : ''
  return normalized || 'native'
}

function normalizeDetail(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function includesText(value, keyword) {
  return value.toLowerCase().includes(keyword.toLowerCase())
}

export function mapNativeDetail(channel, status, detail) {
  if (channel === 'sms') {
    if (status === 'dispatched') {
      return '短信已尝试发送（已调用 SmsManager，非确认对方已收到）'
    }
    if (status === 'skipped' && includesText(detail, 'smsNumber is empty')) {
      return '未填写短信号码，已跳过短信发送'
    }
    if (status === 'failed' && includesText(detail, 'smsBody is empty')) {
      return '短信内容为空，无法发送短信'
    }
    if (status === 'failed' && includesText(detail, 'SEND_SMS permission denied')) {
      return '缺少短信权限，无法直接发送短信'
    }
    if (status === 'failed' && includesText(detail, 'SmsManager failed')) {
      return '短信调用异常，系统未成功完成本次直接发送尝试'
    }
  }

  if (channel === 'call') {
    if (status === 'triggered') {
      return '拨号已尝试拉起（已启动 ACTION_CALL，非确认对方已接通）'
    }
    if (status === 'skipped' && includesText(detail, 'callNumber is empty')) {
      return '未填写拨号号码，已跳过电话呼叫'
    }
    if (status === 'failed' && includesText(detail, 'CALL_PHONE permission denied')) {
      return '缺少拨号权限，无法直接发起电话呼叫'
    }
    if (status === 'failed' && includesText(detail, 'CALL_PHONE denied')) {
      return '系统拒绝了拨号请求，无法直接发起电话呼叫'
    }
    if (status === 'failed' && includesText(detail, 'No call activity found')) {
      return '设备上没有可用的拨号处理能力，无法拉起电话呼叫'
    }
    if (status === 'failed' && includesText(detail, 'Timed out waiting for ACTION_CALL launch result')) {
      return '拨号拉起超时，系统未返回明确结果'
    }
    if (status === 'failed' && includesText(detail, 'Interrupted while waiting for ACTION_CALL launch')) {
      return '拨号过程被中断，系统未完成本次呼叫拉起'
    }
    if (status === 'failed' && includesText(detail, 'Call launch failed')) {
      return '拨号调用异常，系统未成功拉起电话呼叫'
    }
    if (status === 'failed' && includesText(detail, 'Unknown ACTION_CALL launch result')) {
      return '拨号结果未知，系统未返回可确认状态'
    }
  }

  if (channel === 'native' && status === 'skipped') {
    return '当前不在原生 App 环境，已跳过直接短信/拨号能力'
  }

  if (channel === 'native' && status === 'failed') {
    if (includesText(detail, 'returned no logs')) {
      return '原生应急插件未返回执行结果，请检查原生桥接日志'
    }
    if (includesText(detail, 'EmergencyActions failed')) {
      return '原生应急插件调用异常，未能完成直接短信/拨号尝试'
    }
  }

  return detail || '原生应急动作返回了未知结果'
}

export function normalizeNativeLog(item) {
  const channel = normalizeChannel(item?.channel)
  const status = normalizeStatus(item?.status)
  const rawDetail = normalizeDetail(item?.detail) || 'unknown native result'

  return {
    channel,
    status,
    detail: mapNativeDetail(channel, status, rawDetail),
    rawDetail,
  }
}

export function normalizeLogs(logs) {
  if (!Array.isArray(logs)) {
    return []
  }
  return logs.map((item) => normalizeNativeLog(item))
}

export function isNativePlatform() {
  return Capacitor.isNativePlatform()
}

export function buildNativeEmergencyPayload(config, payload) {
  return {
    callNumber: normalizeNumber(config.callNumber),
    smsNumber: normalizeNumber(config.smsNumber),
    smsBody: renderSmsTemplate(config.smsTemplate, payload),
  }
}

export async function triggerNativeEmergency(config, payload) {
  if (!isNativePlatform()) {
    return normalizeLogs([
      {
        channel: 'native',
        status: 'skipped',
        detail: 'not in native app, skipped direct call/sms dispatch',
      },
    ])
  }

  try {
    const result = await EmergencyActions.triggerEmergency(buildNativeEmergencyPayload(config, payload))
    const logs = normalizeLogs(result?.logs)
    return logs.length > 0
      ? logs
      : normalizeLogs([
          {
            channel: 'native',
            status: 'failed',
            detail: 'EmergencyActions returned no logs',
          },
        ])
  } catch (error) {
    return normalizeLogs([
      {
        channel: 'native',
        status: 'failed',
        detail: `EmergencyActions failed: ${error.message}`,
      },
    ])
  }
}
