import { describe, expect, it, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useHashRouter } from '../hooks/useHashRouter'
import { ALL_PAGE_IDS } from '../types'

beforeEach(() => {
  window.location.hash = ''
})

describe('useHashRouter', () => {
  it('lands on home when hash is empty and onboarding is done', () => {
    const { result } = renderHook(() => useHashRouter(true))
    expect(result.current.activePageId).toBe('home')
  })

  it('resolves each new tab page from the hash', () => {
    for (const page of ['home', 'messages', 'scenes', 'membership', 'profile'] as const) {
      window.location.hash = page
      const { result } = renderHook(() => useHashRouter(true))
      expect(result.current.activePageId).toBe(page)
    }
  })

  it('falls back to home for an unknown hash', () => {
    window.location.hash = 'bogus'
    const { result } = renderHook(() => useHashRouter(true))
    expect(result.current.activePageId).toBe('home')
  })

  it('forces config while onboarding is incomplete', () => {
    window.location.hash = 'home'
    const { result } = renderHook(() => useHashRouter(false))
    expect(result.current.activePageId).toBe('config')
  })

  it('ALL_PAGE_IDS includes the five new pages and omits overview', () => {
    expect(ALL_PAGE_IDS).toContain('home')
    expect(ALL_PAGE_IDS).toContain('messages')
    expect(ALL_PAGE_IDS).toContain('scenes')
    expect(ALL_PAGE_IDS).toContain('membership')
    expect(ALL_PAGE_IDS).toContain('profile')
    expect(ALL_PAGE_IDS).not.toContain('overview')
  })
})