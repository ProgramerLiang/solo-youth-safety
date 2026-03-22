import { Capacitor } from '@capacitor/core'

const identityStorageKey = 'safety_identity_v1'

function getPlatform() {
  return Capacitor.getPlatform?.() || 'web'
}

function createSuffix() {
  const time = Date.now().toString(36)
  const random = Math.random().toString(36).slice(2, 8)
  return `${time}_${random}`
}

export function createUserId() {
  return `user_${createSuffix()}`
}

export function createDeviceId(platform = 'web') {
  return `device_${platform}_${createSuffix()}`
}

function normalizeIdentity(raw) {
  const platform = typeof raw?.platform === 'string' && raw.platform.trim() ? raw.platform : getPlatform()
  const userId = typeof raw?.userId === 'string' && raw.userId.trim() ? raw.userId.trim() : createUserId()
  const deviceId =
    typeof raw?.deviceId === 'string' && raw.deviceId.trim()
      ? raw.deviceId.trim()
      : createDeviceId(platform)

  return { userId, deviceId, platform }
}

export function getPersistedIdentity() {
  try {
    const raw = localStorage.getItem(identityStorageKey)
    const stored = raw ? JSON.parse(raw) : null
    const identity = normalizeIdentity(stored)
    localStorage.setItem(identityStorageKey, JSON.stringify(identity))
    return identity
  } catch {
    const identity = normalizeIdentity({ platform: getPlatform() })
    localStorage.setItem(identityStorageKey, JSON.stringify(identity))
    return identity
  }
}

export function savePersistedIdentity(identity) {
  const next = normalizeIdentity(identity)
  localStorage.setItem(identityStorageKey, JSON.stringify(next))
  return next
}
