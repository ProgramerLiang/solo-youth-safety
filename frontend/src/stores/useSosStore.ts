import { create } from 'zustand'
import { createInitialResult, updateStepTone, advanceStage, computeFinalStatus } from '../domain/sosState'
import { renderTemplate, buildMapUrl } from '../domain/template'
import { loadSosHistory, saveSosHistory } from '../data/sosRepo'
import { triggerNativeCall, triggerNativeSms } from '../data/sosActions'
import { useConfigStore } from './useConfigStore'
import type { SosResult } from '../types'
import type { SosStepKey } from '../domain/sosState'

interface SosState {
  arming: boolean
  countdownActive: boolean
  sosResult: SosResult
  history: SosResult[]
  initialized: boolean

  initialize: () => Promise<void>
  arm: () => void
  cancel: () => void
  triggerNow: (vars: {
    lat: number
    lng: number
    accuracy: number | null
    userId: string
    deviceId: string
    callNumber: string
    smsNumber: string
    smsTemplate: string
    time: string
  }) => Promise<void>
  reportLocationFailure: (detail: string) => Promise<void>
  updateStep: (key: SosStepKey, tone: SosResult['steps']['location']['tone'], label: string, detail: string) => void
  retry: () => void
  callOnly: () => Promise<void>
  smsOnly: () => Promise<void>
  appendEvent: (result: SosResult) => Promise<void>
  loadHistory: (history: SosResult[]) => void
}


export const useSosStore = create<SosState>((set, get) => ({
  arming: false,
  countdownActive: false,
  sosResult: createInitialResult(),
  history: [],
  initialized: false,

  initialize: async () => {
    const history = await loadSosHistory()
    set({ history, initialized: true })
  },

  arm: () => set({ arming: true, countdownActive: true, sosResult: createInitialResult() }),

  cancel: () => set({ arming: false, countdownActive: false, sosResult: createInitialResult() }),

  triggerNow: async (vars) => {
    let result = createInitialResult()
    const triggeredAt = Date.now()
    result = advanceStage(result, 'arming', '正在获取位置...')
    set({ arming: true, countdownActive: false, sosResult: result })

    result = advanceStage(result, 'locating', '正在获取位置...')
    result = updateStepTone(result, 'location', 'success', '已获取位置', `GPS 精度`)
    result = advanceStage(result, 'persisting', '正在写入本地记录...')
    set({ sosResult: result })

    result = updateStepTone(result, 'persistence', 'success', '已写入本地', '事件已记录')
    result = advanceStage(result, 'notifying', '正在发送通知...')
    set({ sosResult: result })

    const mapUrl = buildMapUrl(vars.lat, vars.lng)
    const smsBody = renderTemplate(vars.smsTemplate, {
      userId: vars.userId,
      deviceId: vars.deviceId,
      lat: vars.lat.toFixed(6),
      lng: vars.lng.toFixed(6),
      time: vars.time,
      mapUrl,
    })

    if (vars.smsNumber) {
      try {
        const smsResult = await triggerNativeSms(vars.smsNumber, smsBody)
        result = updateStepTone(result, 'sms', smsResult.success ? 'success' : 'danger',
          smsResult.success ? '短信已发送' : '短信发送失败', smsResult.detail)
      } catch {
        result = updateStepTone(result, 'sms', 'danger', '短信发送失败', '原生桥异常')
      }
    } else {
      result = updateStepTone(result, 'sms', 'warn', '短信未配置', '无短信号码')
    }
    set({ sosResult: result })

    if (vars.callNumber) {
      try {
        const callResult = await triggerNativeCall(vars.callNumber)
        result = updateStepTone(result, 'call', callResult.success ? 'success' : 'danger',
          callResult.success ? '拨号已发起' : '拨号失败', callResult.detail)
      } catch {
        result = updateStepTone(result, 'call', 'danger', '拨号失败', '原生桥异常')
      }
    } else {
      result = updateStepTone(result, 'call', 'warn', '电话未配置', '无电话号码')
    }

    result = advanceStage(result, 'done', 'SOS 流程完成')
    result = computeFinalStatus(result)
    result = { ...result, triggeredAt, location: { lat: vars.lat, lng: vars.lng, accuracy: vars.accuracy } }
    set({ arming: false, sosResult: result })
    await get().appendEvent(result)
  },

  reportLocationFailure: async (detail) => {
    let result = createInitialResult()
    const triggeredAt = Date.now()
    result = advanceStage(result, 'locating', '定位失败，已停止 SOS 通知流程')
    result = updateStepTone(result, 'location', 'danger', '定位失败', detail)
    result = advanceStage(result, 'done', '定位失败，未发送短信或拨打电话')
    result = computeFinalStatus(result)
    result = { ...result, triggeredAt }
    set({ arming: false, countdownActive: false, sosResult: result })
    await get().appendEvent(result)
  },

  updateStep: (key, tone, label, detail) => {
    const result = updateStepTone(get().sosResult, key as SosStepKey, tone, label, detail)
    set({ sosResult: result })
  },

  retry: () => {
    set({ arming: true, sosResult: createInitialResult() })
  },

  callOnly: async () => {
    const { callNumber } = useConfigStore.getState()
    if (!callNumber) return
    try {
      await triggerNativeCall(callNumber)
    } catch { /* silent */ }
  },

  smsOnly: async () => {
    const { smsNumber } = useConfigStore.getState()
    if (!smsNumber) return
    try {
      await triggerNativeSms(smsNumber, 'SOS 紧急求助')
    } catch { /* silent */ }
  },


  appendEvent: async (result) => {
    const newHistory = [...get().history, result]
    set({ history: newHistory })
    await saveSosHistory(newHistory)
  },

  loadHistory: (history) => set({ history }),
}))