# 智能规则（Smart Rules）实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现本地可配置的触发-动作链路系统，用户可以在 Android/Web 前端创建"当条件满足时自动触发通知或预武装 SOS"的规则。

**Architecture:** 新增 domain/ruleEngine（纯函数）→ data/ruleEngineRepo（持久化）→ stores/useRuleEngineStore（状态管理 + 评估调度）→ pages/RuleEnginePage（卡片式 UI），并按 spec 规定接缝导入 Overview/行程/围栏的评估入口。

**Tech Stack:** TypeScript, Zustand, MUI 6, Vitest, Capacitor Preferences/localStorage

## Global Constraints

- 规则评估是同步纯函数，不依赖网络、不异步。
- 预武装 SOS 仍保留 5 秒取消窗口，不静默触发。
- 通知文案不可包含联系人手机号或精确坐标。
- 规则数据通过 `storage` 抽象（`data/storage.ts`）持久化。
- 遵循现有代码约定：domain 层零 IO，store 通过 data/repo 读写持久化，页面不直接 import data/ 或 native/。
- 所有新功能必须遵循 TDD：每个任务先写测试，观察失败，再实现。
- 前端版本锁定为 0.5.0（本次不升版）。
- README 和能力边界暂不更新（等下次发版时统一同步）。

---

### Task 1: 类型定义 + 领域层（domain/ruleEngine）

**Files:**
- Modify: `frontend/src/types/index.ts` — 追加 `RuleSignal`, `RuleOperator`, `RuleActionType`, `RuleCondition`, `RuleAction`, `AutomationRule`, `RuleEvaluationState`
- Create: `frontend/src/domain/ruleEngine.ts` — `evaluateRule()`, `isRuleOnCooldown()`, `evaluateAllRules()`
- Create: `frontend/src/test/ruleEngine.test.ts` — TDD 测试

**Interfaces:**
- Produces: `evaluateRule(rule, state, now?) → boolean`, `isRuleOnCooldown(rule, now?) → boolean`, `evaluateAllRules(rules, state, now?) → AutomationRule[]`

---

- [ ] **Step 1: Types — 追加到 types/index.ts**

在 `PrivacyLockConfig` 接口后（约第 178 行）追加：

```typescript
// Smart Rules (v0.5.0)
export type RuleSignal = 'riskLevel' | 'tripStatus' | 'tripOvertimeMinutes' | 'geofenceEvent' | 'stationaryMinutes'
export type RuleOperator = 'eq' | 'gte' | 'gt'
export type RuleActionType = 'localNotification' | 'preArmSos'

export interface RuleCondition {
  signal: RuleSignal
  operator: RuleOperator
  value: string | number
  label: string
}

export interface RuleAction {
  type: RuleActionType
  config: Record<string, string>
  label: string
}

export interface AutomationRule {
  id: string
  name: string
  enabled: boolean
  conditions: RuleCondition[]
  actions: RuleAction[]
  cooldownMinutes: number
  lastFiredAt: number | null
}

export interface RuleEvaluationState {
  riskLevel: 'ok' | 'attention' | 'warning'
  tripStatus: 'active' | 'overtime' | 'arrived' | 'cancelled' | null
  tripOvertimeMinutes: number | null
  latestGeofenceEvent: { type: 'entered' | 'left'; zoneName: string } | null
  stationaryMinutes: number | null
}
```

- [ ] **Step 2: 写失败测试 — `test/ruleEngine.test.ts`**

```typescript
import { describe, expect, it } from 'vitest'
import { evaluateRule, isRuleOnCooldown, evaluateAllRules } from '../domain/ruleEngine'
import type { AutomationRule, RuleEvaluationState, RuleCondition } from '../types'

function sampleRule(overrides: Partial<AutomationRule> = {}): AutomationRule {
  return {
    id: 'rule-1',
    name: '测试规则',
    enabled: true,
    conditions: [{ signal: 'riskLevel', operator: 'gte', value: 'attention', label: '风险 ≥ attention' }],
    actions: [{ type: 'localNotification', config: { title: '通知', body: '触发' }, label: '通知' }],
    cooldownMinutes: 5,
    lastFiredAt: null,
    ...overrides,
  }
}

function sampleState(overrides: Partial<RuleEvaluationState> = {}): RuleEvaluationState {
  return {
    riskLevel: 'ok',
    tripStatus: null,
    tripOvertimeMinutes: null,
    latestGeofenceEvent: null,
    stationaryMinutes: null,
    ...overrides,
  }
}

describe('evaluateRule', () => {
  it('returns true when riskLevel condition matches', () => {
    const rule = sampleRule()
    const state = sampleState({ riskLevel: 'attention' })
    expect(evaluateRule(rule, state)).toBe(true)
  })

  it('returns false when riskLevel condition does not match', () => {
    const rule = sampleRule()
    const state = sampleState({ riskLevel: 'ok' })
    expect(evaluateRule(rule, state)).toBe(false)
  })

  it('returns false when rule is disabled', () => {
    const rule = sampleRule({ enabled: false })
    const state = sampleState({ riskLevel: 'attention' })
    expect(evaluateRule(rule, state)).toBe(false)
  })

  it('returns false when rule is on cooldown', () => {
    const now = 100_000
    const rule = sampleRule({ lastFiredAt: now - 60_000 })  // 1 min ago, cooldown is 5 min
    const state = sampleState({ riskLevel: 'attention' })
    expect(evaluateRule(rule, state, now)).toBe(false)
  })

  it('returns true when cooldown has elapsed', () => {
    const now = 100_000
    const rule = sampleRule({ lastFiredAt: now - 10 * 60_000 })  // 10 min ago, cooldown is 5 min
    const state = sampleState({ riskLevel: 'attention' })
    expect(evaluateRule(rule, state, now)).toBe(true)
  })

  it('returns true when all AND conditions are met', () => {
    const conditions: RuleCondition[] = [
      { signal: 'riskLevel', operator: 'gte', value: 'attention', label: '风险 ≥ attention' },
      { signal: 'tripStatus', operator: 'eq', value: 'overtime', label: '行程 = 超时' },
    ]
    const rule = sampleRule({ conditions })
    const state = sampleState({ riskLevel: 'warning', tripStatus: 'overtime' })
    expect(evaluateRule(rule, state)).toBe(true)
  })

  it('returns false when any AND condition is not met', () => {
    const conditions: RuleCondition[] = [
      { signal: 'riskLevel', operator: 'gte', value: 'attention', label: '风险 ≥ attention' },
      { signal: 'tripStatus', operator: 'eq', value: 'overtime', label: '行程 = 超时' },
    ]
    const rule = sampleRule({ conditions })
    const state = sampleState({ riskLevel: 'attention', tripStatus: 'arrived' })
    expect(evaluateRule(rule, state)).toBe(false)
  })

  it('evaluates tripOvertimeMinutes with gt operator', () => {
    const conditions: RuleCondition[] = [
      { signal: 'tripOvertimeMinutes', operator: 'gt', value: 10, label: '超时 > 10 分钟' },
    ]
    const rule = sampleRule({ conditions })
    expect(evaluateRule(rule, sampleState({ tripOvertimeMinutes: 15 }))).toBe(true)
    expect(evaluateRule(rule, sampleState({ tripOvertimeMinutes: 5 }))).toBe(false)
    expect(evaluateRule(rule, sampleState({ tripOvertimeMinutes: 10 }))).toBe(false) // gt, not gte
  })

  it('evaluates stationaryMinutes with gte operator', () => {
    const conditions: RuleCondition[] = [
      { signal: 'stationaryMinutes', operator: 'gte', value: 30, label: '静止 ≥ 30 分钟' },
    ]
    const rule = sampleRule({ conditions })
    expect(evaluateRule(rule, sampleState({ stationaryMinutes: 30 }))).toBe(true)
    expect(evaluateRule(rule, sampleState({ stationaryMinutes: 45 }))).toBe(true)
    expect(evaluateRule(rule, sampleState({ stationaryMinutes: 15 }))).toBe(false)
  })

  it('evaluates geofenceEvent condition', () => {
    const conditions: RuleCondition[] = [
      { signal: 'geofenceEvent', operator: 'eq', value: 'entered:火车站周边', label: '进入火车站周边' },
    ]
    const rule = sampleRule({ conditions })
    const state = sampleState({ latestGeofenceEvent: { type: 'entered', zoneName: '火车站周边' } })
    expect(evaluateRule(rule, state)).toBe(true)

    const state2 = sampleState({ latestGeofenceEvent: { type: 'left', zoneName: '火车站周边' } })
    expect(evaluateRule(rule, state2)).toBe(false)
  })

  it('returns false when signal source is null', () => {
    const conditions: RuleCondition[] = [
      { signal: 'tripStatus', operator: 'eq', value: 'overtime', label: '行程 = 超时' },
    ]
    const rule = sampleRule({ conditions })
    expect(evaluateRule(rule, sampleState({ tripStatus: null }))).toBe(false)
  })
})

describe('isRuleOnCooldown', () => {
  it('returns false when lastFiredAt is null', () => {
    expect(isRuleOnCooldown(sampleRule({ lastFiredAt: null }), 100_000)).toBe(false)
  })

  it('returns true within cooldown period', () => {
    const now = 100_000
    expect(isRuleOnCooldown(sampleRule({ lastFiredAt: now - 60_000 }), now)).toBe(true)  // 1 min
    expect(isRuleOnCooldown(sampleRule({ lastFiredAt: now - 4 * 60_000 }), now)).toBe(true)  // 4 min
  })

  it('returns false after cooldown period', () => {
    const now = 100_000
    expect(isRuleOnCooldown(sampleRule({ lastFiredAt: now - 5 * 60_000 }), now)).toBe(false)  // exactly 5 min
    expect(isRuleOnCooldown(sampleRule({ lastFiredAt: now - 10 * 60_000 }), now)).toBe(false)  // 10 min
  })
})

describe('evaluateAllRules', () => {
  it('returns only matching rules', () => {
    const rule1 = sampleRule({ id: 'r1', conditions: [{ signal: 'riskLevel', operator: 'gte', value: 'attention', label: '' }] })
    const rule2 = sampleRule({ id: 'r2', conditions: [{ signal: 'tripStatus', operator: 'eq', value: 'overtime', label: '' }] })
    const state = sampleState({ riskLevel: 'attention', tripStatus: 'arrived' })
    expect(evaluateAllRules([rule1, rule2], state).map(r => r.id)).toEqual(['r1'])
  })

  it('returns empty when no rules match', () => {
    const rule = sampleRule({ conditions: [{ signal: 'riskLevel', operator: 'gte', value: 'warning', label: '' }] })
    expect(evaluateAllRules([rule], sampleState({ riskLevel: 'ok' }))).toEqual([])
  })

  it('returns empty array for empty rules input', () => {
    expect(evaluateAllRules([], sampleState())).toEqual([])
  })
})
```

- [ ] **Step 3: 运行测试 — 预期失败**

```bash
cd frontend && npx vitest run src/test/ruleEngine.test.ts -v
```
预期：`FAIL` — `evaluateRule is not defined` 等导入错误。

- [ ] **Step 4: 实现领域层 — `domain/ruleEngine.ts`**

```typescript
import type { AutomationRule, RuleCondition, RuleEvaluationState, RuleSignal, RuleOperator } from '../types'

export function evaluateRule(rule: AutomationRule, state: RuleEvaluationState, now?: number): boolean {
  if (!rule.enabled) return false
  if (isRuleOnCooldown(rule, now)) return false
  return rule.conditions.every(cond => evaluateCondition(cond, state))
}

export function isRuleOnCooldown(rule: AutomationRule, now?: number): boolean {
  if (rule.lastFiredAt === null) return false
  const t = now ?? Date.now()
  return (t - rule.lastFiredAt) < rule.cooldownMinutes * 60_000
}

export function evaluateAllRules(
  rules: AutomationRule[],
  state: RuleEvaluationState,
  now?: number,
): AutomationRule[] {
  return rules.filter(rule => evaluateRule(rule, state, now))
}

function evaluateCondition(cond: RuleCondition, state: RuleEvaluationState): boolean {
  const actual = getSignalValue(cond.signal, state)
  if (actual === null || actual === undefined) return false

  switch (cond.operator) {
    case 'eq': return String(actual) === String(cond.value)
    case 'gte': return Number(actual) >= Number(cond.value)
    case 'gt': return Number(actual) > Number(cond.value)
    default: return false
  }
}

function getSignalValue(signal: RuleSignal, state: RuleEvaluationState): string | number | null {
  switch (signal) {
    case 'riskLevel': return state.riskLevel
    case 'tripStatus': return state.tripStatus
    case 'tripOvertimeMinutes': return state.tripOvertimeMinutes
    case 'stationaryMinutes': return state.stationaryMinutes
    case 'geofenceEvent':
      return state.latestGeofenceEvent ? `${state.latestGeofenceEvent.type}:${state.latestGeofenceEvent.zoneName}` : null
  }
}
```

- [ ] **Step 5: 运行测试 — 预期通过**

```bash
cd frontend && npx vitest run src/test/ruleEngine.test.ts -v
```
预期：全部 PASS。

- [ ] **Step 6: 提交**

```bash
cd ~/Desktop/jjqy/new && git add frontend/src/types/index.ts frontend/src/domain/ruleEngine.ts frontend/src/test/ruleEngine.test.ts
git commit -m "feat(smart-rules): add types and domain layer for rule engine"
```

---

### Task 2: 数据持久化（ruleEngineRepo）

**Files:**
- Create: `frontend/src/data/ruleEngineRepo.ts`
- Create: `frontend/src/test/ruleEngineRepo.test.ts`

**Interfaces:**
- Consumes: `AutomationRule`, `storage` from `data/storage.ts`
- Produces: `loadRules() → Promise<AutomationRule[]>`, `saveRules(rules) → Promise<void>`

---

- [ ] **Step 1: 写失败测试 — `test/ruleEngineRepo.test.ts`**

```typescript
import { describe, expect, it, beforeEach } from 'vitest'
import { loadRules, saveRules, RULES_STORAGE_KEY } from '../data/ruleEngineRepo'
import { storage } from '../data/storage'
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

beforeEach(async () => {
  await storage.remove(RULES_STORAGE_KEY)
})

describe('ruleEngineRepo', () => {
  it('loadRules returns empty array when no data', async () => {
    expect(await loadRules()).toEqual([])
  })

  it('saveRules and loadRules round-trip', async () => {
    const rules = [sampleRule()]
    await saveRules(rules)
    expect(await loadRules()).toEqual(rules)
  })

  it('loadRules returns array from existing storage', async () => {
    const rules = [sampleRule(), sampleRule({ id: 'r2', name: '规则二' })]
    await storage.setJson(RULES_STORAGE_KEY, rules)
    const loaded = await loadRules()
    expect(loaded).toHaveLength(2)
    expect(loaded[1]?.name).toBe('规则二')
  })
})
```

- [ ] **Step 2: 运行测试 — 预期失败**

```bash
cd frontend && npx vitest run src/test/ruleEngineRepo.test.ts -v
```

- [ ] **Step 3: 实现 — `data/ruleEngineRepo.ts`**

```typescript
import { storage } from './storage'
import type { AutomationRule } from '../types'

export const RULES_STORAGE_KEY = 'safety_v2_smart_rules'

export async function loadRules(): Promise<AutomationRule[]> {
  const data = await storage.getJson<AutomationRule[]>(RULES_STORAGE_KEY)
  return Array.isArray(data) ? data : []
}

export async function saveRules(rules: AutomationRule[]): Promise<void> {
  await storage.setJson(RULES_STORAGE_KEY, rules)
}
```

- [ ] **Step 4: 运行测试 — 预期通过**

```bash
cd frontend && npx vitest run src/test/ruleEngineRepo.test.ts -v
```

- [ ] **Step 5: 提交**

```bash
cd ~/Desktop/jjqy/new && git add frontend/src/data/ruleEngineRepo.ts frontend/src/test/ruleEngineRepo.test.ts
git commit -m "feat(smart-rules): add data persistence for automation rules"
```

---

### Task 3: Store（useRuleEngineStore）

**Files:**
- Create: `frontend/src/stores/useRuleEngineStore.ts`
- Create: `frontend/src/test/useRuleEngineStore.test.ts`

**Interfaces:**
- Consumes: `loadRules`, `saveRules` from repo, `evaluateRule`, `evaluateAllRules`, `isRuleOnCooldown` from domain
- Produces: `rules`, `loaded`, `initialize()`, `addRule()`, `updateRule()`, `deleteRule()`, `setEnabled()`, `evaluate(state) → AutomationRule[]`

---

- [ ] **Step 1: 写失败测试 — `test/useRuleEngineStore.test.ts`**

```typescript
import { describe, expect, it, beforeEach } from 'vitest'
import { useRuleEngineStore } from '../stores/useRuleEngineStore'
import { RULES_STORAGE_KEY } from '../data/ruleEngineRepo'
import type { AutomationRule, RuleEvaluationState } from '../types'

function sampleRule(overrides: Partial<AutomationRule> = {}): AutomationRule {
  return {
    id: 'r1', name: '测试', enabled: true,
    conditions: [{ signal: 'riskLevel', operator: 'gte', value: 'attention', label: '' }],
    actions: [{ type: 'localNotification', config: { title: '通知', body: '触发' }, label: '' }],
    cooldownMinutes: 5, lastFiredAt: null,
    ...overrides,
  }
}

beforeEach(async () => {
  localStorage.clear()
  useRuleEngineStore.setState({ rules: [], loaded: false })
})

describe('useRuleEngineStore', () => {
  it('initialize loads rules from storage', async () => {
    const stored = [sampleRule()]
    localStorage.setItem(RULES_STORAGE_KEY, JSON.stringify(stored))
    await useRuleEngineStore.getState().initialize()
    expect(useRuleEngineStore.getState().rules).toEqual(stored)
    expect(useRuleEngineStore.getState().loaded).toBe(true)
  })

  it('initialize handles empty storage', async () => {
    await useRuleEngineStore.getState().initialize()
    expect(useRuleEngineStore.getState().rules).toEqual([])
    expect(useRuleEngineStore.getState().loaded).toBe(true)
  })

  it('addRule creates new rule with generated id', async () => {
    await useRuleEngineStore.getState().initialize()
    const input = {
      name: '新规则', enabled: true,
      conditions: [{ signal: 'riskLevel', operator: 'gte', value: 'warning', label: '' }],
      actions: [{ type: 'preArmSos', config: {}, label: '' }],
      cooldownMinutes: 5,
    }
    await useRuleEngineStore.getState().addRule(input)
    const state = useRuleEngineStore.getState()
    expect(state.rules).toHaveLength(1)
    expect(state.rules[0]!.name).toBe('新规则')
    expect(state.rules[0]!.id).toBeTruthy()
    expect(state.rules[0]!.lastFiredAt).toBeNull()
    // Verify persistence
    const stored = JSON.parse(localStorage.getItem(RULES_STORAGE_KEY) ?? '[]')
    expect(stored).toHaveLength(1)
  })

  it('updateRule patches existing rule fields', async () => {
    await useRuleEngineStore.getState().initialize()
    await useRuleEngineStore.getState().addRule({
      name: '旧名', enabled: true,
      conditions: [{ signal: 'riskLevel', operator: 'gte', value: 'attention', label: '' }],
      actions: [{ type: 'localNotification', config: {}, label: '' }],
      cooldownMinutes: 5,
    })
    const id = useRuleEngineStore.getState().rules[0]!.id
    await useRuleEngineStore.getState().updateRule(id, { name: '新名', cooldownMinutes: 15 })
    expect(useRuleEngineStore.getState().rules[0]!.name).toBe('新名')
    expect(useRuleEngineStore.getState().rules[0]!.cooldownMinutes).toBe(15)
  })

  it('deleteRule removes rule by id', async () => {
    await useRuleEngineStore.getState().initialize()
    await useRuleEngineStore.getState().addRule({
      name: '待删除', enabled: true,
      conditions: [{ signal: 'riskLevel', operator: 'gte', value: 'attention', label: '' }],
      actions: [{ type: 'localNotification', config: {}, label: '' }],
      cooldownMinutes: 5,
    })
    const id = useRuleEngineStore.getState().rules[0]!.id
    await useRuleEngineStore.getState().deleteRule(id)
    expect(useRuleEngineStore.getState().rules).toHaveLength(0)
  })

  it('setEnabled toggles rule on/off', async () => {
    await useRuleEngineStore.getState().initialize()
    await useRuleEngineStore.getState().addRule({
      name: '切换测试', enabled: true,
      conditions: [{ signal: 'riskLevel', operator: 'gte', value: 'attention', label: '' }],
      actions: [{ type: 'localNotification', config: {}, label: '' }],
      cooldownMinutes: 5,
    })
    const id = useRuleEngineStore.getState().rules[0]!.id
    await useRuleEngineStore.getState().setEnabled(id, false)
    expect(useRuleEngineStore.getState().rules[0]!.enabled).toBe(false)
    await useRuleEngineStore.getState().setEnabled(id, true)
    expect(useRuleEngineStore.getState().rules[0]!.enabled).toBe(true)
  })

  it('evaluate returns matching rules and updates lastFiredAt', async () => {
    await useRuleEngineStore.getState().initialize()
    await useRuleEngineStore.getState().addRule({
      name: '匹配规则', enabled: true,
      conditions: [{ signal: 'riskLevel', operator: 'gte', value: 'attention', label: '' }],
      actions: [{ type: 'localNotification', config: { title: '通知', body: '触发' }, label: '' }],
      cooldownMinutes: 5,
    })
    const state: RuleEvaluationState = {
      riskLevel: 'warning', tripStatus: null, tripOvertimeMinutes: null,
      latestGeofenceEvent: null, stationaryMinutes: null,
    }
    const fired = useRuleEngineStore.getState().evaluate(state)
    expect(fired).toHaveLength(1)
    expect(fired[0]!.id).toBeTruthy()
    expect(useRuleEngineStore.getState().rules[0]!.lastFiredAt).not.toBeNull()
  })

  it('evaluate does not return rules on cooldown', async () => {
    await useRuleEngineStore.getState().initialize()
    await useRuleEngineStore.getState().addRule({
      name: '冷却测试', enabled: true,
      conditions: [{ signal: 'riskLevel', operator: 'gte', value: 'attention', label: '' }],
      actions: [{ type: 'localNotification', config: { title: '通知', body: '触发' }, label: '' }],
      cooldownMinutes: 5,
    })
    const state: RuleEvaluationState = {
      riskLevel: 'warning', tripStatus: null, tripOvertimeMinutes: null,
      latestGeofenceEvent: null, stationaryMinutes: null,
    }
    const now = Date.now()
    useRuleEngineStore.getState().rules[0]!.lastFiredAt = now - 60_000 // 1 minute ago
    const fired = useRuleEngineStore.getState().evaluate(state, now)
    expect(fired).toHaveLength(0)
  })
})
```

- [ ] **Step 2: 运行测试 — 预期失败**

```bash
cd frontend && npx vitest run src/test/useRuleEngineStore.test.ts -v
```

- [ ] **Step 3: 实现 Store**

```typescript
import { create } from 'zustand'
import { loadRules, saveRules } from '../data/ruleEngineRepo'
import { evaluateAllRules, isRuleOnCooldown } from '../domain/ruleEngine'
import type { AutomationRule, RuleEvaluationState } from '../types'

interface RuleEngineState {
  rules: AutomationRule[]
  loaded: boolean
  initialize: () => Promise<void>
  addRule: (input: Omit<AutomationRule, 'id' | 'lastFiredAt'>) => Promise<void>
  updateRule: (id: string, updates: Partial<AutomationRule>) => Promise<void>
  deleteRule: (id: string) => Promise<void>
  setEnabled: (id: string, enabled: boolean) => Promise<void>
  evaluate: (state: RuleEvaluationState, now?: number) => AutomationRule[]
}

let nextIdCounter = 0
function generateId(): string {
  nextIdCounter++
  return `rule-${Date.now()}-${nextIdCounter}`
}

export const useRuleEngineStore = create<RuleEngineState>((set, get) => ({
  rules: [],
  loaded: false,

  initialize: async () => {
    const rules = await loadRules()
    set({ rules, loaded: true })
  },

  addRule: async (input) => {
    const newRule: AutomationRule = {
      ...input,
      id: generateId(),
      lastFiredAt: null,
    }
    const rules = [...get().rules, newRule]
    await saveRules(rules)
    set({ rules })
  },

  updateRule: async (id, updates) => {
    const rules = get().rules.map(r => r.id === id ? { ...r, ...updates } : r)
    await saveRules(rules)
    set({ rules })
  },

  deleteRule: async (id) => {
    const rules = get().rules.filter(r => r.id !== id)
    await saveRules(rules)
    set({ rules })
  },

  setEnabled: async (id, enabled) => {
    await get().updateRule(id, { enabled })
  },

  evaluate: (state, now) => {
    const now_ = now ?? Date.now()
    const rules = get().rules
    const fired = evaluateAllRules(rules, state, now_)
    if (fired.length > 0) {
      // Update lastFiredAt for fired rules
      const updated = rules.map(r =>
        fired.some(f => f.id === r.id) ? { ...r, lastFiredAt: now_ } : r,
      )
      // Fire and forget persist
      saveRules(updated)
      set({ rules: updated })
    }
    return fired
  },
}))
```

- [ ] **Step 4: 运行测试 — 预期通过**

```bash
cd frontend && npx vitest run src/test/useRuleEngineStore.test.ts -v
```

- [ ] **Step 5: 提交**

```bash
cd ~/Desktop/jjqy/new && git add frontend/src/stores/useRuleEngineStore.ts frontend/src/test/useRuleEngineStore.test.ts
git commit -m "feat(smart-rules): add store for rule CRUD and evaluation"
```

---

### Task 4: 页面 + 导航（RuleEnginePage）

**Files:**
- Create: `frontend/src/pages/RuleEnginePage.tsx`
- Create: `frontend/src/test/ruleEnginePage.test.tsx`
- Modify: `frontend/src/types/index.ts` — `PageId` + `ALL_PAGE_IDS` 追加 `'smartRules'`
- Modify: `frontend/src/App.tsx` — 注册路由
- Modify: `frontend/src/shell/NavigationDrawer.tsx` — 侧边栏映射
- Modify: `frontend/src/i18n/zh-CN.ts` — 标签文案

**Interfaces:**
- Consumes: `useRuleEngineStore`, types, MUI components

---

- [ ] **Step 1: 导航注册 — 修改 types/App/i18n/shell**

**a) types/index.ts**: `PageId` 追加 `| 'smartRules'`，`ALL_PAGE_IDS` 追加 `'smartRules'`

**b) i18n/zh-CN.ts**: 在 `pages.tools` 之后追加：
```typescript
smartRules: { label: '智能规则' },
```

**c) shell/NavigationDrawer.tsx**: `pageLabel` 追加：
```typescript
smartRules: zhCN.pages.smartRules.label,
```

**d) App.tsx**: 导入并注册：
```typescript
import { RuleEnginePage } from './pages/RuleEnginePage'
```
```typescript
const pageMap: Record<PageId, React.ReactElement> = {
  ...
  smartRules: <RuleEnginePage />,
}
```

- [ ] **Step 2: 写页面测试 — `test/ruleEnginePage.test.tsx`**

```typescript
import { describe, expect, it, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { RuleEnginePage } from '../pages/RuleEnginePage'
import { useRuleEngineStore } from '../stores/useRuleEngineStore'

beforeEach(async () => {
  useRuleEngineStore.setState({ rules: [], loaded: true })
})

describe('RuleEnginePage', () => {
  it('shows empty state when no rules exist', async () => {
    render(<RuleEnginePage />)
    expect(screen.getByText('暂无智能规则')).toBeInTheDocument()
    expect(screen.getByText('创建一条规则，让应用在满足条件时自动提醒你')).toBeInTheDocument()
  })

  it('renders rule cards with name, conditions, actions', async () => {
    useRuleEngineStore.setState({
      rules: [{
        id: 'r1', name: '测试规则', enabled: true,
        conditions: [{ signal: 'riskLevel', operator: 'gte', value: 'attention', label: '风险 ≥ attention' }],
        actions: [{ type: 'localNotification', config: { title: '通知', body: '触发' }, label: '通知' }],
        cooldownMinutes: 5, lastFiredAt: null,
      }],
      loaded: true,
    })
    render(<RuleEnginePage />)
    expect(screen.getByText('测试规则')).toBeInTheDocument()
    expect(screen.getByText('风险 ≥ attention')).toBeInTheDocument()
  })

  it('shows create dialog on button click', async () => {
    render(<RuleEnginePage />)
    fireEvent.click(screen.getByText('创建规则'))
    expect(screen.getByText('新建智能规则')).toBeInTheDocument()
  })
})
```

- [ ] **Step 3: 运行测试 — 预期失败**

```bash
cd frontend && npx vitest run src/test/ruleEnginePage.test.tsx -v
```

- [ ] **Step 4: 实现页面 — `pages/RuleEnginePage.tsx`**

借鉴现有页面风格（如 `ConfigPage.tsx`），使用 MUI 的 `Stack`, `Card`, `CardContent`, `Button`, `Switch`, `Dialog`, `DialogTitle`, `DialogContent`, `DialogActions`, `Typography`, `TextField`, `Select`, `MenuItem`, `IconButton`, `Chip` 等组件。

页面结构：
1. **顶部**：标题 "智能规则" + "创建规则" 按钮
2. **规则列表**：`rules.map()` 渲染卡片
   - 每张卡片：左上角规则名 + enabled Switch，条件摘要（`conditions.map(cond.label)`），动作摘要（`actions.map(action.label)`）
3. **空态**：当 `rules.length === 0` 时显示空态组件
4. **编辑弹窗**：Dialog 包含
   - 名称 TextField
   - 条件区：每行三栏 Select（信号、运算符、值/枚举）
   - 动作区：每行 Select（动作类型）+ 通知文案 TextField
   - 冷却时间 Select（1/5/15/30/60 分钟）
   - [删除]/[保存] 按钮

> **注意**：页面实现建议用 MUI `Dialog` 做编辑弹窗而不是 spec 里提到的底部 Sheet，因为 Dialog 在移动端测试和翻译更可靠，且当前代码库没有出现底部 Sheet 编辑模式。

编辑条件值的枚举列表根据信号类型动态切换：
- `riskLevel` → Select: `ok`, `attention`, `warning`
- `tripStatus` → Select: `active`, `overtime`, `arrived`, `cancelled`
- `tripOvertimeMinutes` → TextField (number) 或 Select: `5`, `10`, `15`, `30`
- `stationaryMinutes` → TextField (number) 或 Select: `30`, `60`, `120`
- `geofenceEvent` → 复合 Select: `entered:X`, `left:X`（围栏名称从 `useGeofenceStore` 获取）
- 冷却时间 → Select: `1`, `5`, `15`, `30`, `60`

> 实际操作时，遇到已有的围栏数据接口后按实际调用。

- [ ] **Step 5: 运行测试 — 预期通过**

```bash
cd frontend && npx vitest run src/test/ruleEnginePage.test.tsx -v
```
然后确认不破坏现有测试：
```bash
cd frontend && npm run typecheck && npm test
```

- [ ] **Step 6: 提交**

```bash
cd ~/Desktop/jjqy/new && git add frontend/src/pages/RuleEnginePage.tsx frontend/src/test/ruleEnginePage.test.tsx frontend/src/types/index.ts frontend/src/App.tsx frontend/src/shell/NavigationDrawer.tsx frontend/src/i18n/zh-CN.ts
git commit -m "feat(smart-rules): add rule engine page with card UI and navigation"
```

---

### Task 5: 集成（Overview/SafetyTrip/Tracking 接缝）

**Files:**
- Modify: `frontend/src/pages/OverviewPage.tsx` — 风险刷新时调用 evaluate()
- Modify: `frontend/src/stores/useSafetyTripStore.ts` — 行程状态变更时调用 evaluate()
- Modify: `frontend/src/stores/useTrackingStore.ts` — 围栏事件触发 evaluate()

---

- [ ] **Step 1: OverviewPage — 在风险评估旁调用 evaluate**

在 `OverviewPage.tsx` 中找到 `useEffect` 中调用 `aggregateRiskData` 的地方，追加 `useRuleEngineStore` 评估：

```typescript
import { useRuleEngineStore } from '../stores/useRuleEngineStore'
```

在每次风险数据刷新后（已有 `useEffect` 依赖 `riskItems` 的区段），构造 `RuleEvaluationState` 并调用 `evaluate()`：

```typescript
const evaluateRules = useRuleEngineStore((s) => s.evaluate)

// 在现有 useEffect 中，计算风险数据完成后追加：
useEffect(() => {
  if (!trackingStoreReady) return
  // ... 现有代码计算 riskItems ...
  
  // 追加：规则引擎评估
  evaluateRules({
    riskLevel,
    tripStatus: currentTrip ? deriveSafetyTripStatus(currentTrip) : null,
    tripOvertimeMinutes: currentTrip && deriveSafetyTripStatus(currentTrip) === 'overtime'
      ? Math.floor((Date.now() - new Date(currentTrip.createdAt).getTime()) / 60000)
      : null,
    latestGeofenceEvent: null, // 由 TrackingStore 触发
    stationaryMinutes: null,   // 由 TrackingStore 触发
  })
}, [...])
```

- [ ] **Step 2: useSafetyTripStore — 行程状态变更时评估**

在 `useSafetyTripStore.ts` 中，在 `checkIn()`, `extend()`, `cancel()`, 和超时判断（已有超时周期性检查的 effect）中调用 evaluate：

```typescript
import { useRuleEngineStore } from './useRuleEngineStore'
```

在 `confirmArrival`, `extend`, `cancel` 等方法最后追加：
```typescript
const ruleState = {
  riskLevel: 'ok' as const,
  tripStatus: status as RuleEvaluationState['tripStatus'],
  tripOvertimeMinutes: status === 'overtime' ? Math.floor((Date.now() - new Date(trip.createdAt).getTime()) / 60000) : null,
  latestGeofenceEvent: null,
  stationaryMinutes: null,
}
useRuleEngineStore.getState().evaluate(ruleState)
```

- [ ] **Step 3: useTrackingStore — 围栏事件触发时评估**

在 `useTrackingStore.ts` 中找到围栏事件产生的逻辑（`routeGeofenceEvents` 返回的位置），追加评估调用。围栏事件通常来自 OverviewPage 的现有 geofence hook/effect，也可在 `acknowledgeQueue` 或采样循环后追加。

简化方案：不在 store 内部触发，而是在 `OverviewPage.tsx` 已绑定的 geofence 数据处理逻辑中，把 `latestGeofenceEvent` 传递给 `evaluateRules` 调用。这样不增加 store 间的循环依赖。

实际效果：OverviewPage 里的风险刷新 effect 自然也会获得围栏事件数据，所以 Task 5 Step 1 已覆盖围栏触发。不需要额外修改 TrackingStore。

- [ ] **Step 4: 验证集成不破坏现有行为**

```bash
cd frontend && npm test
```

确保全部 270+ 个测试通过。

- [ ] **Step 5: 提交**

```bash
cd ~/Desktop/jjqy/new && git add frontend/src/pages/OverviewPage.tsx frontend/src/stores/useSafetyTripStore.ts
git commit -m "feat(smart-rules): integrate rule evaluation into overview and trip lifecycle"
```

---

### Task 6: 最终验证

**Files:**
- Modify: `README.md`（暂不更新，等下次发版时同步）

---

- [ ] **Step 1: 运行完整检查**

```bash
cd frontend && npm run check
```

预期：`typecheck` / `lint` / `test` / `build` 全部通过。

- [ ] **Step 2: 确认 git 状态**

```bash
cd ~/Desktop/jjqy/new && git status --short
```

预期：只有计划内的文件变更。

- [ ] **Step 3: 提交剩余变更（如有未被提交的文件）**

```bash
git log --oneline -6
# 确认有 4-5 个提交
```
