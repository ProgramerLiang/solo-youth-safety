import { create } from 'zustand'
import type { PrivacyLockConfig } from '../types'
import { loadPrivacyLockConfig, savePrivacyLockConfig } from '../data/privacyLockRepo'

async function hashPin(pin: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(pin)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}

interface PrivacyLockState {
  locked: boolean
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
  config: null,
  lockTimer: null,

  initialize: async () => {
    const config = await loadPrivacyLockConfig()
    set({ config })
  },

  setConfig: async (config: PrivacyLockConfig) => {
    await savePrivacyLockConfig(config)
    set({ config })
  },

  lock: () => {
    set({ locked: true })
    get().startBackgroundTimer()
  },

  unlock: async (pin: string) => {
    const { config } = get()
    if (!config) return false
    const hash = await hashPin(pin)
    if (hash === config.pinHash) {
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
