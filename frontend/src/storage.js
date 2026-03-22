import { Capacitor } from '@capacitor/core'
import { Preferences } from '@capacitor/preferences'

const managedKeys = [
  'safety_identity_v1',
  'safety_theme_preferences_v1',
  'safety_emergency_config_v1',
  'safety_onboarding_done_v1',
  'safety_local_backend_v1',
  'safety_developer_mode_v1',
  'safety_tracking_state_v1',
]

const storageCache = new Map()
let storageReadyPromise = null
let storageDriver = Capacitor.isNativePlatform() ? 'preferences' : 'localStorage'

function readBrowserValue(key) {
  try {
    return globalThis?.localStorage?.getItem(key) ?? null
  } catch {
    return null
  }
}

function writeBrowserValue(key, value) {
  if (!globalThis?.localStorage) {
    throw new Error('localStorage 不可用')
  }
  globalThis.localStorage.setItem(key, value)
}

function removeBrowserValue(key) {
  if (!globalThis?.localStorage) {
    return
  }
  globalThis.localStorage.removeItem(key)
}

async function loadManagedNativeKeys() {
  for (const key of managedKeys) {
    const native = await Preferences.get({ key })
    const legacy = readBrowserValue(key)
    const value = native.value ?? legacy ?? null
    storageCache.set(key, value)

    if (native.value == null && legacy != null) {
      await Preferences.set({ key, value: legacy })
      removeBrowserValue(key)
    }
  }
}

export async function initializeAppStorage() {
  if (storageReadyPromise) {
    return storageReadyPromise
  }

  storageReadyPromise = (async () => {
    if (!Capacitor.isNativePlatform()) {
      managedKeys.forEach((key) => {
        storageCache.set(key, readBrowserValue(key))
      })
      return
    }

    try {
      await loadManagedNativeKeys()
    } catch (error) {
      storageDriver = 'localStorage-fallback'
      managedKeys.forEach((key) => {
        storageCache.set(key, readBrowserValue(key))
      })
      console.error('初始化 Native Preferences 存储失败，已回退到 localStorage。', error)
    }
  })()

  return storageReadyPromise
}

export function getStorageDriverLabel() {
  if (storageDriver === 'preferences') {
    return 'Native Preferences'
  }
  if (storageDriver === 'localStorage-fallback') {
    return 'localStorage（降级）'
  }
  return 'Browser localStorage'
}

export function readStoredString(key) {
  if (storageCache.has(key)) {
    return storageCache.get(key) ?? null
  }
  const fallback = readBrowserValue(key)
  storageCache.set(key, fallback)
  return fallback
}

export function readStoredJson(key) {
  const raw = readStoredString(key)
  if (!raw) {
    return null
  }
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

export async function writeStoredString(key, value) {
  const nextValue = value == null ? null : String(value)
  storageCache.set(key, nextValue)

  if (storageDriver === 'preferences') {
    try {
      if (nextValue == null) {
        await Preferences.remove({ key })
      } else {
        await Preferences.set({ key, value: nextValue })
      }
      removeBrowserValue(key)
      return
    } catch (error) {
      storageDriver = 'localStorage-fallback'
      console.error(`写入 Native Preferences 失败，key=${key}，已回退到 localStorage。`, error)
    }
  }

  if (nextValue == null) {
    removeBrowserValue(key)
    return
  }
  writeBrowserValue(key, nextValue)
}

export async function writeStoredJson(key, value) {
  await writeStoredString(key, JSON.stringify(value))
}

export async function removeStoredValue(key) {
  await writeStoredString(key, null)
}
