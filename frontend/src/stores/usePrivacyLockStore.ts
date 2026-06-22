import { create } from 'zustand'
import type { PrivacyLockConfig } from '../types'
import { loadPrivacyLockConfig, savePrivacyLockConfig } from '../data/privacyLockRepo'
import { verifyPin } from '../domain/privacyLock'

interface PrivacyLockState {
  locked: boolean
  loaded: boolean
  config: PrivacyLockConfig | null
  lockTimer: number | null
  initialize: () => Promise<void>
  setConfig: (config: PrivacyLockConfig) => Promise<void>
  lock: () => void
  unlock: (pin: string) => Promise<boolean>
  startBackgroundTimer: () => void
  clearTimer: () => void
}

export const usePrivacyLockStore = create<PrivacyLockState>((set, get) => ({
  locked: false,
  loaded: false,
  config: null,
  lockTimer: null,

  initialize: async () => {
    const config = await loadPrivacyLockConfig()
    set({ config, loaded: true, locked: config?.enabled === true })
  },

  setConfig: async (config: PrivacyLockConfig) => {
    await savePrivacyLockConfig(config)
    set({ config })
  },

  lock: () => {
    get().clearTimer()
    set({ locked: true })
  },

  unlock: async (pin: string) => {
    const { config } = get()
    if (!config || !config.enabled || !config.pinHash) return false
    if (verifyPin(pin, config.pinHash)) {
      get().clearTimer()
      set({ locked: false })
      return true
    }
    return false
  },

  startBackgroundTimer: () => {
    get().clearTimer()
    const timerId = window.setTimeout(() => {
      set({ locked: true, lockTimer: null })
    }, 30000)
    set({ lockTimer: timerId })
  },

  clearTimer: () => {
    const { lockTimer } = get()
    if (lockTimer !== null) {
      clearTimeout(lockTimer)
      set({ lockTimer: null })
    }
  },
}))
