import { useState, useEffect } from 'react'

export interface SafeAreaInsets {
  top: number    // 状态栏高度 CSS px
  bottom: number // 导航栏高度 CSS px
}

/**
 * 测量系统状态栏和导航栏的高度（CSS 像素）
 *
 * Android 标准：状态栏 24dp，导航栏 48dp（三键）/ ~12dp（手势）
 * CSS viewport 在 initial-scale=1 下 1dp ≈ 1 CSS px
 *
 * 测量优先级：
 * 1. visualViewport API（部分设备有效）
 * 2. env(safe-area-inset-*)（仅 iOS Safari 支持，Android WebView 通常返回 0）
 * 3. Android 标准 dp 值回退
 */
export function useSafeAreaInsets(): SafeAreaInsets {
  const [insets, setInsets] = useState<SafeAreaInsets>(() => getInitialInsets())

  useEffect(() => {
    // 异步再尝试一次更精确的测量
    const vv = window.visualViewport
    if (!vv) return

    const handler = () => {
      const measured = measureViaVisualViewport()
      if (measured.top > 0 || measured.bottom > 0) {
        setInsets(measured)
      }
    }
    // 延迟一下让布局稳定
    const timer = setTimeout(handler, 100)

    vv.addEventListener('resize', handler)
    return () => {
      clearTimeout(timer)
      vv.removeEventListener('resize', handler)
    }
  }, [])

  return insets
}

/** 同步初始值 */
function getInitialInsets(): SafeAreaInsets {
  const vv = window.visualViewport
  if (vv) {
    const measured = measureViaVisualViewport()
    if (measured.top > 0 || measured.bottom > 0) return measured
  }
  // Android 平台标准值
  return {
    top: 24,
    bottom: 48,
  }
}

/** 通过 visualViewport 测量 */
function measureViaVisualViewport(): SafeAreaInsets {
  try {
    const vv = window.visualViewport!
    const screenH = window.screen.height
    // offsetTop 在某些设备上是状态栏高度
    const top = Math.max(0, vv.offsetTop)
    // 导航栏 ≈ 屏幕总高 - 视口高 - 状态栏偏移
    const bottom = Math.max(0, Math.round(screenH - vv.height - vv.offsetTop))
    return {
      top: top >= 12 ? top : 24,    // 测不准时用默认
      bottom: bottom >= 12 ? bottom : 48,
    }
  } catch {
    return { top: 24, bottom: 48 }
  }
}