import { useEffect, useMemo } from 'react'
import { ThemeProvider as MuiThemeProvider, CssBaseline } from '@mui/material'
import { StatusBar, Style as StatusBarStyle } from '@capacitor/status-bar'
import { useThemeStore } from '../stores/useThemeStore'
import { useSafeAreaInsets } from '../hooks/useSafeArea'
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

  // 沉浸式设置：控制 safe-area padding（使用实测值）
  const immersiveStatusBar = useThemeStore((s) => s.immersiveStatusBar)
  const immersiveNavBar = useThemeStore((s) => s.immersiveNavBar)
  const insets = useSafeAreaInsets()
  useEffect(() => {
    const root = document.getElementById('root')
    if (!root) return
    root.style.paddingTop = immersiveStatusBar ? '0px' : `${insets.top}px`
    root.style.paddingBottom = immersiveNavBar ? '0px' : `${insets.bottom}px`
  }, [immersiveStatusBar, immersiveNavBar, insets.top, insets.bottom])

  return (
    <MuiThemeProvider theme={theme}>
      <CssBaseline />
      {children}
    </MuiThemeProvider>
  )
}