import { Capacitor, registerPlugin } from '@capacitor/core'

import { renderSmsTemplate } from './template.js'

const EmergencyActions = registerPlugin('EmergencyActions')

function normalizeNumber(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function normalizeLogs(logs) {
  if (!Array.isArray(logs)) {
    return []
  }
  return logs.map((item) => ({
    channel: typeof item?.channel === 'string' ? item.channel : 'native',
    status: typeof item?.status === 'string' ? item.status : 'unknown',
    detail: typeof item?.detail === 'string' ? item.detail : 'unknown native result',
  }))
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
    return [
      {
        channel: 'native',
        status: 'skipped',
        detail: 'not in native app, skipped direct call/sms dispatch',
      },
    ]
  }

  try {
    const result = await EmergencyActions.triggerEmergency(buildNativeEmergencyPayload(config, payload))
    const logs = normalizeLogs(result?.logs)
    return logs.length > 0
      ? logs
      : [
          {
            channel: 'native',
            status: 'failed',
            detail: 'EmergencyActions returned no logs',
          },
        ]
  } catch (error) {
    return [
      {
        channel: 'native',
        status: 'failed',
        detail: `EmergencyActions failed: ${error.message}`,
      },
    ]
  }
}
