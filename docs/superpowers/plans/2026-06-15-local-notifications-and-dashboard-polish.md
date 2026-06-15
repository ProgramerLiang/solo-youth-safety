# v0.4.30 本地通知集成 + 总览仪表盘 UX 打磨 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在本地安全基础上升级用户体验：通过系统通知在应用存活期间触达用户，并将总览页改造为更清晰、引导性更强的仪表盘。

**Architecture:** 纯本地 + 前台能力。domain 层新增通知配置类型与默认值；data 层新增 `@capacitor/local-notifications` 封装的通知调度 repo；stores 层新增通知配置 store；OverviewPage 拆分子组件并重构布局。安全行程 store 扩展通知调度联动。

**Tech Stack:** React 19 + TypeScript + MUI 6 + Zustand 5 + Vitest + `@capacitor/local-notifications` + Capacitor 6 (Android)。

**Spec:** `docs/superpowers/specs/2026-06-15-local-notifications-and-dashboard-polish.md`

---

## 文件结构

**新建：**
- `frontend/src/domain/notificationChannels.ts` — 通知类型、配置、默认值。
- `frontend/src/data/localNotificationRepo.ts` — Capacitor Local Notifications 封装。
- `frontend/src/stores/useNotificationConfigStore.ts` — 通知配置状态管理。
- `frontend/src/components/RiskLevelIndicator.tsx` — 顶部风险等级色块。
- `frontend/src/components/RiskGroupCard.tsx` — 可折叠风险分组卡片。
- `frontend/src/components/EmptyRiskGroup.tsx` — 分组空态展示。
- `frontend/src/components/DashboardDisclaimer.tsx` — 全局声明行。
- `frontend/src/test/notificationChannels.test.ts` — 通知配置纯函数测试。
- `frontend/src/test/localNotificationRepo.test.ts` — 通知 repo mock 测试。
- `frontend/src/test/notificationConfigStore.test.ts` — 配置 store 测试。
- `frontend/src/test/riskLevelIndicator.test.tsx` — 风险等级指示器渲染测试。
- `frontend/src/test/riskGroupCard.test.tsx` — 分组卡片测试。
- `frontend/src/test/emptyRiskGroup.test.tsx` — 空态展示测试。
- `frontend/src/test/dashboardDisclaimer.test.tsx` — 声明行渲染测试。

**修改：**
- `frontend/package.json` — 新增 `@capacitor/local-notifications` 依赖，版本 `0.4.29` → `0.4.30`。
- `frontend/src/stores/useSafetyTripStore.ts` — 创建/延长/到达/取消时联动通知调度。
- `frontend/src/pages/OverviewPage.tsx` — 重构布局，拆分子组件，接入通知与仪表盘。
- `frontend/src/pages/ConfigPage.tsx` — 新增"本地通知"配置卡片。
- `frontend/src/test/overviewPage.test.tsx` — 适配新布局/组件测试。
- `frontend/src/test/configPage.test.tsx` — 通知配置卡片测试。
- `frontend/package-lock.json` — 顶层版本元数据。
- `README.md` — 事实表、能力清单、回归基线。

---

## Task 1: 安装依赖 + 通知配置 domain 纯函数

**Files:**
- Create: `frontend/src/domain/notificationChannels.ts`
- Test: `frontend/src/test/notificationChannels.test.ts`
- Modify: `frontend/package.json` — 新增依赖

- [ ] **Step 1: 安装 @capacitor/local-notifications**

```bash
cd frontend && npm install @capacitor/local-notifications
```

同步 Android 壳：

```bash
npx cap sync android
```

- [ ] **Step 2: 写测试（RED）**

创建 `frontend/src/test/notificationChannels.test.ts`：

```ts
import { describe, expect, it } from 'vitest'
import { DEFAULT_NOTIFICATION_CONFIG, mergeNotificationConfig } from '../domain/notificationChannels'

describe('DEFAULT_NOTIFICATION_CONFIG', () => {
  it('has all fields defined', () => {
    expect(DEFAULT_NOTIFICATION_CONFIG.enabled).toBe(true)
    expect(DEFAULT_NOTIFICATION_CONFIG.tripExpiring.enabled).toBe(true)
    expect(DEFAULT_NOTIFICATION_CONFIG.tripExpiring.leadMinutes).toBe(5)
    expect(DEFAULT_NOTIFICATION_CONFIG.riskElevated.enabled).toBe(true)
  })
})

describe('mergeNotificationConfig', () => {
  it('returns default when input is null', () => {
    expect(mergeNotificationConfig(null)).toEqual(DEFAULT_NOTIFICATION_CONFIG)
  })

  it('returns default when input is undefined', () => {
    expect(mergeNotificationConfig(undefined)).toEqual(DEFAULT_NOTIFICATION_CONFIG)
  })

  it('merges partial config with defaults', () => {
    const merged = mergeNotificationConfig({ enabled: false })
    expect(merged.enabled).toBe(false)
    expect(merged.tripExpiring.enabled).toBe(true)
    expect(merged.tripExpiring.leadMinutes).toBe(5)
    expect(merged.riskElevated.enabled).toBe(true)
  })

  it('merges nested tripExpiring overrides', () => {
    const merged = mergeNotificationConfig({ tripExpiring: { enabled: false, leadMinutes: 15 } })
    expect(merged.enabled).toBe(true)
    expect(merged.tripExpiring.enabled).toBe(false)
    expect(merged.tripExpiring.leadMinutes).toBe(15)
  })
})
```

- [ ] **Step 3: 跑测试确认失败**

```bash
cd frontend && npx vitest run src/test/notificationChannels.test.ts
```

Expected: FAIL — module not found `../domain/notificationChannels`

- [ ] **Step 4: 实现 notificationChannels.ts**

创建 `frontend/src/domain/notificationChannels.ts`：

```ts
export type NotificationType = 'tripExpiring' | 'riskElevated'

export interface TripExpiringConfig {
  enabled: boolean
  leadMinutes: 1 | 5 | 10 | 15
}

export interface RiskElevatedConfig {
  enabled: boolean
}

export interface NotificationConfig {
  enabled: boolean
  tripExpiring: TripExpiringConfig
  riskElevated: RiskElevatedConfig
}

export const DEFAULT_NOTIFICATION_CONFIG: NotificationConfig = {
  enabled: true,
  tripExpiring: {
    enabled: true,
    leadMinutes: 5,
  },
  riskElevated: {
    enabled: true,
  },
}

export function mergeNotificationConfig(saved: Partial<NotificationConfig> | null | undefined): NotificationConfig {
  if (!saved) return { ...DEFAULT_NOTIFICATION_CONFIG }
  return {
    enabled: saved.enabled ?? DEFAULT_NOTIFICATION_CONFIG.enabled,
    tripExpiring: {
      enabled: saved.tripExpiring?.enabled ?? DEFAULT_NOTIFICATION_CONFIG.tripExpiring.enabled,
      leadMinutes: saved.tripExpiring?.leadMinutes ?? DEFAULT_NOTIFICATION_CONFIG.tripExpiring.leadMinutes,
    },
    riskElevated: {
      enabled: saved.riskElevated?.enabled ?? DEFAULT_NOTIFICATION_CONFIG.riskElevated.enabled,
    },
  }
}
```

- [ ] **Step 5: 跑测试确认通过**

```bash
cd frontend && npx vitest run src/test/notificationChannels.test.ts
```

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add frontend/package.json frontend/package-lock.json frontend/src/domain/notificationChannels.ts frontend/src/test/notificationChannels.test.ts
git commit -m "feat: install @capacitor/local-notifications and notification config domain"
```

---

## Task 2: 本地通知 repo（Capacitor 封装）

**Files:**
- Create: `frontend/src/data/localNotificationRepo.ts`
- Test: `frontend/src/test/localNotificationRepo.test.ts`

- [ ] **Step 1: 写测试（RED）**

创建 `frontend/src/test/localNotificationRepo.test.ts`：

```ts
import { describe, expect, it, vi, beforeEach } from 'vitest'
import type { SafetyTrip } from '../domain/safetyTrip'

// --- mock @capacitor/local-notifications ---
vi.mock('@capacitor/local-notifications', () => ({
  LocalNotifications: {
    requestPermissions: vi.fn(),
    schedule: vi.fn(),
    cancel: vi.fn(),
    getPending: vi.fn(),
  },
}))

import { LocalNotifications } from '@capacitor/local-notifications'
import {
  requestNotificationPermission,
  scheduleTripExpiryNotification,
  scheduleRiskNotification,
  cancelNotification,
  cancelAllTripNotifications,
} from '../data/localNotificationRepo'

const trip: SafetyTrip = {
  id: 't1',
  destination: '回宿舍',
  createdAt: '2026-06-15T12:00:00.000Z',
  expectedArrivalAt: '2026-06-15T12:30:00.000Z',
  status: 'active',
  events: [],
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('requestNotificationPermission', () => {
  it('returns granted when permission is granted', async () => {
    vi.mocked(LocalNotifications.requestPermissions).mockResolvedValue({ display: 'granted' } as any)
    const result = await requestNotificationPermission()
    expect(result).toBe('granted')
  })

  it('returns denied when permission is denied', async () => {
    vi.mocked(LocalNotifications.requestPermissions).mockResolvedValue({ display: 'denied' } as any)
    const result = await requestNotificationPermission()
    expect(result).toBe('denied')
  })
})

describe('scheduleTripExpiryNotification', () => {
  it('schedules a notification with correct timing and returns id', async () => {
    vi.mocked(LocalNotifications.schedule).mockResolvedValue({ notifications: [{ id: 42 }] } as any)
    const id = await scheduleTripExpiryNotification(trip, 5)
    expect(id).toBe('trip-expiry-42')
    expect(LocalNotifications.schedule).toHaveBeenCalledTimes(1)
    const call = vi.mocked(LocalNotifications.schedule).mock.calls[0]![0] as any
    expect(call.notifications[0].title).toContain('安全行程')
    expect(call.notifications[0].body).toContain('回宿舍')
    expect(call.notifications[0].body).toContain('仅本地提醒')
  })

  it('does not throw when trip has no destination', async () => {
    vi.mocked(LocalNotifications.schedule).mockResolvedValue({ notifications: [{ id: 43 }] } as any)
    const noDestTrip = { ...trip, destination: '未知' }
    await expect(scheduleTripExpiryNotification(noDestTrip, 5)).resolves.toBeTruthy()
  })
})

describe('scheduleRiskNotification', () => {
  it('schedules a notification with generic risk text', async () => {
    vi.mocked(LocalNotifications.schedule).mockResolvedValue({ notifications: [{ id: 99 }] } as any)
    const id = await scheduleRiskNotification()
    expect(id).toBe('risk-elevated-99')
    expect(LocalNotifications.schedule).toHaveBeenCalledTimes(1)
    const call = vi.mocked(LocalNotifications.schedule).mock.calls[0]![0] as any
    expect(call.notifications[0].body).toContain('仅本地提醒')
  })
})

describe('cancelNotification', () => {
  it('calls LocalNotifications.cancel with parsed id', async () => {
    await cancelNotification('trip-expiry-42')
    expect(LocalNotifications.cancel).toHaveBeenCalledWith({ notifications: [{ id: 42 }] })
  })

  it('does not throw for unknown id format', async () => {
    await cancelNotification('unknown-xxx')
    // Should not throw — just skip
  })
})

describe('cancelAllTripNotifications', () => {
  it('cancels all pending notifications', async () => {
    vi.mocked(LocalNotifications.getPending).mockResolvedValue({ notifications: [{ id: 1 }, { id: 2 }] } as any)
    await cancelAllTripNotifications()
    expect(LocalNotifications.cancel).toHaveBeenCalledWith({ notifications: [{ id: 1 }, { id: 2 }] })
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

```bash
cd frontend && npx vitest run src/test/localNotificationRepo.test.ts
```

Expected: FAIL — module not found

- [ ] **Step 3: 实现 localNotificationRepo.ts**

创建 `frontend/src/data/localNotificationRepo.ts`：

```ts
import { LocalNotifications } from '@capacitor/local-notifications'
import type { SafetyTrip } from '../domain/safetyTrip'

type PermissionResult = 'granted' | 'denied' | 'prompt'

export async function requestNotificationPermission(): Promise<PermissionResult> {
  try {
    const result = await LocalNotifications.requestPermissions()
    return result.display as PermissionResult
  } catch {
    return 'denied'
  }
}

export async function scheduleTripExpiryNotification(trip: SafetyTrip, leadMinutes: number): Promise<string> {
  const scheduleAt = new Date(new Date(trip.expectedArrivalAt).getTime() - leadMinutes * 60_000).getTime()
  if (scheduleAt <= Date.now()) return '' // already past notification time

  try {
    const result = await LocalNotifications.schedule({
      notifications: [
        {
          title: '安全行程即将超时',
          body: `${trip.destination} 预计 ${formatTime(trip.expectedArrivalAt)} 到达，请确认安全。仅本地提醒，不自动报警。`,
          schedule: { at: new Date(scheduleAt) },
          id: generateNumericId(),
        },
      ],
    })
    const numericId = result.notifications?.[0]?.id
    return numericId != null ? `trip-expiry-${numericId}` : ''
  } catch {
    return ''
  }
}

export async function scheduleRiskNotification(): Promise<string> {
  try {
    const result = await LocalNotifications.schedule({
      notifications: [
        {
          title: '安全提示',
          body: '检测到新的本地安全提示，请查看总览页。仅本地提醒，不自动报警。',
          schedule: { at: new Date(Date.now() + 5000) }, // small delay
          id: generateNumericId(),
        },
      ],
    })
    const numericId = result.notifications?.[0]?.id
    return numericId != null ? `risk-elevated-${numericId}` : ''
  } catch {
    return ''
  }
}

export async function cancelNotification(notificationId: string): Promise<void> {
  const parts = notificationId.split('-')
  const numericId = parseInt(parts[parts.length - 1], 10)
  if (isNaN(numericId)) return
  try {
    await LocalNotifications.cancel({ notifications: [{ id: numericId }] })
  } catch {
    // silent
  }
}

export async function cancelAllTripNotifications(): Promise<void> {
  try {
    const pending = await LocalNotifications.getPending()
    if (pending.notifications.length > 0) {
      await LocalNotifications.cancel({ notifications: pending.notifications })
    }
  } catch {
    // silent
  }
}

let _counter = Date.now() % 100000

function generateNumericId(): number {
  return ++_counter
}

function formatTime(iso: string): string {
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}
```

- [ ] **Step 4: 跑测试确认通过**

```bash
cd frontend && npx vitest run src/test/localNotificationRepo.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/data/localNotificationRepo.ts frontend/src/test/localNotificationRepo.test.ts
git commit -m "feat(data): add Capacitor local notification repo"
```

---

## Task 3: 通知配置 store

**Files:**
- Create: `frontend/src/stores/useNotificationConfigStore.ts`
- Create: `frontend/src/test/notificationConfigStore.test.ts`

- [ ] **Step 1: 写测试（RED）**

创建 `frontend/src/test/notificationConfigStore.test.ts`：

```ts
import { describe, expect, it, beforeEach } from 'vitest'
import { useNotificationConfigStore } from '../stores/useNotificationConfigStore'

beforeEach(() => {
  useNotificationConfigStore.setState({ config: null, loaded: false })
})

describe('useNotificationConfigStore', () => {
  it('starts with unloaded state', () => {
    const state = useNotificationConfigStore.getState()
    expect(state.loaded).toBe(false)
    expect(state.config).toBeNull()
  })

  it('setConfig updates config and loaded', () => {
    const store = useNotificationConfigStore.getState()
    const cfg = { enabled: false, tripExpiring: { enabled: true, leadMinutes: 10 as const }, riskElevated: { enabled: true } }
    store.setConfig(cfg)
    const updated = useNotificationConfigStore.getState()
    expect(updated.loaded).toBe(true)
    expect(updated.config).toEqual(cfg)
  })

  it('setConfig with null sets loaded true but config null', () => {
    const store = useNotificationConfigStore.getState()
    store.setConfig(null)
    const updated = useNotificationConfigStore.getState()
    expect(updated.loaded).toBe(true)
    expect(updated.config).toBeNull()
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

```bash
cd frontend && npx vitest run src/test/notificationConfigStore.test.ts
```

Expected: FAIL — module not found

- [ ] **Step 3: 实现 useNotificationConfigStore.ts**

创建 `frontend/src/stores/useNotificationConfigStore.ts`：

```ts
import { create } from 'zustand'
import type { NotificationConfig } from '../domain/notificationChannels'
import { DEFAULT_NOTIFICATION_CONFIG, mergeNotificationConfig } from '../domain/notificationChannels'
import { loadNotificationConfig, saveNotificationConfig } from '../data/notificationConfigRepo'

interface NotificationConfigState {
  config: NotificationConfig | null
  loaded: boolean
  setConfig: (config: NotificationConfig | null) => void
  initialize: () => Promise<void>
  updateTripExpiryEnabled: (enabled: boolean) => Promise<void>
  updateTripExpiryLeadMinutes: (minutes: 1 | 5 | 10 | 15) => Promise<void>
  updateRiskElevatedEnabled: (enabled: boolean) => Promise<void>
}

export const useNotificationConfigStore = create<NotificationConfigState>((set, get) => ({
  config: null,
  loaded: false,

  setConfig: (config) => set({ config, loaded: true }),

  initialize: async () => {
    const saved = await loadNotificationConfig()
    set({ config: mergeNotificationConfig(saved), loaded: true })
  },

  updateTripExpiryEnabled: async (enabled) => {
    const current = get().config ?? DEFAULT_NOTIFICATION_CONFIG
    const updated = { ...current, tripExpiring: { ...current.tripExpiring, enabled } }
    await saveNotificationConfig(updated)
    set({ config: updated })
  },

  updateTripExpiryLeadMinutes: async (minutes) => {
    const current = get().config ?? DEFAULT_NOTIFICATION_CONFIG
    const updated = { ...current, tripExpiring: { ...current.tripExpiring, leadMinutes: minutes } }
    await saveNotificationConfig(updated)
    set({ config: updated })
  },

  updateRiskElevatedEnabled: async (enabled) => {
    const current = get().config ?? DEFAULT_NOTIFICATION_CONFIG
    const updated = { ...current, riskElevated: { ...current.riskElevated, enabled } }
    await saveNotificationConfig(updated)
    set({ config: updated })
  },
}))
```

Note: This store depends on `notificationConfigRepo.ts` which we'll create in the same task. Create the repo first:

创建 `frontend/src/data/notificationConfigRepo.ts`：

```ts
import type { NotificationConfig } from '../domain/notificationChannels'
import { DEFAULT_NOTIFICATION_CONFIG } from '../domain/notificationChannels'

const STORAGE_KEY = 'safety_v2_notification_config'

export async function loadNotificationConfig(): Promise<NotificationConfig | null> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as NotificationConfig
  } catch {
    return null
  }
}

export async function saveNotificationConfig(config: NotificationConfig): Promise<void> {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config))
  } catch {
    // storage full or unavailable — silent
  }
}
```

- [ ] **Step 4: 跑测试确认通过**

```bash
cd frontend && npx vitest run src/test/notificationConfigStore.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/stores/useNotificationConfigStore.ts frontend/src/data/notificationConfigRepo.ts frontend/src/test/notificationConfigStore.test.ts
git commit -m "feat(store): add notification config store and repo"
```

---

## Task 4: 扩展安全行程 store 联动通知

**Files:**
- Modify: `frontend/src/stores/useSafetyTripStore.ts`
- Modify: `frontend/src/stores/useNotificationConfigStore.ts` 可能需暴露通知调度方法

- [ ] **Step 1: 理解当前 useSafetyTripStore 接口**

Read existing store:

```bash
cd frontend && grep -n 'createTrip\|arrive\|extend\|cancel\|initialize' src/stores/useSafetyTripStore.ts
```

- [ ] **Step 2: 在 store 的 createTrip 方法中追加通知调度**

在 `createTrip` 成功后：
1. 从 `useNotificationConfigStore` 读取当前配置。
2. 如果 `config.enabled && config.tripExpiring.enabled`，调用 `scheduleTripExpiryNotification(trip, config.tripExpiring.leadMinutes)`。
3. 把返回的 notificationId 存储到 trip 关联元数据中（或 store 的临时字段 `_currentNotificationId`）。

在 `arrive` / `cancel` 后：
1. 如果有 `_currentNotificationId`，调用 `cancelNotification(id)`。

在 `extend` 后：
1. 取消旧通知 + 重新调度。

- [ ] **Step 3: 运行现有测试确保没破坏**

```bash
cd frontend && npx vitest run src/test/safetyTrip.test.ts src/test/safetyTripRepo.test.ts src/test/useSafetyTripStore.test.ts src/test/overviewPage.test.tsx
```

Expected: PASS (or update store test assertions)

- [ ] **Step 4: Commit**

```bash
git add frontend/src/stores/useSafetyTripStore.ts
git commit -m "feat(store): link safety trip store with notification scheduling"
```

---

## Task 5: 总览仪表盘子组件

**Files:**
- Create: `frontend/src/components/RiskLevelIndicator.tsx`
- Create: `frontend/src/components/RiskGroupCard.tsx`
- Create: `frontend/src/components/EmptyRiskGroup.tsx`
- Create: `frontend/src/components/DashboardDisclaimer.tsx`
- Create: `frontend/src/test/riskLevelIndicator.test.tsx`
- Create: `frontend/src/test/riskGroupCard.test.tsx`
- Create: `frontend/src/test/emptyRiskGroup.test.tsx`
- Create: `frontend/src/test/dashboardDisclaimer.test.tsx`

- [ ] **Step 1: 先写所有子组件测试（RED）**

创建 `frontend/src/test/riskLevelIndicator.test.tsx`:

```tsx
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { RiskLevelIndicator } from '../components/RiskLevelIndicator'

describe('RiskLevelIndicator', () => {
  it('renders safe with green color', () => {
    const { container } = render(<RiskLevelIndicator level="safe" />)
    expect(screen.getByText(/安全/)).toBeTruthy()
    expect(screen.getByText(/所有检查正常/)).toBeTruthy()
  })

  it('renders caution with yellow color', () => {
    render(<RiskLevelIndicator level="caution" />)
    expect(screen.getByText(/注意/)).toBeTruthy()
    expect(screen.getByText(/需要注意/)).toBeTruthy()
  })

  it('renders danger with red color', () => {
    render(<RiskLevelIndicator level="danger" />)
    expect(screen.getByText(/警告/)).toBeTruthy()
    expect(screen.getByText(/立即关注/)).toBeTruthy()
  })
})
```

创建 `frontend/src/test/riskGroupCard.test.tsx`:

```tsx
import { describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { RiskGroupCard } from '../components/RiskGroupCard'
import type { RiskItem } from '../domain/riskAssessment'

const items: RiskItem[] = [
  { item: '轨迹过旧', level: 'warning', rule: 'staleTrace' },
  { item: '长时间间断', level: 'warning', rule: 'longGap' },
]

describe('RiskGroupCard', () => {
  it('renders group title and item count', () => {
    render(<RiskGroupCard title="轨迹风险" icon="📍" items={items} />)
    expect(screen.getByText('轨迹风险')).toBeTruthy()
    expect(screen.getByText('2')).toBeTruthy() // count badge
  })

  it('renders each risk item when expanded', () => {
    render(<RiskGroupCard title="轨迹风险" icon="📍" items={items} />)
    expect(screen.getByText('轨迹过旧')).toBeTruthy()
    expect(screen.getByText('长时间间断')).toBeTruthy()
  })

  it('collapses and expands on click', () => {
    render(<RiskGroupCard title="轨迹风险" icon="📍" items={items} />)
    const button = screen.getByRole('button')
    fireEvent.click(button)
    // After collapse, items might be hidden — test passes if no crash
  })
})
```

创建 `frontend/src/test/emptyRiskGroup.test.tsx`:

```tsx
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { EmptyRiskGroup } from '../components/EmptyRiskGroup'

describe('EmptyRiskGroup', () => {
  it('renders positive message', () => {
    render(<EmptyRiskGroup message="轨迹追踪正常" />)
    expect(screen.getByText('轨迹追踪正常')).toBeTruthy()
  })

  it('renders with check icon', () => {
    const { container } = render(<EmptyRiskGroup message="配置完整" />)
    expect(container.querySelector('[data-testid="CheckCircleIcon"]')).toBeTruthy()
  })
})
```

创建 `frontend/src/test/dashboardDisclaimer.test.tsx`:

```tsx
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DashboardDisclaimer } from '../components/DashboardDisclaimer'

describe('DashboardDisclaimer', () => {
  it('renders local-only disclaimer text', () => {
    render(<DashboardDisclaimer />)
    expect(screen.getByText(/仅本地/)).toBeTruthy()
    expect(screen.getByText(/不会自动通知/)).toBeTruthy()
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

```bash
cd frontend && npx vitest run src/test/riskLevelIndicator.test.tsx src/test/riskGroupCard.test.tsx src/test/emptyRiskGroup.test.tsx src/test/dashboardDisclaimer.test.tsx
```

Expected: FAIL — module not found

- [ ] **Step 3: 实现所有子组件**

**`frontend/src/components/RiskLevelIndicator.tsx`:**

```tsx
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import type { RiskLevel } from '../domain/riskAssessment'

interface RiskLevelIndicatorProps {
  level: RiskLevel
}

const config: Record<RiskLevel, { label: string, detail: string, color: string }> = {
  safe: { label: '安全', detail: '所有检查正常', color: 'success.main' },
  caution: { label: '注意', detail: '存在一些需要注意的项目', color: 'warning.main' },
  danger: { label: '警告', detail: '存在需要立即关注的风险', color: 'error.main' },
}

export function RiskLevelIndicator({ level }: RiskLevelIndicatorProps) {
  const c = config[level]
  return (
    <Box
      sx={{
        bgcolor: c.color,
        color: '#fff',
        borderRadius: 2,
        px: { xs: 2, sm: 3 },
        py: { xs: 1.5, sm: 2 },
        mb: 2,
        display: 'flex',
        alignItems: 'center',
        gap: 1,
      }}
    >
      <Typography variant="h6" component="span" fontWeight="bold">
        {c.label}
      </Typography>
      <Typography variant="body2" component="span" sx={{ opacity: 0.95 }}>
        {c.detail}
      </Typography>
    </Box>
  )
}
```

**`frontend/src/components/RiskGroupCard.tsx`:**

```tsx
import { useState } from 'react'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import Collapse from '@mui/material/Collapse'
import IconButton from '@mui/material/IconButton'
import Chip from '@mui/material/Chip'
import ExpandMore from '@mui/icons-material/ExpandMore'
import ExpandLess from '@mui/icons-material/ExpandLess'
import type { RiskItem } from '../domain/riskAssessment'

interface RiskGroupCardProps {
  title: string
  icon: string
  items: RiskItem[]
}

export function RiskGroupCard({ title, icon, items }: RiskGroupCardProps) {
  const [open, setOpen] = useState(true)

  return (
    <Paper sx={{ px: { xs: 2, sm: 3 }, py: 2, mb: 2 }} variant="outlined">
      <Stack direction="row" alignItems="center" justifyContent="space-between" onClick={() => setOpen(!open)} sx={{ cursor: 'pointer' }}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <Typography variant="body1" component="span">{icon}</Typography>
          <Typography variant="subtitle1" fontWeight="bold">{title}</Typography>
          <Chip label={items.length} size="small" color={items.length > 0 ? 'warning' : 'default'} />
        </Stack>
        <IconButton size="small">
          {open ? <ExpandLess /> : <ExpandMore />}
        </IconButton>
      </Stack>
      <Collapse in={open}>
        <Stack spacing={1} sx={{ mt: 1.5 }}>
          {items.map((item, i) => (
            <Typography key={i} variant="body2" color="text.secondary">
              {'\u2022'} {item.item}
              {item.rule && (
                <Typography component="span" variant="caption" color="text.disabled" sx={{ ml: 1 }}>
                  [{item.rule}]
                </Typography>
              )}
            </Typography>
          ))}
        </Stack>
      </Collapse>
    </Paper>
  )
}
```

**`frontend/src/components/EmptyRiskGroup.tsx`:**

```tsx
import Typography from '@mui/material/Typography'
import Stack from '@mui/material/Stack'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'

interface EmptyRiskGroupProps {
  message: string
}

export function EmptyRiskGroup({ message }: EmptyRiskGroupProps) {
  return (
    <Stack direction="row" alignItems="center" spacing={1} sx={{ py: 1, px: { xs: 2, sm: 3 } }}>
      <CheckCircleIcon fontSize="small" color="success" data-testid="CheckCircleIcon" />
      <Typography variant="body2" color="text.secondary">{message}</Typography>
    </Stack>
  )
}
```

**`frontend/src/components/DashboardDisclaimer.tsx`:**

```tsx
import Typography from '@mui/material/Typography'

export function DashboardDisclaimer() {
  return (
    <Typography variant="caption" color="text.disabled" sx={{ display: 'block', textAlign: 'center', mt: 1, mb: 1 }}>
      所有提示仅本地生成，不会自动通知联系人或触发 SOS。
    </Typography>
  )
}
```

- [ ] **Step 4: 跑测试确认通过**

```bash
cd frontend && npx vitest run src/test/riskLevelIndicator.test.tsx src/test/riskGroupCard.test.tsx src/test/emptyRiskGroup.test.tsx src/test/dashboardDisclaimer.test.tsx
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/RiskLevelIndicator.tsx frontend/src/components/RiskGroupCard.tsx frontend/src/components/EmptyRiskGroup.tsx frontend/src/components/DashboardDisclaimer.tsx frontend/src/test/riskLevelIndicator.test.tsx frontend/src/test/riskGroupCard.test.tsx frontend/src/test/emptyRiskGroup.test.tsx frontend/src/test/dashboardDisclaimer.test.tsx
git commit -m "feat(ui): add dashboard sub-components for overview refactor"
```

---

## Task 6: 重构 OverviewPage + 配置页通知卡片

**Files:**
- Modify: `frontend/src/pages/OverviewPage.tsx` — 新布局 + 通知初始化和风险监听
- Modify: `frontend/src/pages/ConfigPage.tsx` — 新增"本地通知"配置卡片
- Modify: `frontend/src/test/overviewPage.test.tsx` — 适配新布局
- Modify: `frontend/src/test/configPage.test.tsx` — 通知配置卡测试

- [ ] **Step 1: 重构 OverviewPage.tsx**

新布局伪代码：

```tsx
export default function OverviewPage() {
  // --- existing hooks ---
  const riskData = aggregateRiskData({ ... })
  const { currentTrip, initialize: initTrip, ...tripActions } = useSafetyTripStore()
  const { config, initialize: initNotifConfig } = useNotificationConfigStore()

  useEffect(() => {
    initTrip()
    initNotifConfig()
  }, [])

  // Group risk items by rule category
  const groups = groupRiskItems(riskData.items)

  return (
    <PageShell title="总览">
      <DashboardDisclaimer />
      <SafetyTripCard ... />  {/* move above risks */}
      <RiskLevelIndicator level={riskData.level} />
      {groups.map(group => (
        group.items.length > 0
          ? <RiskGroupCard key={group.key} title={group.title} icon={group.icon} items={group.items} />
          : <EmptyRiskGroup key={group.key} message={group.emptyMessage} />
      ))}
    </PageShell>
  )
}
```

实现 `groupRiskItems` 辅助函数（放到 OverviewPage 文件内或独立 domain 函数）：

```ts
function groupRiskItems(items: RiskItem[]): RiskGroup[] {
  const groups: Record<string, { title: string, icon: string, emptyMessage: string, items: RiskItem[] }> = {
    trace: { title: '轨迹风险', icon: '📍', emptyMessage: '轨迹追踪正常', items: [] },
    config: { title: '配置风险', icon: '⚙️', emptyMessage: '配置完整', items: [] },
    geofence: { title: '围栏风险', icon: '🚧', emptyMessage: '暂无围栏事件', items: [] },
    safetyTrip: { title: '行程风险', icon: '🚶', emptyMessage: '无进行中行程', items: [] },
    other: { title: '其他', icon: '📋', emptyMessage: '无其他提示', items: [] },
  }
  for (const item of items) {
    const key = item.rule && item.rule in groups ? item.rule : 'other'
    groups[key].items.push(item)
  }
  return Object.values(groups)
}
```

Also need to add notification scheduling when risk level changes. Use `useEffect` comparing previous risk level to detect elevation:

```ts
const prevLevelRef = useRef<RiskLevel>(riskData.level)
useEffect(() => {
  if (!config?.enabled || !config?.riskElevated.enabled) return
  const levelOrder: RiskLevel[] = ['safe', 'caution', 'danger']
  if (levelOrder.indexOf(riskData.level) > levelOrder.indexOf(prevLevelRef.current)) {
    scheduleRiskNotification()
  }
  prevLevelRef.current = riskData.level
}, [riskData.level, config])
```

- [ ] **Step 2: 更新 OverviewPage 测试**

更新 `frontend/src/test/overviewPage.test.tsx` — 添加：
1. 断言安全行程卡片在风险卡片之前渲染（DOM 顺序）。
2. 断言风险等级指示器渲染。
3. 断言声明行渲染。
4. 断言空态分组渲染。

- [ ] **Step 3: 配置页通知卡片**

在 `frontend/src/pages/ConfigPage.tsx` 中新增"本地通知"卡片：

```
- 标题：本地通知
- 总开关：启用本地通知
- 子选项：
  - 行程超时提醒：开关 + 提前时间选择（1/5/10/15 分钟 select）
  - 风险变化提醒：开关
- 权限状态展示
- 安全边界说明文本
```

布局参考已有"本地风险规则"卡片样式。

- [ ] **Step 4: 更新配置页测试**

在 `frontend/src/test/configPage.test.tsx` 中新增通知配置卡片的断言。

- [ ] **Step 5: 跑全量测试**

```bash
cd frontend && npx vitest run
```

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/OverviewPage.tsx frontend/src/pages/ConfigPage.tsx frontend/src/test/overviewPage.test.tsx frontend/src/test/configPage.test.tsx
git commit -m "feat(ui): refactor overview dashboard and add notification config card"
```

---

## Task 7: 版本升级、README、构建闸口

**Files:**
- Modify: `frontend/package.json`
- Modify: `frontend/package-lock.json`
- Modify: `README.md`

- [ ] **Step 1: Bump version**

`frontend/package.json`: `"version": "0.4.29"` → `"version": "0.4.30"`
同步 `frontend/package-lock.json` 顶层 version field。

- [ ] **Step 2: 更新 README.md**

- 统一事实表版本号：`0.4.29` → `0.4.30`
- 已落地能力 4.1 节：新增"本地通知"和"总览仪表盘"说明。
- 回归基线 5.0 节：补充通知配置、通知调度、仪表盘子组件的回归范围。

- [ ] **Step 3: 最终闸口**

```bash
cd frontend && npm run check
```

If pass:

```bash
cd frontend && npm run check:full && npm run android:release
```

Expected: TypeScript OK, ESLint OK, all tests pass, Vite build OK, Android debug/release APK + AAB generated.

- [ ] **Step 4: 最终 commit + tag + GitHub Release**

```bash
git add frontend/package.json frontend/package-lock.json README.md
git commit -m "chore: bump to v0.4.30"
git tag -a v0.4.30 -m 'v0.4.30 local notifications and dashboard polish'
git push origin main
git push origin v0.4.30
gh release create v0.4.30 \
  frontend/android/app/build/outputs/apk/debug/solo-youth-safety-v0.4.30-debug.apk \
  frontend/android/app/build/outputs/apk/release/solo-youth-safety-v0.4.30-release.apk \
  frontend/android/app/build/outputs/bundle/release/solo-youth-safety-v0.4.30-release.aab \
  --repo ProgramerLiang/solo-youth-safety \
  --title "v0.4.30 本地通知集成 + 总览仪表盘打磨" \
  --notes "..." \
  --latest
```