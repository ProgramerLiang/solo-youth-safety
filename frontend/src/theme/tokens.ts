import {
  Hct,
  SchemeContent,
  argbFromHex,
  hexFromArgb,
  TonalPalette,
} from '@material/material-color-utilities'

function hexColor(argb: number): string {
  return hexFromArgb(argb)
}

export function generateTokensFromSeed(seedHex: string, isDark: boolean) {
  const seed = argbFromHex(seedHex)
  const scheme = new SchemeContent(Hct.fromInt(seed), isDark, 0)
  return {
    primary: hexColor(scheme.primary),
    onPrimary: hexColor(scheme.onPrimary),
    primaryContainer: hexColor(scheme.primaryContainer),
    onPrimaryContainer: hexColor(scheme.onPrimaryContainer),
    secondary: hexColor(scheme.secondary),
    onSecondary: hexColor(scheme.onSecondary),
    secondaryContainer: hexColor(scheme.secondaryContainer),
    onSecondaryContainer: hexColor(scheme.onSecondaryContainer),
    tertiary: hexColor(scheme.tertiary),
    onTertiary: hexColor(scheme.onTertiary),
    tertiaryContainer: hexColor(scheme.tertiaryContainer),
    onTertiaryContainer: hexColor(scheme.onTertiaryContainer),
    error: hexColor(scheme.error),
    onError: hexColor(scheme.onError),
    errorContainer: hexColor(scheme.errorContainer),
    onErrorContainer: hexColor(scheme.onErrorContainer),
    background: hexColor(scheme.background),
    onBackground: hexColor(scheme.onBackground),
    surface: hexColor(scheme.surface),
    onSurface: hexColor(scheme.onSurface),
    surfaceVariant: hexColor(scheme.surfaceVariant),
    onSurfaceVariant: hexColor(scheme.onSurfaceVariant),
    outline: hexColor(scheme.outline),
    outlineVariant: hexColor(scheme.outlineVariant),
    shadow: hexColor(scheme.shadow),
    scrim: hexColor(scheme.scrim),
    inverseSurface: hexColor(scheme.inverseSurface),
    inverseOnSurface: hexColor(scheme.inverseOnSurface),
    inversePrimary: hexColor(scheme.inversePrimary),
  }
}

export function generateTonalPalette(seedHex: string): {
  primary: string[]
  secondary: string[]
  tertiary: string[]
  neutral: string[]
  neutralVariant: string[]
} {
  const seed = argbFromHex(seedHex)
  const hct = Hct.fromInt(seed)

  const primary = TonalPalette.fromHueAndChroma(hct.hue, Math.max(hct.chroma, 36))
  const secondary = TonalPalette.fromHueAndChroma(hct.hue, 16)
  const tertiary = TonalPalette.fromHueAndChroma(hct.hue + 60, 24)
  const neutral = TonalPalette.fromHueAndChroma(hct.hue, 4)
  const neutralVariant = TonalPalette.fromHueAndChroma(hct.hue, 8)

  function paletteToHexArray(p: TonalPalette): string[] {
    return [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 95, 99, 100].map((tone) =>
      hexFromArgb(Hct.from(p.hue, p.chroma, tone).toInt()),
    )
  }

  return {
    primary: paletteToHexArray(primary),
    secondary: paletteToHexArray(secondary),
    tertiary: paletteToHexArray(tertiary),
    neutral: paletteToHexArray(neutral),
    neutralVariant: paletteToHexArray(neutralVariant),
  }
}

export function extractDynamicFromWallpaper(): Promise<{ seed: number; colors: Record<string, string> } | null> {
  try {
    const mc = (globalThis as Record<string, unknown>).MaterialColorUtilities as Record<string, unknown> | undefined
    if (mc && typeof mc.extractDynamic === 'function') {
      return Promise.resolve(null)
    }
  } catch {
    return Promise.resolve(null)
  }
  return Promise.resolve(null)
}

export function detectSystemDark(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}