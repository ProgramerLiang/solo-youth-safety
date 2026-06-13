import { createTheme, type ThemeOptions, type Theme } from '@mui/material/styles'
import type { ThemeMode } from '../types'
import { generateTokensFromSeed, detectSystemDark } from './tokens'
import { PRESET_PALETTES } from '../types'

const CONTRAST_PALETTE_KEYS = new Set(['primary', 'secondary', 'error', 'warning', 'info', 'success'])

type ContrastPaletteKey = 'primary' | 'secondary' | 'error' | 'warning' | 'info' | 'success'

function getContrastPaletteKey(color: unknown): ContrastPaletteKey | null {
  return typeof color === 'string' && CONTRAST_PALETTE_KEYS.has(color)
    ? color as ContrastPaletteKey
    : null
}

function getContainedButtonPaletteKey(color: unknown): ContrastPaletteKey {
  return getContrastPaletteKey(color) ?? 'primary'
}

export function buildTheme(
  paletteMode: 'light' | 'dark',
  presetId: string | null,
  customSeed: string | null,
  dynamicInfo: { seed: number; primary: string } | null,
): Theme {
  let seed: string

  if (dynamicInfo) {
    seed = dynamicInfo.primary
  } else if (customSeed) {
    seed = customSeed
  } else if (presetId && PRESET_PALETTES[presetId]) {
    seed = PRESET_PALETTES[presetId]!
  } else {
    seed = '#6750A4'
  }

  const tokens = generateTokensFromSeed(seed, paletteMode === 'dark')

  const themeOptions: ThemeOptions = {
    palette: {
      mode: paletteMode,
      primary: { main: tokens.primary, light: tokens.primaryContainer, dark: tokens.onPrimaryContainer, contrastText: tokens.onPrimary },
      secondary: { main: tokens.secondary, light: tokens.secondaryContainer, dark: tokens.onSecondaryContainer, contrastText: tokens.onSecondary },
      error: { main: tokens.error, light: tokens.errorContainer, dark: tokens.onErrorContainer, contrastText: tokens.onError },
      background: { default: tokens.background, paper: tokens.surface },
      text: { primary: tokens.onSurface, secondary: tokens.onSurfaceVariant },
      divider: tokens.outlineVariant,
    },
    typography: {
      fontFamily: [
        'PingFang SC',
        'Microsoft YaHei',
        'Noto Sans CJK SC',
        'system-ui',
        '-apple-system',
        'sans-serif',
      ].join(','),
    },
    shape: { borderRadius: 12 },
    components: {
      MuiCard: {
        defaultProps: {
          variant: 'outlined' as const,
        },
        styleOverrides: {
          root: {
            borderRadius: 16,
          },
        },
      },
      MuiCardContent: {
        styleOverrides: {
          root: {
            '&:last-child': { paddingBottom: 16 },
          },
        },
      },
      MuiButton: {
        styleOverrides: {
          root: ({ ownerState, theme }) => {
            const base = {
              textTransform: 'none',
              borderRadius: 20,
            }

            if (ownerState.variant !== 'contained') return base

            const paletteKey = getContainedButtonPaletteKey(ownerState.color)
            const hoverBackground = theme.palette[paletteKey].dark

            return {
              ...base,
              '&:hover': {
                backgroundColor: hoverBackground,
                color: theme.palette.getContrastText(hoverBackground),
              },
            }
          },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: ({ ownerState, theme }) => {
            const base = { borderRadius: 8 }

            if (ownerState.variant !== 'filled') return base

            const paletteKey = getContrastPaletteKey(ownerState.color)
            if (!paletteKey) return base

            const hoverBackground = theme.palette[paletteKey].dark

            return {
              ...base,
              '&:hover': {
                backgroundColor: hoverBackground,
                color: theme.palette.getContrastText(hoverBackground),
              },
            }
          },
        },
      },
      MuiDrawer: {
        styleOverrides: {
          paper: {
            borderTopRightRadius: 16,
            borderBottomRightRadius: 16,
          },
        },
      },
    },
  }

  return createTheme(themeOptions)
}

export function resolveThemeMode(mode: ThemeMode): 'light' | 'dark' {
  if (mode === 'auto') {
    return detectSystemDark() ? 'dark' : 'light'
  }
  return mode
}