import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useLocationFreshness } from '../hooks/useLocationFreshness'

describe('useLocationFreshness', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns unknown when timestamp is null', async () => {
    const { result } = renderHook(() => useLocationFreshness(null))
    expect(result.current.level).toBe('unknown')
    expect(result.current.tone).toBe('default')
  })

  it('returns fresh when within 30s', async () => {
    const now = Date.now()
    vi.setSystemTime(now)
    const { result } = renderHook(() => useLocationFreshness(now - 10_000))
    expect(result.current.level).toBe('fresh')
    expect(result.current.tone).toBe('success')
  })

  it('returns outdated after 2min', async () => {
    const now = Date.now()
    vi.setSystemTime(now)
    const { result } = renderHook(() => useLocationFreshness(now - 180_000))
    expect(result.current.level).toBe('outdated')
    expect(result.current.tone).toBe('error')
  })

  it('recalculates every 15 seconds', async () => {
    const now = Date.now()
    vi.setSystemTime(now)
    const { result } = renderHook(() => useLocationFreshness(now - 20_000))

    // Initially fresh (< 30s)
    expect(result.current.level).toBe('fresh')

    // Advance past the 15s interval boundary; clock advances +15s, so age becomes 35s -> stale
    act(() => { vi.advanceTimersByTime(16_000) })
    expect(result.current.level).toBe('stale')
  })
})