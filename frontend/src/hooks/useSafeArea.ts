import { useState, useEffect, useRef } from 'react'

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
 * 1. visualViewport API（部分设备有效），仅屏幕方向变化时更新（排除键盘弹出干扰）
 * 2. Android 标准 dp 值回退
 */
export function useSafeAreaInsets(): SafeAreaInsets {
  const [insets, setInsets] = useState<SafeAreaInsets>(() => getInitialInsets())
  const prevScreenHeight = useRef<number>(window.screen.height)

  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return

    const handler = () => {
      // 屏幕高度变化才是方向旋转（横竖屏），排除键盘弹出
      if (window.screen.height !== prevScreenHeight.current) {
        prevScreenHeight.current = window.screen.height
        // 延迟等待旋转动画完成
        requestAnimationFrame(() => {
          const measured = measureViaVisualViewport()
          if (measured.top > 0 || measured.bottom > 0) {
            setInsets(measured)
          }
        })
      }
    }

    vv.addEventListener('resize', handler)
    return () => vv.removeEventListener('resize', handler)
  }, [])

  return insets
}

/** 同步初始值 */
function getInitialInsets(): SafeAreaInsets {
  try {
    const vv = window.visualViewport
    if (vv) {
      const top = Math.max(0, vv.offsetTop)
      const bottom = Math.max(0, Math.round(window.screen.height - vv.height - vv.offsetTop))
      return {
        top: top >= 12 ? top : 24,
        bottom: bottom >= 12 ? bottom : 48,
      }
    }
  } catch {
    // fall through
  }
  return { top: 24, bottom: 48 }
}

/** 通过 visualViewport 测量 */
function measureViaVisualViewport(): SafeAreaInsets {
  try {
    const vv = window.visualViewport!
    const screenH = window.screen.height
    const top = Math.max(0, vv.offsetTop)
    const bottom = Math.max(0, Math.round(screenH - vv.height - vv.offsetTop))
    return {
      top: top >= 12 ? top : 24,
      bottom: bottom >= 12 ? bottom : 48,
    }
  } catch {
    return { top: 24, bottom: 48 }
  }
}