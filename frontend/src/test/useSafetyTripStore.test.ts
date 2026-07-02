import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useRuleEngineStore } from '../stores/useRuleEngineStore'
import { useSafetyTripStore } from '../stores/useSafetyTripStore'
import type { SafetyTrip } from '../domain/safetyTrip'

const originalRuleEvaluate = useRuleEngineStore.getState().evaluate
const NOW = new Date('2026-06-15T12:00:00.000Z').getTime()

function activeTrip(overrides: Partial<SafetyTrip> = {}): SafetyTrip {
  return {
    id: 't1',
    destination: '回宿舍',
    createdAt: new Date(NOW - 10 * 60_000).toISOString(),
    expectedArrivalAt: new Date(NOW + 20 * 60_000).toISOString(),
    status: 'active',
    events: [],
    ...overrides,
  }
}

beforeEach(() => {
  vi.restoreAllMocks()
  vi.useFakeTimers()
  vi.setSystemTime(NOW)
  localStorage.clear()
  useRuleEngineStore.setState({ rules: [], loaded: true, evaluate: originalRuleEvaluate })
  useSafetyTripStore.setState({ current: null, history: [], loaded: true, _notificationId: '' })
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  useRuleEngineStore.setState({ evaluate: originalRuleEvaluate })
})

describe('useSafetyTripStore smart rules integration', () => {
  it('evaluates smart rules after marking a trip arrived', async () => {
    const evaluate = vi.spyOn(useRuleEngineStore.getState(), 'evaluate').mockReturnValue([])
    useSafetyTripStore.setState({ current: activeTrip() })

    await useSafetyTripStore.getState().arrive()

    expect(evaluate).toHaveBeenCalledWith(expect.objectContaining({ tripStatus: 'arrived' }), expect.any(Number))
  })

  it('evaluates smart rules after extending a trip', async () => {
    const evaluate = vi.spyOn(useRuleEngineStore.getState(), 'evaluate').mockReturnValue([])
    useSafetyTripStore.setState({ current: activeTrip() })

    await useSafetyTripStore.getState().extend(10)

    expect(evaluate).toHaveBeenCalledWith(expect.objectContaining({ tripStatus: 'active' }), expect.any(Number))
  })

  it('evaluates smart rules after cancelling a trip', async () => {
    const evaluate = vi.spyOn(useRuleEngineStore.getState(), 'evaluate').mockReturnValue([])
    useSafetyTripStore.setState({ current: activeTrip() })

    await useSafetyTripStore.getState().cancel()

    expect(evaluate).toHaveBeenCalledWith(expect.objectContaining({ tripStatus: 'cancelled' }), expect.any(Number))
  })
})
