import { describe, expect, it, beforeEach, vi, afterEach } from 'vitest'
import { usePrivacyLockStore } from '../stores/usePrivacyLockStore'
import type { PrivacyLockConfig } from '../types'

beforeEach(() => {
  usePrivacyLockStore.setState({ locked: false, config: null, lockTimer: null })
  localStorage.clear()
  vi.useFakeTimers()
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
})

describe('usePrivacyLockStore', () => {
  it('starts with unlocked state and no config', () => {
    const state = usePrivacyLockStore.getState()
    expect(state.locked).toBe(false)
    expect(state.config).toBeNull()
    expect(state.lockTimer).toBeNull()
  })

  it('initialize loads saved config from localStorage', async () => {
    const cfg: PrivacyLockConfig = {
      enabled: true,
      pinHash: 'abc123',
    }
    localStorage.setItem('safety_v2_privacy_lock', JSON.stringify(cfg))
    await usePrivacyLockStore.getState().initialize()
    const state = usePrivacyLockStore.getState()
    expect(state.config).toEqual(cfg)
  })

  it('setConfig saves and updates state', async () => {
    const cfg: PrivacyLockConfig = {
      enabled: true,
      pinHash: 'xyz789',
    }
    await usePrivacyLockStore.getState().setConfig(cfg)
    const state = usePrivacyLockStore.getState()
    expect(state.config).toEqual(cfg)
    const saved = JSON.parse(localStorage.getItem('safety_v2_privacy_lock')!)
    expect(saved).toEqual(cfg)
  })

  it('lock starts background timer and sets locked', () => {
    usePrivacyLockStore.getState().lock()
    const state = usePrivacyLockStore.getState()
    expect(state.locked).toBe(true)
    expect(state.lockTimer).not.toBeNull()
  })

  it('lock maintains locked state after 30 seconds', () => {
    usePrivacyLockStore.getState().lock()
    expect(usePrivacyLockStore.getState().locked).toBe(true)
    vi.advanceTimersByTime(30000)
    expect(usePrivacyLockStore.getState().locked).toBe(true)
    expect(usePrivacyLockStore.getState().lockTimer).toBeNull()
  })

  it('unlock returns true with correct PIN', async () => {
    const encoder = new TextEncoder()
    const data = encoder.encode('1234')
    const hashBuffer = await crypto.subtle.digest('SHA-256', data)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    const pinHash = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')

    await usePrivacyLockStore.getState().setConfig({ enabled: true, pinHash })
    usePrivacyLockStore.getState().lock()
    vi.advanceTimersByTime(30000)
    expect(usePrivacyLockStore.getState().locked).toBe(true)

    const result = await usePrivacyLockStore.getState().unlock('1234')
    expect(result).toBe(true)
    expect(usePrivacyLockStore.getState().locked).toBe(false)
  })

  it('unlock returns false with incorrect PIN', async () => {
    const encoder = new TextEncoder()
    const data = encoder.encode('1234')
    const hashBuffer = await crypto.subtle.digest('SHA-256', data)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    const pinHash = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')

    await usePrivacyLockStore.getState().setConfig({ enabled: true, pinHash })
    usePrivacyLockStore.getState().lock()
    vi.advanceTimersByTime(30000)

    const result = await usePrivacyLockStore.getState().unlock('9999')
    expect(result).toBe(false)
    expect(usePrivacyLockStore.getState().locked).toBe(true)
  })

  it('unlock clears timer on success', async () => {
    const encoder = new TextEncoder()
    const data = encoder.encode('1234')
    const hashBuffer = await crypto.subtle.digest('SHA-256', data)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    const pinHash = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')

    await usePrivacyLockStore.getState().setConfig({ enabled: true, pinHash })
    usePrivacyLockStore.getState().lock()
    
    const result = await usePrivacyLockStore.getState().unlock('1234')
    expect(result).toBe(true)
    expect(usePrivacyLockStore.getState().lockTimer).toBeNull()
  })

  it('clearTimer removes timer', () => {
    usePrivacyLockStore.getState().lock()
    expect(usePrivacyLockStore.getState().lockTimer).not.toBeNull()
    usePrivacyLockStore.getState().clearTimer()
    expect(usePrivacyLockStore.getState().lockTimer).toBeNull()
  })

  it('startBackgroundTimer clears existing timer', () => {
    usePrivacyLockStore.getState().startBackgroundTimer()
    const firstTimer = usePrivacyLockStore.getState().lockTimer
    usePrivacyLockStore.getState().startBackgroundTimer()
    const secondTimer = usePrivacyLockStore.getState().lockTimer
    expect(secondTimer).not.toBe(firstTimer)
    expect(secondTimer).not.toBeNull()
  })
})
