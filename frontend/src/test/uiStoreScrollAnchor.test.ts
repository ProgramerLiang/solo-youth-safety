import { describe, expect, it, beforeEach } from 'vitest'
import { useUiStore } from '../stores/useUiStore'

beforeEach(() => {
  useUiStore.setState({ scrollAnchor: null })
})

describe('useUiStore scrollAnchor', () => {
  it('setScrollAnchor stores the anchor string', () => {
    useUiStore.getState().setScrollAnchor('geofence')
    expect(useUiStore.getState().scrollAnchor).toBe('geofence')
  })

  it('consumeScrollAnchor returns and clears the anchor', () => {
    useUiStore.getState().setScrollAnchor('geofence')
    expect(useUiStore.getState().consumeScrollAnchor()).toBe('geofence')
    expect(useUiStore.getState().scrollAnchor).toBe(null)
  })

  it('consumeScrollAnchor returns null when nothing was set', () => {
    expect(useUiStore.getState().consumeScrollAnchor()).toBe(null)
  })
})