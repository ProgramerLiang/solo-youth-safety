import { loadSosHistory } from './sosRepo'
import { CONFIG_KEY } from './configRepo'
import { CONTACTS_KEY } from './contactsRepo'
import { IDENTITY_KEY } from './identityRepo'
import { SOS_HISTORY_KEY } from './sosRepo'
import { TRACKING_STATE_KEY } from './trackingRepo'
import { loadContacts } from './contactsRepo'
import { loadTrackingState } from './trackingRepo'
import { loadConfig } from './configRepo'
import { storage } from './storage'
import packageJson from '../../package.json'

export interface AppSnapshot {
  version: string
  exportedAt: string
  config: unknown
  sosHistory: unknown
  contacts: unknown
  tracking: unknown
}

export async function exportSnapshot(): Promise<AppSnapshot> {
  const [config, sosHistory, contacts, tracking] = await Promise.all([
    loadConfig(),
    loadSosHistory(),
    loadContacts(),
    loadTrackingState(),
  ])
  return {
    version: packageJson.version,
    exportedAt: new Date().toISOString(),
    config,
    sosHistory,
    contacts,
    tracking,
  }
}

export async function importSnapshot(snapshot: AppSnapshot): Promise<void> {
  if (snapshot.config) {
    await storage.setJson(CONFIG_KEY, snapshot.config)
  }
  if (snapshot.sosHistory) {
    await storage.setJson(SOS_HISTORY_KEY, snapshot.sosHistory)
  }
  if (snapshot.contacts) {
    await storage.setJson(CONTACTS_KEY, snapshot.contacts)
  }
  if (snapshot.tracking) {
    await storage.setJson(TRACKING_STATE_KEY, snapshot.tracking)
  }
}

export async function clearAllData(): Promise<void> {
  const keys = [
    IDENTITY_KEY,
    'safety_v2_theme_prefs',
    CONFIG_KEY,
    SOS_HISTORY_KEY,
    CONTACTS_KEY,
    TRACKING_STATE_KEY,
    'safety_v2_devmode',
    'safety_v2_onboarding',
  ]
  await Promise.all(keys.map((k) => storage.remove(k)))
}