# v0.4.29 本地安全行程 / 守护倒计时 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为独行、晚归、打车、夜跑等短时场景增加一个本地安全行程倒计时，让用户手动确认"已安全到达"，并在未确认时只产生本地风险提示。

**Architecture:** 纯本地能力。domain 层新增 `safetyTrip.ts` 行程状态机和派生函数；data 层新增 `safetyTripRepo.ts` 本地持久化；stores 层新增 `useSafetyTripStore.ts` 编排状态与副作用；`riskAssessment.ts` 扩展输入以纳入安全行程风险；OverviewPage 接入创建/倒计时/确认 UI；diagnostics 扩展脱敏摘要。

**Tech Stack:** React 19 + TypeScript + MUI 6 + Zustand 5 + Vitest + Capacitor 6 (Android)。

**Spec:** `docs/superpowers/specs/2026-06-15-local-safety-trip-design.md`

---

## 文件结构

**新建：**
- `frontend/src/domain/safetyTrip.ts` — 纯函数：行程类型、状态派生、生命周期转换、诊断摘要。
- `frontend/src/data/safetyTripRepo.ts` — localStorage 持久化：当前行程 + 历史（最多 50 条）。
- `frontend/src/stores/useSafetyTripStore.ts` — Zustand store：加载/创建/确认/延长/取消，调度持久化。
- `frontend/src/test/safetyTrip.test.ts` — domain 纯函数测试。
- `frontend/src/test/safetyTripRepo.test.ts` — repo 持久化测试。

**修改：**
- `frontend/src/domain/riskAssessment.ts` — `RiskDataInput` 新增 `safetyTrip?` 字段，`aggregateRiskData` 纳入安全行程风险。
- `frontend/src/data/diagnostics.ts` — `DiagnosticReport` 新增 `safetyTrip` 字段，`exportDiagnosticReport` 加载行程数据并输出脱敏摘要。
- `frontend/src/data/diagnosticSummary.ts` — 摘要纳入安全行程。
- `frontend/src/pages/OverviewPage.tsx` — 新增安全行程卡片。
- `frontend/src/test/riskAssessment.test.ts` — 安全行程风险测试。
- `frontend/src/test/overviewPage.test.tsx` — 安全行程 UI 测试。
- `frontend/src/test/diagnostics.test.ts` — 安全行程诊断摘要测试。
- `frontend/src/test/diagnosticSummary.test.ts` — 摘要解析测试。
- `frontend/package.json` — 版本 `0.4.28` → `0.4.29`。
- `frontend/package-lock.json` — 顶层版本元数据。
- `README.md` — 事实表、能力清单、回归基线。

---

## Task 1: SafetyTrip domain 纯函数

**Files:**
- Create: `frontend/src/domain/safetyTrip.ts`
- Test: `frontend/src/test/safetyTrip.test.ts`

- [ ] **Step 1: Write failing tests for createSafetyTrip and deriveSafetyTripStatus**

Create `frontend/src/test/safetyTrip.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import {
  createSafetyTrip,
  deriveSafetyTripStatus,
  extendSafetyTrip,
  markSafetyTripArrived,
  cancelSafetyTrip,
  summarizeSafetyTripForDiagnostics,
} from '../domain/safetyTrip'
import type { SafetyTrip } from '../domain/safetyTrip'

const NOW = new Date('2026-06-15T12:00:00.000Z').getTime()

describe('createSafetyTrip', () => {
  it('creates an active trip with expected fields', () => {
    const trip = createSafetyTrip({ destination: '回宿舍', note: '从地铁站走回', durationMinutes: 30 }, { id: 't1', now: NOW })
    expect(trip.id).toBe('t1')
    expect(trip.destination).toBe('回宿舍')
    expect(trip.note).toBe('从地铁站走回')
    expect(trip.createdAt).toBe('2026-06-15T12:00:00.000Z')
    expect(trip.expectedArrivalAt).toBe('2026-06-15T12:30:00.000Z')
    expect(trip.status).toBe('active')
    expect(trip.events[0]!.type).toBe('created')
  })

  it('strips whitespace from destination', () => {
    const trip = createSafetyTrip({ destination: '  回宿舍  ', note: undefined, durationMinutes: 15 }, { id: 't1', now: NOW })
    expect(trip.destination).toBe('回宿舍')
    expect(trip.note).toBeUndefined()
  })
})

describe('deriveSafetyTripStatus', () => {
  const baseTrip: SafetyTrip = {
    id: 't1',
    destination: '回宿舍',
    createdAt: '2026-06-15T12:00:00.000Z',
    expectedArrivalAt: '2026-06-15T12:30:00.000Z',
    status: 'active',
    events: [],
  }

  it('returns active when now is before expectedArrival', () => {
    expect(deriveSafetyTripStatus(baseTrip, NOW + 10 * 60_000)).toBe('active')
  })

  it('returns overdue when now is after expectedArrival and trip is active', () => {
    expect(deriveSafetyTripStatus(baseTrip, NOW + 31 * 60_000)).toBe('overdue')
  })

  it('returns arrived when status is already arrived regardless of time', () => {
    expect(deriveSafetyTripStatus({ ...baseTrip, status: 'arrived' }, NOW + 99 * 60_000)).toBe('arrived')
  })

  it('returns cancelled when status is already cancelled', () => {
    expect(deriveSafetyTripStatus({ ...baseTrip, status: 'cancelled' }, NOW + 99 * 60_000)).toBe('cancelled')
  })
})

describe('extendSafetyTrip', () => {
  it('pushes expectedArrival forward by given minutes and adds extend event', () => {
    const trip: SafetyTrip = {
      id: 't1',
      destination: '回宿舍',
      createdAt: '2026-06-15T12:00:00.000Z',
      expectedArrivalAt: '2026-06-15T12:30:00.000Z',
      status: 'active',
      events: [],
    }
    const extended = extendSafetyTrip(trip, 10, { id: 'e1', now: NOW + 20 * 60_000 })
    expect(extended.expectedArrivalAt).toBe('2026-06-15T12:40:00.000Z')
    expect(extended.events.some((e) => e.type === 'extended')).toBe(true)
  })
})

describe('markSafetyTripArrived', () => {
  it('sets status to arrived and adds arrived event', () => {
    const trip: SafetyTrip = {
      id: 't1',
      destination: '回宿舍',
      createdAt: '2026-06-15T12:00:00.000Z',
      expectedArrivalAt: '2026-06-15T12:30:00.000Z',
      status: 'active',
      events: [],
    }
    const arrived = markSafetyTripArrived(trip, { id: 'e1', now: NOW + 25 * 60_000 })
    expect(arrived.status).toBe('arrived')
    expect(arrived.events.some((e) => e.type === 'arrived')).toBe(true)
  })
})

describe('cancelSafetyTrip', () => {
  it('sets status to cancelled and adds cancelled event', () => {
    const trip: SafetyTrip = {
      id: 't1',
      destination: '回宿舍',
      createdAt: '2026-06-15T12:00:00.000Z',
      expectedArrivalAt: '2026-06-15T12:30:00.000Z',
      status: 'active',
      events: [],
    }
    const cancelled = cancelSafetyTrip(trip, { id: 'e1', now: NOW + 5 * 60_000 })
    expect(cancelled.status).toBe('cancelled')
    expect(cancelled.events.some((e) => e.type === 'cancelled')).toBe(true)
  })
})

describe('summarizeSafetyTripForDiagnostics', () => {
  it('returns redacted summary without destination text or note', () => {
    const trip: SafetyTrip = {
      id: 't1',
      destination: '回宿舍',
      note: '从地铁站走回',
      createdAt: '2026-06-15T12:00:00.000Z',
      expectedArrivalAt: '2026-06-15T12:30:00.000Z',
      status: 'active',
      events: [],
    }
    const summary = summarizeSafetyTripForDiagnostics(trip)
    const text = JSON.stringify(summary)
    expect(text).not.toContain('回宿舍')
    expect(text).not.toContain('从地铁站走回')
    expect(summary.destinationLength).toBe(3)
    expect(summary.derivedStatus).toBe('active')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && npx vitest run src/test/safetyTrip.test.ts`
Expected: FAIL — module not found `../domain/safetyTrip`

- [ ] **Step 3: Implement safetyTrip.ts**

Create `frontend/src/domain/safetyTrip.ts`:

```ts
export type SafetyTripStatus = 'active' | 'overdue' | 'arrived' | 'cancelled'

export type SafetyTripEventType = 'created' | 'extended' | 'arrived' | 'cancelled' | 'overdue_seen'

export interface SafetyTripEvent {
  id: string
  type: SafetyTripEventType
  timestamp: string
  detail?: string
}

export interface SafetyTrip {
  id: string
  destination: string
  note?: string
  createdAt: string
  expectedArrivalAt: string
  status: SafetyTripStatus
  events: SafetyTripEvent[]
}

export interface TripContext {
  id: string
  now: number
}

export interface CreateSafetyTripInput {
  destination: string
  note?: string
  durationMinutes: number
}

function toIso(ts: number): string {
  return new Date(ts).toISOString()
}

function appendEvent(events: SafetyTripEvent[], ctx: TripContext, type: SafetyTripEventType, detail?: string): SafetyTripEvent[] {
  return [...events, { id: ctx.id, type, timestamp: toIso(ctx.now), detail }]
}

export function createSafetyTrip(input: CreateSafetyTripInput, ctx: TripContext): SafetyTrip {
  const destination = input.destination.trim()
  const note = input.note?.trim() || undefined
  const expectedArrivalAt = toIso(ctx.now + input.durationMinutes * 60_000)
  return {
    id: ctx.id,
    destination,
    note,
    createdAt: toIso(ctx.now),
    expectedArrivalAt,
    status: 'active',
    events: appendEvent([], ctx, 'created'),
  }
}

export function deriveSafetyTripStatus(trip: SafetyTrip, now: number): SafetyTripStatus {
  if (trip.status === 'arrived') return 'arrived'
  if (trip.status === 'cancelled') return 'cancelled'
  return now >= new Date(trip.expectedArrivalAt).getTime() ? 'overdue' : 'active'
}

export function extendSafetyTrip(trip: SafetyTrip, minutes: number, ctx: TripContext): SafetyTrip {
  const currentExpected = new Date(trip.expectedArrivalAt).getTime()
  const newExpected = Math.max(currentExpected, ctx.now) + minutes * 60_000
  return {
    ...trip,
    expectedArrivalAt: toIso(newExpected),
    events: appendEvent(trip.events, ctx, 'extended', `+${minutes}min`),
  }
}

export function markSafetyTripArrived(trip: SafetyTrip, ctx: TripContext): SafetyTrip {
  return {
    ...trip,
    status: 'arrived',
    events: appendEvent(trip.events, ctx, 'arrived'),
  }
}

export function cancelSafetyTrip(trip: SafetyTrip, ctx: TripContext): SafetyTrip {
  return {
    ...trip,
    status: 'cancelled',
    events: appendEvent(trip.events, ctx, 'cancelled'),
  }
}

export interface SafetyTripDiagnosticSummary {
  destinationLength: number
  hasNote: boolean
  derivedStatus: SafetyTripStatus
  createdAt: string
  expectedArrivalAt: string
}

export function summarizeSafetyTripForDiagnostics(trip: SafetyTrip, now: number = Date.now()): SafetyTripDiagnosticSummary {
  return {
    destinationLength: trip.destination.length,
    hasNote: !!trip.note,
    derivedStatus: deriveSafetyTripStatus(trip, now),
    createdAt: trip.createdAt,
    expectedArrivalAt: trip.expectedArrivalAt,
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && npx vitest run src/test/safetyTrip.test.ts`
Expected: PASS — all tests green

- [ ] **Step 5: Commit**

```bash
git add frontend/src/domain/safetyTrip.ts frontend/src/test/safetyTrip.test.ts
git commit -m "feat(domain): add safety trip state machine"
```

---

## Task 2: SafetyTrip 持久化 repo

**Files:**
- Create: `frontend/src/data/safetyTripRepo.ts`
- Test: `frontend/src/test/safetyTripRepo.test.ts`

- [ ] **Step 1: Write failing repo tests**

Create `frontend/src/test/safetyTripRepo.test.ts`:

```ts
import { beforeEach, describe, expect, it } from 'vitest'
import { loadCurrentSafetyTrip, saveCurrentSafetyTrip, loadSafetyTripHistory, appendSafetyTripHistory } from '../data/safetyTripRepo'
import type { SafetyTrip } from '../domain/safetyTrip'

const sampleTrip = (overrides: Partial<SafetyTrip> = {}): SafetyTrip => ({
  id: 't1',
  destination: '回宿舍',
  createdAt: '2026-06-15T12:00:00.000Z',
  expectedArrivalAt: '2026-06-15T12:30:00.000Z',
  status: 'arrived',
  events: [{ id: 'e1', type: 'created', timestamp: '2026-06-15T12:00:00.000Z' }],
  ...overrides,
})

beforeEach(() => {
  localStorage.clear()
})

describe('loadCurrentSafetyTrip', () => {
  it('returns null when nothing saved', async () => {
    expect(await loadCurrentSafetyTrip()).toBeNull()
  })

  it('returns saved trip', async () => {
    await saveCurrentSafetyTrip(sampleTrip())
    const loaded = await loadCurrentSafetyTrip()
    expect(loaded?.id).toBe('t1')
    expect(loaded?.destination).toBe('回宿舍')
  })

  it('returns null for corrupted data', async () => {
    localStorage.setItem('safety_v2_current_trip', '{bad json')
    expect(await loadCurrentSafetyTrip()).toBeNull()
  })
})

describe('saveCurrentSafetyTrip', () => {
  it('persists trip to localStorage', async () => {
    await saveCurrentSafetyTrip(sampleTrip())
    const raw = localStorage.getItem('safety_v2_current_trip')
    expect(raw).not.toBeNull()
    expect(JSON.parse(raw!).id).toBe('t1')
  })

  it('clears current trip when given null', async () => {
    await saveCurrentSafetyTrip(sampleTrip())
    await saveCurrentSafetyTrip(null)
    expect(await loadCurrentSafetyTrip()).toBeNull()
  })
})

describe('loadSafetyTripHistory', () => {
  it('returns empty array when nothing saved', async () => {
    expect(await loadSafetyTripHistory()).toEqual([])
  })

  it('returns corrupted as empty', async () => {
    localStorage.setItem('safety_v2_trip_history', 'not json')
    expect(await loadSafetyTripHistory()).toEqual([])
  })
})

describe('appendSafetyTripHistory', () => {
  it('appends trip to history', async () => {
    await appendSafetyTripHistory(sampleTrip({ id: 't1' }))
    await appendSafetyTripHistory(sampleTrip({ id: 't2' }))
    const history = await loadSafetyTripHistory()
    expect(history).toHaveLength(2)
  })

  it('caps history at 50 entries', async () => {
    for (let i = 0; i < 55; i++) {
      await appendSafetyTripHistory(sampleTrip({ id: `t${i}` }))
    }
    const history = await loadSafetyTripHistory()
    expect(history).toHaveLength(50)
    expect(history[0]!.id).toBe('t5')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && npx vitest run src/test/safetyTripRepo.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement safetyTripRepo.ts**

Create `frontend/src/data/safetyTripRepo.ts`:

```ts
import { storage } from './storage'
import type { SafetyTrip } from '../domain/safetyTrip'

export const CURRENT_TRIP_KEY = 'safety_v2_current_trip'
export const TRIP_HISTORY_KEY = 'safety_v2_trip_history'
export const MAX_TRIP_HISTORY = 50

export async function loadCurrentSafetyTrip(): Promise<SafetyTrip | null> {
  return storage.getJson<SafetyTrip>(CURRENT_TRIP_KEY)
}

export async function saveCurrentSafetyTrip(trip: SafetyTrip | null): Promise<void> {
  if (trip === null) {
    await storage.remove(CURRENT_TRIP_KEY)
    return
  }
  await storage.setJson(CURRENT_TRIP_KEY, trip)
}

export async function loadSafetyTripHistory(): Promise<SafetyTrip[]> {
  const data = await storage.getJson<SafetyTrip[]>(TRIP_HISTORY_KEY)
  return Array.isArray(data) ? data : []
}

export async function appendSafetyTripHistory(trip: SafetyTrip): Promise<void> {
  const current = await loadSafetyTripHistory()
  const next = [...current, trip]
  const trimmed = next.length > MAX_TRIP_HISTORY ? next.slice(next.length - MAX_TRIP_HISTORY) : next
  await storage.setJson(TRIP_HISTORY_KEY, trimmed)
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && npx vitest run src/test/safetyTripRepo.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/data/safetyTripRepo.ts frontend/src/test/safetyTripRepo.test.ts
git commit -m "feat(data): add safety trip persistence repo"
```

---

## Task 3: SafetyTrip Zustand store

**Files:**
- Create: `frontend/src/stores/useSafetyTripStore.ts`

- [ ] **Step 1: Implement store**

Create `frontend/src/stores/useSafetyTripStore.ts`:

```ts
import { create } from 'zustand'
import {
  createSafetyTrip,
  extendSafetyTrip,
  markSafetyTripArrived,
  cancelSafetyTrip,
  deriveSafetyTripStatus,
} from '../domain/safetyTrip'
import type { SafetyTrip, SafetyTripStatus, CreateSafetyTripInput } from '../domain/safetyTrip'
import {
  loadCurrentSafetyTrip,
  saveCurrentSafetyTrip,
  loadSafetyTripHistory,
  appendSafetyTripHistory,
} from '../data/safetyTripRepo'

export type { SafetyTrip, SafetyTripStatus }

function genId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return `t_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

interface SafetyTripState {
  current: SafetyTrip | null
  history: SafetyTrip[]
  loaded: boolean

  initialize: () => Promise<void>
  createTrip: (input: CreateSafetyTripInput) => Promise<void>
  arrive: () => Promise<void>
  extend: (minutes: number) => Promise<void>
  cancel: () => Promise<void>
  currentStatus: (now: number) => SafetyTripStatus | null
}

export const useSafetyTripStore = create<SafetyTripState>((set, get) => ({
  current: null,
  history: [],
  loaded: false,

  initialize: async () => {
    const [current, history] = await Promise.all([loadCurrentSafetyTrip(), loadSafetyTripHistory()])
    set({ current, history, loaded: true })
  },

  createTrip: async (input) => {
    if (get().current) return
    const now = Date.now()
    const trip = createSafetyTrip(input, { id: genId(), now })
    await saveCurrentSafetyTrip(trip)
    set({ current: trip })
  },

  arrive: async () => {
    const trip = get().current
    if (!trip) return
    const now = Date.now()
    const arrived = markSafetyTripArrived(trip, { id: genId(), now })
    await appendSafetyTripHistory(arrived)
    await saveCurrentSafetyTrip(null)
    set({ current: null, history: [...get().history, arrived] })
  },

  extend: async (minutes) => {
    const trip = get().current
    if (!trip) return
    const now = Date.now()
    const extended = extendSafetyTrip(trip, minutes, { id: genId(), now })
    await saveCurrentSafetyTrip(extended)
    set({ current: extended })
  },

  cancel: async () => {
    const trip = get().current
    if (!trip) return
    const now = Date.now()
    const cancelled = cancelSafetyTrip(trip, { id: genId(), now })
    await appendSafetyTripHistory(cancelled)
    await saveCurrentSafetyTrip(null)
    set({ current: null, history: [...get().history, cancelled] })
  },

  currentStatus: (now) => {
    const trip = get().current
    return trip ? deriveSafetyTripStatus(trip, now) : null
  },
}))
```

- [ ] **Step 2: Run typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: PASS — no errors

- [ ] **Step 3: Commit**

```bash
git add frontend/src/stores/useSafetyTripStore.ts
git commit -m "feat(store): add safety trip state management"
```

---

## Task 4: 风险评估接入安全行程

**Files:**
- Modify: `frontend/src/domain/riskAssessment.ts`
- Test: `frontend/src/test/riskAssessment.test.ts`

- [ ] **Step 1: Write failing risk tests**

Add to `frontend/src/test/riskAssessment.test.ts` (after existing `aggregateRiskData` tests, before closing `})`):

```ts
  it('flags overdue safety trip as warning', () => {
    const cfg = configured()
    const contacts: Contact[] = [{ id: '1', name: 'A', phone: '110' }]
    const pts = [pt(31, 121, now - 60_000), pt(31.001, 121.001, now)]
    const overdueTrip: SafetyTrip = {
      id: 't1',
      destination: '回宿舍',
      createdAt: '2026-06-15T12:00:00.000Z',
      expectedArrivalAt: new Date(now - 5 * 60_000).toISOString(),
      status: 'active',
      events: [],
    }
    const result = aggregateRiskData({ points: pts, sosHistory: [], config: cfg, contacts, locationAgeMs: 30_000, safetyTrip: overdueTrip })
    expect(result.items.some((i) => i.title === '安全行程超时未确认')).toBe(true)
    expect(result.level).toBe('warning')
  })

  it('does not flag active safety trip', () => {
    const cfg = configured()
    const contacts: Contact[] = [{ id: '1', name: 'A', phone: '110' }]
    const pts = [pt(31, 121, now - 60_000), pt(31.001, 121.001, now)]
    const activeTrip: SafetyTrip = {
      id: 't1',
      destination: '回宿舍',
      createdAt: '2026-06-15T12:00:00.000Z',
      expectedArrivalAt: new Date(now + 20 * 60_000).toISOString(),
      status: 'active',
      events: [],
    }
    const result = aggregateRiskData({ points: pts, sosHistory: [], config: cfg, contacts, locationAgeMs: 30_000, safetyTrip: activeTrip })
    expect(result.items.some((i) => i.title === '安全行程超时未确认')).toBe(false)
  })

  it('does not flag null safety trip', () => {
    const cfg = configured()
    const contacts: Contact[] = [{ id: '1', name: 'A', phone: '110' }]
    const pts = [pt(31, 121, now - 60_000), pt(31.001, 121.001, now)]
    const result = aggregateRiskData({ points: pts, sosHistory: [], config: cfg, contacts, locationAgeMs: 30_000, safetyTrip: null })
    expect(result.items.some((i) => i.title === '安全行程超时未确认')).toBe(false)
  })
```

Add import at top of file (after existing imports):

```ts
import type { SafetyTrip } from '../domain/safetyTrip'
import { deriveSafetyTripStatus } from '../domain/safetyTrip'
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && npx vitest run src/test/riskAssessment.test.ts`
Expected: FAIL — `safetyTrip` property not accepted on `RiskDataInput`

- [ ] **Step 3: Implement risk integration**

Modify `frontend/src/domain/riskAssessment.ts`:

Add import after existing imports (line 5 area):

```ts
import type { SafetyTrip } from './safetyTrip'
import { deriveSafetyTripStatus } from './safetyTrip'
```

Add field to `RiskDataInput` interface (after `riskRules?: RiskRuleConfig`):

```ts
  safetyTrip?: SafetyTrip | null
```

In `aggregateRiskData`, after geofence block (before `const level = ...`), add:

```ts
  if (input.safetyTrip) {
    const tripStatus = deriveSafetyTripStatus(input.safetyTrip, Date.now())
    if (tripStatus === 'overdue') {
      const overdueMs = Date.now() - new Date(input.safetyTrip.expectedArrivalAt).getTime()
      const overdueMinutes = Math.round(overdueMs / 60_000)
      items.push({
        title: '安全行程超时未确认',
        detail: `${input.safetyTrip.destination} · 超时约 ${overdueMinutes} 分钟`,
        severity: 'warning',
        rule: 'safetyTrip',
      })
    }
  }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && npx vitest run src/test/riskAssessment.test.ts`
Expected: PASS — all tests green

- [ ] **Step 5: Commit**

```bash
git add frontend/src/domain/riskAssessment.ts frontend/src/test/riskAssessment.test.ts
git commit -m "feat(domain): integrate safety trip risk into aggregate"
```

---

## Task 5: OverviewPage 安全行程卡片

**Files:**
- Modify: `frontend/src/pages/OverviewPage.tsx`
- Test: `frontend/src/test/overviewPage.test.tsx`

- [ ] **Step 1: Write failing overview UI tests**

Add to `frontend/src/test/overviewPage.test.tsx`:

```ts
import { beforeEach } from 'vitest'
import { fireEvent, screen, within } from '@testing-library/react'
import { useSafetyTripStore } from '../stores/useSafetyTripStore'
import type { SafetyTrip } from '../domain/safetyTrip'

beforeEach(() => {
  localStorage.clear()
  useSafetyTripStore.setState({ current: null, history: [], loaded: true })
})

describe('OverviewPage safety trip card', () => {
  it('shows create trip button when no current trip', () => {
    render(<OverviewPage />)
    expect(screen.getByText('安全行程')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '创建安全行程' })).toBeInTheDocument()
  })

  it('shows countdown when trip is active', () => {
    const trip: SafetyTrip = {
      id: 't1',
      destination: '回宿舍',
      createdAt: new Date(Date.now() - 5 * 60_000).toISOString(),
      expectedArrivalAt: new Date(Date.now() + 25 * 60_000).toISOString(),
      status: 'active',
      events: [],
    }
    useSafetyTripStore.setState({ current: trip })
    render(<OverviewPage />)
    expect(screen.getByText('回宿舍')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '已到达' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '延长 10 分钟' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '取消' })).toBeInTheDocument()
  })

  it('shows overdue warning text when trip is overdue', () => {
    const trip: SafetyTrip = {
      id: 't1',
      destination: '回宿舍',
      createdAt: new Date(Date.now() - 40 * 60_000).toISOString(),
      expectedArrivalAt: new Date(Date.now() - 10 * 60_000).toISOString(),
      status: 'active',
      events: [],
    }
    useSafetyTripStore.setState({ current: trip })
    render(<OverviewPage />)
    expect(screen.getByText(/超时未确认/)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && npx vitest run src/test/overviewPage.test.tsx`
Expected: FAIL — `安全行程` text not found

- [ ] **Step 3: Implement overview card**

Modify `frontend/src/pages/OverviewPage.tsx`:

Add imports at top (after existing imports):

```ts
import { useSafetyTripStore } from '../stores/useSafetyTripStore'
import { deriveSafetyTripStatus } from '../domain/safetyTrip'
import { Button, Dialog, DialogTitle, DialogContent, DialogActions, TextField, MenuItem } from '@mui/material'
```

Inside `OverviewPage` component (after `riskRules` state, before `useEffect`):

```ts
  const tripCurrent = useSafetyTripStore((s) => s.current)
  const tripCreate = useSafetyTripStore((s) => s.createTrip)
  const tripArrive = useSafetyTripStore((s) => s.arrive)
  const tripExtend = useSafetyTripStore((s) => s.extend)
  const tripCancel = useSafetyTripStore((s) => s.cancel)
  const [tripDialogOpen, setTripDialogOpen] = useState(false)
  const [tripDest, setTripDest] = useState('')
  const [tripMinutes, setTripMinutes] = useState(30)
  const [tripNote, setTripNote] = useState('')
```

Add `safetyTrip: tripCurrent ?? undefined` to the `aggregateRiskData` call input object, and add `tripCurrent` to the `useMemo` dependency array.

Add safety trip card JSX (insert before the risk card `<Card>`, after the stat grid `</Box>`):

```tsx
      <Card variant="outlined" sx={{ borderRadius: 3 }}>
        <CardContent>
          <Stack spacing={1}>
            <Typography variant="overline">安全行程</Typography>
            <Typography variant="caption" color="text.secondary">
              安全行程只在本机记录和提醒，不会自动通知联系人。
            </Typography>
            {tripCurrent ? (
              (() => {
                const tripStatus = deriveSafetyTripStatus(tripCurrent, Date.now())
                return (
                  <Stack spacing={1}>
                    <Typography variant="h6">{tripCurrent.destination}</Typography>
                    <Typography variant="body2" color={tripStatus === 'overdue' ? 'error' : 'text.secondary'}>
                      {tripStatus === 'overdue'
                        ? '超时未确认。请手动确认状态；当前版本不会自动发送 SOS。'
                        : `预计到达：${new Date(tripCurrent.expectedArrivalAt).toLocaleTimeString('zh-CN')}`}
                    </Typography>
                    {tripCurrent.note && (
                      <Typography variant="caption" color="text.secondary">{tripCurrent.note}</Typography>
                    )}
                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                      <Button size="small" variant="contained" color="success" onClick={() => tripArrive()}>已到达</Button>
                      <Button size="small" variant="outlined" onClick={() => tripExtend(10)}>延长 10 分钟</Button>
                      <Button size="small" variant="outlined" color="error" onClick={() => tripCancel()}>取消</Button>
                    </Box>
                  </Stack>
                )
              })()
            ) : (
              <Button variant="outlined" size="small" onClick={() => setTripDialogOpen(true)}>创建安全行程</Button>
            )}
          </Stack>
        </CardContent>
      </Card>
```

Add create dialog at the end of the `<Stack>` (before closing `</Stack>`):

```tsx
      <Dialog open={tripDialogOpen} onClose={() => setTripDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>创建安全行程</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField label="目的地名称" value={tripDest} onChange={(e) => setTripDest(e.target.value)} size="small" fullWidth />
            <TextField select label="预计时长（分钟）" value={tripMinutes} onChange={(e) => setTripMinutes(Number(e.target.value))} size="small" fullWidth>
              <MenuItem value={15}>15</MenuItem>
              <MenuItem value={30}>30</MenuItem>
              <MenuItem value={45}>45</MenuItem>
              <MenuItem value={60}>60</MenuItem>
            </TextField>
            <TextField label="备注（可选）" value={tripNote} onChange={(e) => setTripNote(e.target.value)} size="small" fullWidth multiline maxRows={2} />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTripDialogOpen(false)}>取消</Button>
          <Button
            variant="contained"
            disabled={!tripDest.trim() || tripMinutes < 5 || tripMinutes > 240}
            onClick={async () => {
              await tripCreate({ destination: tripDest.trim(), durationMinutes: tripMinutes, note: tripNote.trim() || undefined })
              setTripDest('')
              setTripMinutes(30)
              setTripNote('')
              setTripDialogOpen(false)
            }}
          >创建</Button>
        </DialogActions>
      </Dialog>
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && npx vitest run src/test/overviewPage.test.tsx`
Expected: PASS — all tests green

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/OverviewPage.tsx frontend/src/test/overviewPage.test.tsx
git commit -m "feat(ui): add safety trip card to overview page"
```

---

## Task 6: 诊断报告接入安全行程

**Files:**
- Modify: `frontend/src/data/diagnostics.ts`
- Modify: `frontend/src/data/diagnosticSummary.ts`
- Test: `frontend/src/test/diagnostics.test.ts`

- [ ] **Step 1: Write failing diagnostics test**

Add to `frontend/src/test/diagnostics.test.ts` (before final `})`):

```ts
  it('includes redacted safety trip summary without destination text', async () => {
    const trip: SafetyTrip = {
      id: 't1',
      destination: '回宿舍',
      note: '从地铁站走回',
      createdAt: new Date(Date.now() - 5 * 60_000).toISOString(),
      expectedArrivalAt: new Date(Date.now() + 25 * 60_000).toISOString(),
      status: 'active',
      events: [],
    }
    await saveCurrentSafetyTrip(trip)
    const report = await exportDiagnosticReport(new Date('2026-06-11T01:02:03.000Z'))
    const text = JSON.stringify(report)
    expect(text).not.toContain('回宿舍')
    expect(text).not.toContain('从地铁站走回')
    expect(report.safetyTrip.hasCurrentTrip).toBe(true)
    expect(report.safetyTrip.destinationLength).toBe(3)
  })
```

Add imports at top of test file:

```ts
import { saveCurrentSafetyTrip } from '../data/safetyTripRepo'
import type { SafetyTrip } from '../domain/safetyTrip'
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && npx vitest run src/test/diagnostics.test.ts`
Expected: FAIL — `report.safetyTrip` is undefined

- [ ] **Step 3: Implement diagnostics integration**

Modify `frontend/src/data/diagnostics.ts`:

Add imports:

```ts
import { loadCurrentSafetyTrip, loadSafetyTripHistory } from './safetyTripRepo'
import { summarizeSafetyTripForDiagnostics, deriveSafetyTripStatus } from '../domain/safetyTrip'
import type { SafetyTripDiagnosticSummary } from '../domain/safetyTrip'
```

Add interface (after `DiagnosticLocationStatus`):

```ts
export interface DiagnosticSafetyTripStatus {
  hasCurrentTrip: boolean
  currentStatus: string | null
  destinationLength: number
  hasNote: boolean
  historyCount: number
  lastTripStatus: string | null
}
```

Add `safetyTrip: DiagnosticSafetyTripStatus` to `DiagnosticReport` interface.

In `exportDiagnosticReport`, add to `Promise.all`:

```ts
    loadCurrentSafetyTrip(),
    loadSafetyTripHistory(),
```

Add to return object (before `privacy`):

```ts
    safetyTrip: {
      hasCurrentTrip: !!currentTrip,
      currentStatus: currentTrip ? deriveSafetyTripStatus(currentTrip, now.getTime()) : null,
      destinationLength: currentTrip?.destination.length ?? 0,
      hasNote: !!currentTrip?.note,
      historyCount: tripHistory.length,
      lastTripStatus: tripHistory.length > 0 ? tripHistory[tripHistory.length - 1]!.status : null,
    },
```

Rename destructured `Promise.all` result to include `currentTrip` and `tripHistory`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && npx vitest run src/test/diagnostics.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/data/diagnostics.ts frontend/src/test/diagnostics.test.ts
git commit -m "feat(data): add redacted safety trip to diagnostics"
```

---

## Task 7: 版本号、README、发布闸口

**Files:**
- Modify: `frontend/package.json`
- Modify: `frontend/package-lock.json`
- Modify: `README.md`

- [ ] **Step 1: Bump version**

Run: `cd frontend && npm version patch --no-git-tag-version`
Expected: `0.4.29`

- [ ] **Step 2: Update README fact table and capabilities**

In `README.md`:
- Change version references from `0.4.28` to `0.4.29`.
- Add safety trip line to section 4.1 capabilities list.
- Add safety trip to regression baseline in section P0.5.

- [ ] **Step 3: Run full check**

Run: `cd frontend && npm run check`
Expected: TypeScript, ESLint, Vitest all pass.

- [ ] **Step 4: Run release gate**

Run: `cd frontend && npm run check:full && npm run android:release`
Expected: debug APK, release APK, release AAB built successfully.

- [ ] **Step 5: Verify artifacts exist**

Verify:
- `frontend/android/app/build/outputs/apk/debug/solo-youth-safety-v0.4.29-debug.apk`
- `frontend/android/app/build/outputs/apk/release/solo-youth-safety-v0.4.29-release.apk`
- `frontend/android/app/build/outputs/bundle/release/solo-youth-safety-v0.4.29-release.aab`

- [ ] **Step 6: Commit and tag**

```bash
git add frontend/package.json frontend/package-lock.json README.md
git commit -m "feat: publish v0.4.29 local safety trip"
git tag -a v0.4.29 -m 'v0.4.29 local safety trip trial build'
```

- [ ] **Step 7: Push**

```bash
git push origin main
git push origin v0.4.29
```
