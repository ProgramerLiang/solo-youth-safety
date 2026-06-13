import { create } from 'zustand'
import { loadIdentity, saveIdentity } from '../data/identityRepo'
import { generateUserId, generateDeviceId, getPlatform } from '../domain/identity'

interface IdentityState {
  userId: string
  deviceId: string
  platform: string
  loaded: boolean
  initialize: () => Promise<void>
  regenerate: () => Promise<void>
}

export const useIdentityStore = create<IdentityState>((set, get) => ({
  userId: '',
  deviceId: '',
  platform: getPlatform(navigator.userAgent),
  loaded: false,

  initialize: async () => {
    const stored = await loadIdentity()
    if (stored) {
      set({
        userId: stored.userId,
        deviceId: stored.deviceId,
        platform: stored.platform,
        loaded: true,
      })
    } else {
      const userId = generateUserId()
      const deviceId = generateDeviceId()
      const platform = getPlatform(navigator.userAgent)
      await saveIdentity({ userId, deviceId, platform })
      set({ userId, deviceId, platform, loaded: true })
    }
  },

  regenerate: async () => {
    const userId = generateUserId()
    const deviceId = generateDeviceId()
    const platform = get().platform
    await saveIdentity({ userId, deviceId, platform })
    set({ userId, deviceId })
  },
}))