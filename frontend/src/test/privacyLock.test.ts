import { describe, expect, it, beforeEach } from 'vitest'
import { hashPin, verifyPin } from '../domain/privacyLock'
import {
  loadPrivacyLockConfig,
  savePrivacyLockConfig,
} from '../data/privacyLockRepo'
import { storage } from '../data/storage'
import type { PrivacyLockConfig } from '../types'

describe('hashPin', () => {
  it('produces a non-empty hash', () => {
    const hash = hashPin('1234')
    expect(hash).toBeTruthy()
    expect(typeof hash).toBe('string')
    expect(hash.length).toBeGreaterThan(0)
  })

  it('produces consistent hashes for the same input', () => {
    const hash1 = hashPin('1234')
    const hash2 = hashPin('1234')
    expect(hash1).toBe(hash2)
  })

  it('produces different hashes for different inputs', () => {
    const hash1 = hashPin('1234')
    const hash2 = hashPin('5678')
    expect(hash1).not.toBe(hash2)
  })

  it('handles empty string', () => {
    const hash = hashPin('')
    expect(hash).toBeTruthy()
    expect(typeof hash).toBe('string')
  })
})

describe('verifyPin', () => {
  it('returns true for correct PIN', () => {
    const hash = hashPin('1234')
    expect(verifyPin('1234', hash)).toBe(true)
  })

  it('returns false for incorrect PIN', () => {
    const hash = hashPin('1234')
    expect(verifyPin('5678', hash)).toBe(false)
  })

  it('returns false for empty PIN against non-empty hash', () => {
    const hash = hashPin('1234')
    expect(verifyPin('', hash)).toBe(false)
  })

  it('returns true for empty PIN against empty PIN hash', () => {
    const hash = hashPin('')
    expect(verifyPin('', hash)).toBe(true)
  })
})

describe('privacyLockRepo', () => {
  beforeEach(async () => {
    await storage.clear()
  })

  describe('loadPrivacyLockConfig', () => {
    it('returns null when no config exists', async () => {
      const config = await loadPrivacyLockConfig()
      expect(config).toBeNull()
    })

    it('returns saved config', async () => {
      const savedConfig: PrivacyLockConfig = {
        enabled: true,
        pinHash: hashPin('1234'),
      }
      await savePrivacyLockConfig(savedConfig)

      const loaded = await loadPrivacyLockConfig()
      expect(loaded).toEqual(savedConfig)
    })
  })

  describe('savePrivacyLockConfig', () => {
    it('saves and retrieves config', async () => {
      const config: PrivacyLockConfig = {
        enabled: false,
        pinHash: hashPin('9999'),
      }
      await savePrivacyLockConfig(config)

      const loaded = await loadPrivacyLockConfig()
      expect(loaded).toEqual(config)
    })

    it('overwrites existing config', async () => {
      const config1: PrivacyLockConfig = {
        enabled: true,
        pinHash: hashPin('1111'),
      }
      await savePrivacyLockConfig(config1)

      const config2: PrivacyLockConfig = {
        enabled: false,
        pinHash: hashPin('2222'),
      }
      await savePrivacyLockConfig(config2)

      const loaded = await loadPrivacyLockConfig()
      expect(loaded).toEqual(config2)
    })
  })
})
