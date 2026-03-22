import { Capacitor } from '@capacitor/core'
import { AppLauncher } from '@capacitor/app-launcher'

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

export function isNativePlatform() {
  return Capacitor.isNativePlatform()
}

export async function openDialer(phone) {
  const number = normalizeNumber(phone)
  if (!number) {
    return { channel: 'call', status: 'skipped', detail: 'callNumber is empty' }
  }

  try {
    await AppLauncher.openUrl({ url: `tel:${number}` })
    return { channel: 'call', status: 'sent', detail: `dialer opened: ${number}` }
  } catch (error) {
    return { channel: 'call', status: 'failed', detail: `dialer failed: ${error.message}` }
  }
}

export async function openSms(smsNumber, smsTemplate, payload) {
  const number = normalizeNumber(smsNumber)
  if (!number) {
    return { channel: 'sms', status: 'skipped', detail: 'smsNumber is empty' }
  }

  const content = applyTemplate(smsTemplate, payload)
  const body = encodeURIComponent(content)

  try {
    await AppLauncher.openUrl({ url: `sms:${number}?body=${body}` })
    return { channel: 'sms', status: 'sent', detail: `sms app opened: ${number}` }
  } catch (error) {
    return { channel: 'sms', status: 'failed', detail: `sms failed: ${error.message}` }
  }
}

export async function triggerNativeEmergency(config, payload) {
  if (!isNativePlatform()) {
    return [
      {
        channel: 'native',
        status: 'skipped',
        detail: 'not in native app, skipped dial/sms launch',
      },
    ]
  }

  const callLog = await openDialer(config.callNumber)
  const smsLog = await openSms(config.smsNumber, config.smsTemplate, payload)
  return [callLog, smsLog]
}
