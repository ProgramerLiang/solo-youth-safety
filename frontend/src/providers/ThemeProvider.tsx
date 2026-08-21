import { useEffect, useMemo } from 'react'
import { ThemeProvider as MuiThemeProvider, CssBaseline } from '@mui/material'
import { StatusBar, Style as StatusBarStyle } from '@capacitor/status-bar'
import { useThemeStore } from '../stores/useThemeStore'
import { buildTheme, resolveThemeMode } from '../theme/createTheme'
import { detectSystemDark } from '../theme/tokens'

interface ThemeProviderProps {
  children: React.ReactNode
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const mode = useThemeStore((s) => s.mode)
  const presetId = useThemeStore((s) => s.presetId)
  const customSeed = useThemeStore((s) => s.customSeed)
  const dynamicInfo = useThemeStore((s) => s.dynamicInfo)

  const resolvedMode = resolveThemeMode(mode)

  const theme = useMemo(
    () => buildTheme(resolvedMode, presetId, customSeed, dynamicInfo ? { seed: dynamicInfo.seed, primary: dynamicInfo.primary } : null),
    [resolvedMode, presetId, customSeed, dynamicInfo],
  )

  useEffect(() => {
    if (mode !== 'auto') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = () => {
      document.documentElement.style.colorScheme = detectSystemDark() ? 'dark' : 'light'
    }
    handler()
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [mode])

  // 根据主题模式切换状态栏图标颜色
  useEffect(() => {
    try {
      void StatusBar.setStyle({
        style: resolvedMode === 'dark' ? StatusBarStyle.Dark : StatusBarStyle.Light,
      })
    } catch {
      // 浏览器环境忽略
    }
  }, [resolvedMode])

  return (
    <MuiThemeProvider theme={theme}>
      <CssBaseline />
      {children}
    </MuiThemeProvider>
  )
}