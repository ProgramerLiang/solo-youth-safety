import { describe, expect, it, beforeEach } from 'vitest'
import { useTripPresetStore } from '../stores/useTripPresetStore'
import type { TripPreset } from '../types'

beforeEach(() => {
  useTripPresetStore.setState({ presets: [], loaded: false })
  localStorage.clear()
})

describe('useTripPresetStore', () => {
  it('starts with unloaded state', () => {
    const state = useTripPresetStore.getState()
    expect(state.loaded).toBe(false)
    expect(state.presets).toEqual([])
  })

  it('initialize loads presets from localStorage', async () => {
    const presets: TripPreset[] = [
      { id: 'p1', destination: '回家', durationMinutes: 30 },
      { id: 'p2', destination: '公司', durationMinutes: 45 },
    ]
    localStorage.setItem('safety_v2_trip_presets', JSON.stringify(presets))
    await useTripPresetStore.getState().initialize()
    const state = useTripPresetStore.getState()
    expect(state.loaded).toBe(true)
    expect(state.presets).toEqual(presets)
  })

  it('initialize returns empty array when no data', async () => {
    await useTripPresetStore.getState().initialize()
    const state = useTripPresetStore.getState()
    expect(state.loaded).toBe(true)
    expect(state.presets).toEqual([])
  })

  it('list returns current presets', async () => {
    const presets: TripPreset[] = [
      { id: 'p1', destination: '超市', durationMinutes: 20 },
    ]
    localStorage.setItem('safety_v2_trip_presets', JSON.stringify(presets))
    await useTripPresetStore.getState().initialize()
    expect(useTripPresetStore.getState().list()).toEqual(presets)
  })

  it('add creates and persists new preset', async () => {
    await useTripPresetStore.getState().initialize()
    await useTripPresetStore.getState().add('学校', 60)
    const state = useTripPresetStore.getState()
    expect(state.presets.length).toBe(1)
    expect(state.presets[0].destination).toBe('学校')
    expect(state.presets[0].durationMinutes).toBe(60)
    expect(state.presets[0].id).toMatch(/^preset_/)
    
    const saved = JSON.parse(localStorage.getItem('safety_v2_trip_presets')!)
    expect(saved.length).toBe(1)
    expect(saved[0].destination).toBe('学校')
  })

  it('update modifies preset and persists', async () => {
    const presets: TripPreset[] = [
      { id: 'p1', destination: '医院', durationMinutes: 15 },
    ]
    localStorage.setItem('safety_v2_trip_presets', JSON.stringify(presets))
    await useTripPresetStore.getState().initialize()
    
    await useTripPresetStore.getState().update('p1', { destination: '诊所' })
    const state = useTripPresetStore.getState()
    expect(state.presets[0].destination).toBe('诊所')
    expect(state.presets[0].durationMinutes).toBe(15)
    
    const saved = JSON.parse(localStorage.getItem('safety_v2_trip_presets')!)
    expect(saved[0].destination).toBe('诊所')
  })

  it('update can modify durationMinutes', async () => {
    const presets: TripPreset[] = [
      { id: 'p1', destination: '公园', durationMinutes: 30 },
    ]
    localStorage.setItem('safety_v2_trip_presets', JSON.stringify(presets))
    await useTripPresetStore.getState().initialize()
    
    await useTripPresetStore.getState().update('p1', { durationMinutes: 90 })
    const state = useTripPresetStore.getState()
    expect(state.presets[0].durationMinutes).toBe(90)
    expect(state.presets[0].destination).toBe('公园')
  })

  it('remove deletes preset and persists', async () => {
    const presets: TripPreset[] = [
      { id: 'p1', destination: 'A', durationMinutes: 10 },
      { id: 'p2', destination: 'B', durationMinutes: 20 },
    ]
    localStorage.setItem('safety_v2_trip_presets', JSON.stringify(presets))
    await useTripPresetStore.getState().initialize()
    
    await useTripPresetStore.getState().remove('p1')
    const state = useTripPresetStore.getState()
    expect(state.presets.length).toBe(1)
    expect(state.presets[0].id).toBe('p2')
    
    const saved = JSON.parse(localStorage.getItem('safety_v2_trip_presets')!)
    expect(saved.length).toBe(1)
    expect(saved[0].id).toBe('p2')
  })
})
