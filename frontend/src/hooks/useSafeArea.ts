import { useState, useEffect } from 'react'

export interface SafeAreaInsets {
  top: number
  bottom: number
}

/**
 * 测量系统状态栏和导航栏的安全区域
 *
 * 使用 visualViewport API 获取实际像素值，
 * 避免 env(safe-area-inset-*) 在 Android WebView 中返回 0 的问题。
 */
export function useSafeAreaInsets(): SafeAreaInsets {
  const [insets, setInsets] = useState<SafeAreaInsets>(() => measure())

  useEffect(() => {
    // 初始测量
    setInsets(measure())

    // 监听 visualViewport 变化（横竖屏切换、键盘弹出等）
    const vv = window.visualViewport
    if (vv) {
      const handler = () => setInsets(measure())
      vv.addEventListener('resize', handler)
      vv.addEventListener('scroll', handler)
      return () => {
        vv.removeEventListener('resize', handler)
        vv.removeEventListener('scroll', handler)
      }
    }
  }, [])

  return insets
}

function measure(): SafeAreaInsets {
  const vv = window.visualViewport
  if (!vv) {
    // fallback: env() values
    const top = parseCssEnv('safe-area-inset-top')
    const bottom = parseCssEnv('safe-area-inset-bottom')
    return { top, bottom }
  }

  // visualViewport.offsetTop = 状态栏高度
  // visualViewport.offsetLeft = 屏幕左安全区
  const top = Math.max(0, vv.offsetTop)
  // 导航栏高度 ≈ 屏幕高度 - 视口高度 - 状态栏偏移
  const bottom = Math.max(0, window.screen.height - vv.height - vv.offsetTop)

  return { top, bottom }
}

function parseCssEnv(name: string): number {
  try {
    const el = document.createElement('div')
    el.style.cssText = `position:fixed;${name}:env(${name},0px)`
    document.body.appendChild(el)

    const style = window.getComputedStyle(el)
    // 某些浏览器以像素字符串返回，某些以数字+单位返回
    const value = parseInt(style.getPropertyValue(name) || style.paddingTop || '0', 10)
    document.body.removeChild(el)
    return Math.max(0, isNaN(value) ? 0 : value)
  } catch {
    return 0
  }
}