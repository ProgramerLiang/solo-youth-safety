import { Capacitor, registerPlugin } from '@capacitor/core'

const EmergencyActions = registerPlugin('EmergencyActions')

function applyTemplate(template, payload) {
  return template
    .replaceAll('{userId}', payload.userId)
    .replaceAll('{deviceId}', payload.deviceId)
    .replaceAll('{lat}', String(payload.location.lat))
    .replaceAll('{lng}', String(payload.location.lng))
    .replaceAll('{time}', payload.timestamp)
}

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
    const result = await EmergencyActions.triggerEmergency({
      callNumber: normalizeNumber(config.callNumber),
      smsNumber: normalizeNumber(config.smsNumber),
      smsBody: applyTemplate(config.smsTemplate, payload),
    })
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
