import { describe, expect, it, vi, beforeEach } from 'vitest'

vi.mock('../data/storage', () => ({
  storage: {
    getJson: vi.fn(),
    setJson: vi.fn(),
  },
}))

import { storage } from '../data/storage'
import { loadRules, saveRules, RULES_STORAGE_KEY } from '../data/ruleEngineRepo'
import type { AutomationRule } from '../types'

function sampleRule(overrides: Partial<AutomationRule> = {}): AutomationRule {
  return {
    id: 'r1', name: '测试', enabled: true,
    conditions: [{ signal: 'riskLevel', operator: 'gte', value: 'attention', label: '' }],
    actions: [{ type: 'localNotification', config: { title: '通知', body: '触发' }, label: '' }],
    cooldownMinutes: 5, lastFiredAt: null,
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('ruleEngineRepo', () => {
  it('loadRules returns empty array when no data', async () => {
    vi.mocked(storage.getJson).mockResolvedValue(null)
    expect(await loadRules()).toEqual([])
    expect(storage.getJson).toHaveBeenCalledWith(RULES_STORAGE_KEY)
  })

  it('saveRules and loadRules round-trip', async () => {
    const rules = [sampleRule()]
    let stored: AutomationRule[] | null = null
    vi.mocked(storage.setJson).mockImplementation(async (_key, val) => {
      stored = val as AutomationRule[]
    })
    vi.mocked(storage.getJson).mockImplementation(async () => stored)

    await saveRules(rules)
    expect(storage.setJson).toHaveBeenCalledWith(RULES_STORAGE_KEY, rules)

    const loaded = await loadRules()
    expect(loaded).toEqual(rules)
  })

  it('loadRules returns array from existing storage', async () => {
    const rules = [sampleRule(), sampleRule({ id: 'r2', name: '规则二' })]
    vi.mocked(storage.getJson).mockResolvedValue(rules)

    const loaded = await loadRules()
    expect(loaded).toHaveLength(2)
    expect(loaded[1]?.name).toBe('规则二')
  })
})
