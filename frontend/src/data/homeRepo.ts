import { storage } from './storage'
import { DEFAULT_HOME_SLOTS, type HomeLayout } from '../types/home'

export const HOME_LAYOUT_KEY = 'safety_v2_home'

export async function loadHomeLayout(): Promise<HomeLayout> {
  const saved = await storage.getJson<Partial<HomeLayout>>(HOME_LAYOUT_KEY)
  return {
    slots: Array.isArray(saved?.slots) && saved!.slots!.length === 4
      ? (saved!.slots as HomeLayout['slots'])
      : [...DEFAULT_HOME_SLOTS],
    companionEnabled: saved?.companionEnabled ?? true,
  }
}

export async function saveHomeLayout(layout: HomeLayout): Promise<void> {
  await storage.setJson(HOME_LAYOUT_KEY, layout)
}