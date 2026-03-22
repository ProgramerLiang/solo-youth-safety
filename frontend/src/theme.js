import { Capacitor, registerPlugin } from '@capacitor/core'
import {
  applyTheme,
  argbFromHex,
  hexFromArgb,
  themeFromSourceColor,
} from '@material/material-color-utilities'

const themeStorageKey = 'safety_theme_preferences_v1'
const defaultSeedColor = '#6750A4'
const MaterialThemeBridge = registerPlugin('MaterialThemeBridge')

export const presetPalettes = [
  { id: 'violet', label: '默认紫', seed: '#6750A4' },
  { id: 'ocean', label: '海盐蓝', seed: '#1565C0' },
  { id: 'forest', label: '森林绿', seed: '#2E7D32' },
  { id: 'sunset', label: '落日橙', seed: '#C45A00' },
  { id: 'rose', label: '晨雾粉', seed: '#AD1457' },
]

const defaultThemePreferences = {
  mode: 'dynamic',
  presetId: presetPalettes[0].id,
  customSeed: defaultSeedColor,
}

function clamp01(value) {
  return Math.min(1, Math.max(0, value))
}

function normalizeHexColor(value, fallback = defaultSeedColor) {
  if (typeof value !== 'string') {
    return fallback
  }
  const hex = value.trim().replace('#', '')
  if (!/^[0-9a-fA-F]{6}$/.test(hex)) {
    return fallback
  }
  return `#${hex.toUpperCase()}`
}

function hexToRgb(hex) {
  const normalized = normalizeHexColor(hex).slice(1)
  return {
    r: Number.parseInt(normalized.slice(0, 2), 16),
    g: Number.parseInt(normalized.slice(2, 4), 16),
    b: Number.parseInt(normalized.slice(4, 6), 16),
  }
}

function rgbToHex({ r, g, b }) {
  return `#${[r, g, b]
    .map((item) => Math.round(item).toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase()}`
}

function mixHexColors(base, overlay, amount) {
  const safeAmount = clamp01(amount)
  const start = hexToRgb(base)
  const end = hexToRgb(overlay)
  return rgbToHex({
    r: start.r + (end.r - start.r) * safeAmount,
    g: start.g + (end.g - start.g) * safeAmount,
    b: start.b + (end.b - start.b) * safeAmount,
  })
}

function withAlpha(hex, alpha) {
  const safeAlpha = clamp01(alpha)
  const { r, g, b } = hexToRgb(hex)
  return `rgba(${r}, ${g}, ${b}, ${safeAlpha.toFixed(3)})`
}

function setCssVar(name, value) {
  document.documentElement.style.setProperty(name, value)
}

function updateMetaThemeColor(color) {
  const selector = 'meta[name="theme-color"]'
  let meta = document.querySelector(selector)
  if (!meta) {
    meta = document.createElement('meta')
    meta.setAttribute('name', 'theme-color')
    document.head.appendChild(meta)
  }
  meta.setAttribute('content', color)
}

function getPresetPalette(presetId) {
  return presetPalettes.find((item) => item.id === presetId) || presetPalettes[0]
}

function getThemeSeed(preferences, dynamicInfo) {
  if (preferences.mode === 'dynamic' && dynamicInfo.supported) {
    return normalizeHexColor(dynamicInfo.seedColor, defaultSeedColor)
  }
  if (preferences.mode === 'custom') {
    return normalizeHexColor(preferences.customSeed, defaultSeedColor)
  }
  return getPresetPalette(preferences.presetId).seed
}

function getThemeLabel(preferences, dynamicInfo) {
  if (preferences.mode === 'dynamic' && dynamicInfo.supported) {
    return `壁纸吸色 · Android ${dynamicInfo.sdkInt}+`
  }
  if (preferences.mode === 'custom') {
    return '自定义调色板'
  }
  return `预设调色板 · ${getPresetPalette(preferences.presetId).label}`
}

function buildPalette(theme) {
  const light = theme.schemes.light
  const primary = hexFromArgb(light.primary)
  const primaryContainer = hexFromArgb(light.primaryContainer)
  const surface = hexFromArgb(light.surface)
  const surfaceVariant = hexFromArgb(light.surfaceVariant)
  const outline = hexFromArgb(light.outline)

  return {
    primary,
    onPrimary: hexFromArgb(light.onPrimary),
    primaryContainer,
    onPrimaryContainer: hexFromArgb(light.onPrimaryContainer),
    surface,
    surfaceSoft: mixHexColors(surface, primaryContainer, 0.1),
    surfaceContainer: mixHexColors(surface, surfaceVariant, 0.4),
    outline,
    outlineStrong: mixHexColors(outline, primary, 0.25),
    error: hexFromArgb(light.error),
    onSurface: hexFromArgb(light.onSurface),
    onSurfaceVariant: hexFromArgb(light.onSurfaceVariant),
    bgSpotA: withAlpha(primaryContainer, 0.9),
    bgSpotB: withAlpha(primary, 0.18),
    shadow: `0 22px 50px ${withAlpha(primary, 0.16)}`,
  }
}

export function readThemePreferences() {
  try {
    const raw = localStorage.getItem(themeStorageKey)
    if (!raw) {
      return { ...defaultThemePreferences }
    }
    const parsed = JSON.parse(raw)
    return {
      mode: ['dynamic', 'preset', 'custom'].includes(parsed?.mode)
        ? parsed.mode
        : defaultThemePreferences.mode,
      presetId: getPresetPalette(parsed?.presetId).id,
      customSeed: normalizeHexColor(parsed?.customSeed, defaultSeedColor),
    }
  } catch {
    return { ...defaultThemePreferences }
  }
}

export function writeThemePreferences(preferences) {
  localStorage.setItem(themeStorageKey, JSON.stringify(preferences))
}

export async function loadDynamicThemeInfo() {
  if (!Capacitor.isNativePlatform()) {
    return {
      supported: false,
      seedColor: defaultSeedColor,
      source: 'web',
      sdkInt: 0,
    }
  }

  try {
    const data = await MaterialThemeBridge.getDynamicColorInfo()
    return {
      supported: Boolean(data?.supported),
      seedColor: normalizeHexColor(data?.seedColor, defaultSeedColor),
      source: typeof data?.source === 'string' ? data.source : 'android-system',
      sdkInt: Number.isFinite(Number(data?.sdkInt)) ? Number(data.sdkInt) : 0,
    }
  } catch {
    return {
      supported: false,
      seedColor: defaultSeedColor,
      source: 'native-unavailable',
      sdkInt: 0,
    }
  }
}

export function resolveThemePreferences(preferences, dynamicInfo) {
  const next = {
    mode: ['dynamic', 'preset', 'custom'].includes(preferences?.mode)
      ? preferences.mode
      : defaultThemePreferences.mode,
    presetId: getPresetPalette(preferences?.presetId).id,
    customSeed: normalizeHexColor(preferences?.customSeed, defaultSeedColor),
  }

  if (!dynamicInfo.supported && next.mode === 'dynamic') {
    return { ...next, mode: 'preset' }
  }

  return next
}

export function buildThemeState(preferences, dynamicInfo) {
  const resolvedPreferences = resolveThemePreferences(preferences, dynamicInfo)
  const seedColor = getThemeSeed(resolvedPreferences, dynamicInfo)
  const theme = themeFromSourceColor(argbFromHex(seedColor))

  return {
    preferences: resolvedPreferences,
    dynamicInfo,
    seedColor,
    label: getThemeLabel(resolvedPreferences, dynamicInfo),
    palette: buildPalette(theme),
    theme,
  }
}

export function applyThemeState(themeState) {
  applyTheme(themeState.theme, {
    target: document.documentElement,
    dark: false,
  })

  setCssVar('--md-primary', themeState.palette.primary)
  setCssVar('--md-on-primary', themeState.palette.onPrimary)
  setCssVar('--md-primary-container', themeState.palette.primaryContainer)
  setCssVar('--md-on-primary-container', themeState.palette.onPrimaryContainer)
  setCssVar('--md-surface', themeState.palette.surface)
  setCssVar('--md-surface-soft', themeState.palette.surfaceSoft)
  setCssVar('--md-surface-container', themeState.palette.surfaceContainer)
  setCssVar('--md-outline', themeState.palette.outline)
  setCssVar('--md-outline-strong', themeState.palette.outlineStrong)
  setCssVar('--md-error', themeState.palette.error)
  setCssVar('--md-on-surface', themeState.palette.onSurface)
  setCssVar('--md-on-surface-variant', themeState.palette.onSurfaceVariant)
  setCssVar('--md-bg-spot-a', themeState.palette.bgSpotA)
  setCssVar('--md-bg-spot-b', themeState.palette.bgSpotB)
  setCssVar('--md-shadow', themeState.palette.shadow)
  updateMetaThemeColor(themeState.palette.primary)
}
