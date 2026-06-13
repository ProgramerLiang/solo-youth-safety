import { Capacitor, registerPlugin } from '@capacitor/core'

type NativeResult = { success: boolean; detail: string }
type EmergencyChannel = 'sms' | 'call'
type EmergencyLogStatus = 'dispatched' | 'triggered' | 'skipped' | 'failed'

interface EmergencyLog {
  channel: EmergencyChannel
  status: EmergencyLogStatus | string
  detail: string
}

interface EmergencyActionsResult {
  logs?: EmergencyLog[]
}

interface EmergencyActionsPlugin {
  triggerEmergency(options: {
    smsNumber: string
    smsBody: string
    callNumber: string
  }): Promise<EmergencyActionsResult>
}

const EmergencyActions = registerPlugin<EmergencyActionsPlugin>('EmergencyActions')

function resultFromLog(result: EmergencyActionsResult, channel: EmergencyChannel): NativeResult {
  const log = result.logs?.find((item) => item.channel === channel)
  if (!log) {
    return { success: false, detail: `native-result-missing: ${channel}` }
  }
  return {
    success: log.status === 'dispatched' || log.status === 'triggered',
    detail: log.detail,
  }
}

function errorDetail(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export async function triggerNativeSms(phoneNumber: string, message: string): Promise<NativeResult> {
  if (!Capacitor.isNativePlatform()) {
    console.log('[nativeActions] Web: SMS not available', { phoneNumber, message })
    return { success: false, detail: 'unsupported: 非原生环境' }
  }
  try {
    const result = await EmergencyActions.triggerEmergency({
      smsNumber: phoneNumber,
      smsBody: message,
      callNumber: '',
    })
    return resultFromLog(result, 'sms')
  } catch (error) {
    return { success: false, detail: errorDetail(error) }
  }
}

export async function triggerNativeCall(phoneNumber: string): Promise<NativeResult> {
  if (!Capacitor.isNativePlatform()) {
    console.log('[nativeActions] Web: Call not available', { phoneNumber })
    return { success: false, detail: 'unsupported: 非原生环境' }
  }
  try {
    const result = await EmergencyActions.triggerEmergency({
      smsNumber: '',
      smsBody: '',
      callNumber: phoneNumber,
    })
    return resultFromLog(result, 'call')
  } catch (error) {
    return { success: false, detail: errorDetail(error) }
  }
}