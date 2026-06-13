import { create } from 'zustand'
import { loadConfig, saveConfig } from '../data/configRepo'

interface ImportSummary {
  userId: string
  callNumber: string
  smsNumber: string
  smsTemplate: string
}

interface DiffHint {
  field: string
  current: string
  imported: string
}

interface ConfigState {
  callNumber: string
  smsNumber: string
  smsTemplate: string
  onboardingDone: boolean
  loaded: boolean
  pendingImport: ImportSummary | null
  pendingDiffs: DiffHint[]
  importPending: boolean

  initialize: () => Promise<void>
  setField: <K extends 'callNumber' | 'smsNumber' | 'smsTemplate'>(key: K, value: string) => void
  save: () => Promise<void>
  setOnboardingDone: () => Promise<void>
  resetOnboarding: () => Promise<void>
  startImport: (json: string) => Promise<boolean>
  confirmImport: () => Promise<void>
  cancelImport: () => void
  exportConfig: () => Promise<void>
}

export const useConfigStore = create<ConfigState>((set, get) => ({
  callNumber: '',
  smsNumber: '',
  smsTemplate: '',
  onboardingDone: false,
  loaded: false,
  pendingImport: null,
  pendingDiffs: [],
  importPending: false,
  initialize: async () => {
    const stored = await loadConfig()
    if (stored) {
      set({
        callNumber: stored.callNumber,
        smsNumber: stored.smsNumber,
        smsTemplate: stored.smsTemplate,
        onboardingDone: stored.onboardingDone,
        loaded: true,
      })
    } else {
      set({ loaded: true })
    }
  },

  setField: (key, value) => {
    set({ [key]: value })
  },

  save: async () => {
    const state = get()
    await saveConfig({
      callNumber: state.callNumber,
      smsNumber: state.smsNumber,
      smsTemplate: state.smsTemplate,
      onboardingDone: state.onboardingDone,
    })
  },

  setOnboardingDone: async () => {
    set({ onboardingDone: true })
    const state = get()
    await saveConfig({
      callNumber: state.callNumber,
      smsNumber: state.smsNumber,
      smsTemplate: state.smsTemplate,
      onboardingDone: true,
    })
  },

  resetOnboarding: async () => {
    set({ onboardingDone: false })
  },

  startImport: async (json: string) => {
    try {
      const data = JSON.parse(json)
      const imported: ImportSummary = {
        userId: data.userId ?? '',
        callNumber: data.callNumber ?? '',
        smsNumber: data.smsNumber ?? '',
        smsTemplate: data.smsTemplate ?? '',
      }
      const current = get()
      const diffs: DiffHint[] = []
      if (current.callNumber !== imported.callNumber) {
        diffs.push({ field: '电话号码', current: current.callNumber, imported: imported.callNumber })
      }
      if (current.smsNumber !== imported.smsNumber) {
        diffs.push({ field: '短信号码', current: current.smsNumber, imported: imported.smsNumber })
      }
      if (current.smsTemplate !== imported.smsTemplate) {
        diffs.push({ field: '短信模板', current: current.smsTemplate, imported: imported.smsTemplate })
      }
      set({ pendingImport: imported, pendingDiffs: diffs, importPending: true })
      return true
    } catch {
      return false
    }
  },

  confirmImport: async () => {
    const { pendingImport } = get()
    if (!pendingImport) return
    set({
      callNumber: pendingImport.callNumber,
      smsNumber: pendingImport.smsNumber,
      smsTemplate: pendingImport.smsTemplate,
      pendingImport: null,
      pendingDiffs: [],
      importPending: false,
    })
    await get().save()
  },

  cancelImport: () => {
    set({ pendingImport: null, pendingDiffs: [], importPending: false })
  },

  exportConfig: async () => {
    const { callNumber, smsNumber, smsTemplate } = get()
    const blob = new Blob(
      [JSON.stringify({ callNumber, smsNumber, smsTemplate }, null, 2)],
      { type: 'application/json' },
    )
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `safety-config-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
  },
}))