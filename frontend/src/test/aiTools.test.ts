import { describe, expect, it, vi, beforeEach } from 'vitest'
import { TOOL_DEFINITIONS, runTool, TOOL_PERMISSIONS } from '../ai/aiTools'
import { useContactsStore } from '../stores/useContactsStore'
import { useSosStore } from '../stores/useSosStore'
import { useTrackingStore } from '../stores/useTrackingStore'
import { useGeofenceStore } from '../stores/useGeofenceStore'
import { useSafetyTripStore } from '../stores/useSafetyTripStore'
import { useRuleEngineStore } from '../stores/useRuleEngineStore'

vi.mock('../data/sosLocation', () => ({
  getCurrentPosition: vi.fn(async () => ({ lat: 31.23, lng: 121.47, accuracy: 8 })),
}))
vi.mock('../data/locationProvider', () => ({
  getCurrentPosition: vi.fn(async () => ({ lat: 31.23, lng: 121.47, accuracy: 8 })),
}))

beforeEach(() => {
  useContactsStore.setState({ list: [], editingId: null, draft: { name: '', phone: '' }, loaded: true })
  useSosStore.setState({ history: [], arming: false, countdownActive: false, preArmSource: null })
  useTrackingStore.setState({ enabled: false, intervalSeconds: 60, pendingCount: 0, lastCapturedAt: null, lastAcknowledgedAt: null, busy: false, queue: [], history: [], loaded: true } as never)
  useGeofenceStore.setState({ zones: [], loaded: true })
  useSafetyTripStore.setState({ current: null, history: [], loaded: true, _notificationId: '' })
  useRuleEngineStore.setState({ rules: [], loaded: true })
})

describe('aiTools', () => {
  it('exposes tool definitions for get_contacts', () => {
    const getContacts = TOOL_DEFINITIONS.find(t => t.function?.name === 'get_contacts')
    expect(getContacts).toBeDefined()
    expect(getContacts!.type).toBe('function')
  })

  it('get_contacts returns the contact list', async () => {
    useContactsStore.setState({ list: [{ id: '1', name: '张三', phone: '13800138000' }] })
    const result = await runTool('get_contacts', {})
    expect(result.contacts).toHaveLength(1)
    expect(result.contacts[0].name).toBe('张三')
  })

  it('get_contacts returns empty list when no contacts', async () => {
    const result = await runTool('get_contacts', {})
    expect(result.contacts).toEqual([])
  })

  it('read tools require no confirmation', () => {
    expect(TOOL_PERMISSIONS['get_contacts']).toBe('read')
    expect(TOOL_PERMISSIONS['create_safety_trip']).toBe('write')
    expect(TOOL_PERMISSIONS['trigger_sos']).toBe('write')
  })

  it('returns error for unknown tool', async () => {
    const result = await runTool('nonexistent')
    expect('error' in result && result.error).toBeDefined()
  })

  it('exposes all required tool definitions', () => {
    const names = TOOL_DEFINITIONS.map(t => t.function?.name)
    expect(names).toContain('get_location')
    expect(names).toContain('get_sos_history')
    expect(names).toContain('get_tracking_status')
    expect(names).toContain('get_contacts')
    expect(names).toContain('get_geofence_zones')
    expect(names).toContain('get_safety_trip')
    expect(names).toContain('get_rules')
    expect(names).toContain('get_risk_summary')
    expect(names).toContain('create_safety_trip')
    expect(names).toContain('add_contact')
    expect(names).toContain('enable_tracking')
    expect(names).toContain('trigger_sos')
  })
})