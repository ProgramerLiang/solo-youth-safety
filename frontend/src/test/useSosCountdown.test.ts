import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useSosCountdown } from '../hooks/useSosCountdown'

describe('useSosCountdown', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('starts at 5 and counts down', async () => {
    const onElapsed = vi.fn()
    const { result } = renderHook(() => useSosCountdown(onElapsed))

    act(() => { result.current.start() })
    expect(result.current.remaining).toBe(5)
    expect(result.current.active).toBe(true)

    act(() => { vi.advanceTimersByTime(1000) })
    expect(result.current.remaining).toBe(4)

    act(() => { vi.advanceTimersByTime(4000) })
    expect(result.current.remaining).toBe(0)
    expect(result.current.active).toBe(false)
    expect(onElapsed).toHaveBeenCalled()
  })

  it('cancel stops countdown', async () => {
    const onElapsed = vi.fn()
    const { result } = renderHook(() => useSosCountdown(onElapsed))

    act(() => { result.current.start() })
    act(() => { vi.advanceTimersByTime(2000) })
    act(() => { result.current.cancel() })

    expect(result.current.active).toBe(false)
    expect(onElapsed).not.toHaveBeenCalled()
  })

  it('start again after cancel resets countdown', async () => {
    const onElapsed = vi.fn()
    const { result } = renderHook(() => useSosCountdown(onElapsed))

    act(() => { result.current.start() })
    act(() => { vi.advanceTimersByTime(2000) })
    act(() => { result.current.cancel() })

    act(() => { result.current.start() })
    expect(result.current.remaining).toBe(5)
  })
})