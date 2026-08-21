import { storage } from './storage'
import type { ThemeMode, PaletteMode, DynamicColorInfo } from '../types'

export const THEME_PREFS_KEY = 'safety_v2_theme_prefs'

export interface ThemePrefs {
  mode: ThemeMode
  paletteMode: PaletteMode
  presetId: string | null
  customSeed: string | null
  dynamicInfo: DynamicColorInfo | null
  /** 状态栏沉浸（内容延伸到状态栏下方） */
  immersiveStatusBar?: boolean
  /** 导航栏沉浸（内容延伸到导航栏下方） */
  immersiveNavBar?: boolean
}

export async function loadThemePrefs(): Promise<ThemePrefs | null> {
  return storage.getJson<ThemePrefs>(THEME_PREFS_KEY)
}

export async function saveThemePrefs(prefs: ThemePrefs): Promise<void> {
  await storage.setJson(THEME_PREFS_KEY, prefs)
}