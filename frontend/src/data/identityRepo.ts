import { storage } from './storage'
import type { StoredIdentity } from '../types'

export const IDENTITY_KEY = 'safety_v2_identity'

export async function loadIdentity(): Promise<StoredIdentity | null> {
  return storage.getJson<StoredIdentity>(IDENTITY_KEY)
}

export async function saveIdentity(identity: StoredIdentity): Promise<void> {
  await storage.setJson(IDENTITY_KEY, identity)
}