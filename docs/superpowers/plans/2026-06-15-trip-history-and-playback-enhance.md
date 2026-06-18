# v0.4.31 安全行程历史 + 轨迹回放增强 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 补全安全行程历史列表 UI 和轨迹回放页增强，均为纯本地功能。

**Spec:** `docs/superpowers/specs/2026-06-15-trip-history-and-playback-enhance.md`

---

## 文件结构

**新建：**
- `frontend/src/pages/TripHistoryPage.tsx` — 行程历史页面
- `frontend/src/test/tripHistoryPage.test.tsx` — 行程历史页面测试

**修改：**
- `frontend/src/types/index.ts` — 新增 `PageId 'tripHistory'`
- `frontend/src/shell/AppShell.tsx` — 侧边栏新增"行程历史"入口
- `frontend/src/domain/playback.ts` — `PlaybackPoint` 新增 `speedKmh` 字段
- `frontend/src/pages/PlaybackPage.tsx` — 缩放控制、点位详情、速度颜色、移动摘要
- `frontend/src/test/playback.test.ts` — 扩展覆盖速度字段
- `frontend/src/test/playbackPage.test.tsx` — 扩展覆盖缩放/详情/速度/摘要
- `frontend/package.json` — 版本 `0.4.30` → `0.4.31`
- `frontend/package-lock.json` — 同步版本
- `README.md` — 事实表、能力清单、回归基线

---

## Task 1: 行程历史页面

- [ ] **Step 1: 读现有导航结构**

```bash
cd frontend && grep -n 'PageId\|ALL_PAGE_IDS\|tripHistory\|playback\|tracking' src/types/index.ts src/shell/AppShell.tsx
```

- [ ] **Step 2: 写测试（RED）**

创建 `frontend/src/test/tripHistoryPage.test.tsx`：

```tsx
import { describe, expect, it, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TripHistoryPage } from '../pages/TripHistoryPage'
import { appendSafetyTripHistory, saveCurrentSafetyTrip } from '../data/safetyTripRepo'
import type { SafetyTrip } from '../domain/safetyTrip'

const arrivedTrip: SafetyTrip = {
  id: 't1',
  destination: '回家',
  createdAt: '2026-06-15T10:00:00.000Z',
  expectedArrivalAt: '2026-06-15T10:20:00.000Z',
  status: 'arrived',
  events: [{ id: 'e1', type: 'arrived', timestamp: '2026-06-15T10:18:00.000Z' }],
}

const cancelledTrip: SafetyTrip = {
  id: 't2',
  destination: '去超市',
  createdAt: '2026-06-14T14:00:00.000Z',
  expectedArrivalAt: '2026-06-14T14:15:00.000Z',
  status: 'cancelled',
  events: [{ id: 'e2', type: 'cancelled', timestamp: '2026-06-14T14:05:00.000Z' }],
}

beforeEach(async () => {
  await saveCurrentSafetyTrip(null)
  const { storage } = await import('../data/storage')
  await storage.remove('safety_v2_trip_history')
})

describe('TripHistoryPage', () => {
  it('renders empty state when no history', async () => {
    render(<TripHistoryPage />)
    expect(await screen.findByText('暂无安全行程记录')).toBeInTheDocument()
  })

  it('renders history list with status badges', async () => {
    await appendSafetyTripHistory(arrivedTrip)
    await appendSafetyTripHistory(cancelledTrip)
    render(<TripHistoryPage />)
    expect(await screen.findByText('回家')).toBeInTheDocument()
    expect(screen.getByText('去超市')).toBeInTheDocument()
    expect(screen.getByText('已完成')).toBeInTheDocument()
    expect(screen.getByText('已取消')).toBeInTheDocument()
  })

  it('shows time and event count for each trip', async () => {
    await appendSafetyTripHistory(arrivedTrip)
    render(<TripHistoryPage />)
    expect(await screen.findByText(/2026/)).toBeInTheDocument()
    expect(screen.getByText(/1 条事件/)).toBeInTheDocument()
  })
})
```

- [ ] **Step 3: 跑测试确认 RED**

```bash
cd frontend && npx vitest run src/test/tripHistoryPage.test.tsx
```

- [ ] **Step 4: 实现 TripHistoryPage**

创建 `frontend/src/pages/TripHistoryPage.tsx`：

```tsx
import { useEffect, useState } from 'react'
import { Box, Chip, List, ListItem, ListItemText, Stack, Typography } from '@mui/material'
import { EmptyState } from '../components/EmptyState'
import { loadSafetyTripHistory } from '../data/safetyTripRepo'
import type { SafetyTrip, SafetyTripStatus } from '../domain/safetyTrip'

const statusLabel: Record<SafetyTripStatus, string> = {
  active: '进行中',
  overdue: '已超时',
  arrived: '已完成',
  cancelled: '已取消',
}

const statusColor: Record<SafetyTripStatus, 'success' | 'error' | 'default'> = {
  active: 'success',
  overdue: 'error',
  arrived: 'success',
  cancelled: 'default',
}

function formatTime(iso: string): string {
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export function TripHistoryPage() {
  const [trips, setTrips] = useState<SafetyTrip[]>([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    loadSafetyTripHistory().then((data) => {
      setTrips(data.slice().reverse())
      setLoaded(true)
    })
  }, [])

  if (!loaded) return null

  if (trips.length === 0) {
    return <EmptyState message="暂无安全行程记录" />
  }

  return (
    <Box sx={{ px: { xs: 2, sm: 3 }, py: 2 }}>
      <Typography variant="h5" fontWeight="bold" sx={{ mb: 2 }}>
        安全行程历史
      </Typography>
      <List>
        {trips.map((trip) => (
          <ListItem key={trip.id} divider sx={{ flexDirection: 'column', alignItems: 'flex-start' }}>
            <Stack direction="row" alignItems="center" spacing={1} sx={{ width: '100%' }}>
              <ListItemText
                primary={trip.destination}
                secondary={`${formatTime(trip.createdAt)} → 预计 ${formatTime(trip.expectedArrivalAt)}`}
              />
              <Chip label={statusLabel[trip.status]} size="small" color={statusColor[trip.status]} />
            </Stack>
            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
              {trip.events.length} 条事件
            </Typography>
          </ListItem>
        ))}
      </List>
    </Box>
  )
}
```

- [ ] **Step 5: 跑测试确认 GREEN**

```bash
cd frontend && npx vitest run src/test/tripHistoryPage.test.tsx
```

- [ ] **Step 6: 新增 PageId 和导航入口**

在 `frontend/src/types/index.ts` 的 `PageId` 联合类型中新增 `'tripHistory'`，在 `ALL_PAGE_IDS` 数组中新增对应条目。

在 `frontend/src/shell/AppShell.tsx` 中新增导航项。

- [ ] **Step 7: 跑现有导航测试确认不破坏**

```bash
cd frontend && npx vitest run src/test/appShell.test.tsx
```

- [ ] **Step 8: Commit**

```bash
git add frontend/src/pages/TripHistoryPage.tsx frontend/src/test/tripHistoryPage.test.tsx frontend/src/types/index.ts frontend/src/shell/AppShell.tsx
git commit -m "feat: add trip history page with nav entry"
```

---

## Task 2: 回放 domain 增强（速度字段）

- [ ] **Step 1: 扩展 playback 测试（RED）**

在 `frontend/src/test/playback.test.ts` 中新增测试：

```ts
it('computes speedKmh for consecutive tracking points', () => {
  const route = buildPlaybackRoute([firstPoint, secondPoint], [])
  const second = route.points.find((p) => p.label === '结束点')
  expect(second?.speedKmh).toBeDefined()
  expect(typeof second?.speedKmh).toBe('number')
})
```

- [ ] **Step 2: 跑测试确认 RED**

```bash
cd frontend && npx vitest run src/test/playback.test.ts
```

- [ ] **Step 3: 实现速度字段**

在 `frontend/src/domain/playback.ts`：
- `PlaybackPoint` 接口新增 `speedKmh?: number`
- `buildPlaybackRoute` 中为连续轨迹点计算速度（使用 `getEffectiveSpeedKmh`）

- [ ] **Step 4: 跑测试确认 GREEN**

```bash
cd frontend && npx vitest run src/test/playback.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/domain/playback.ts frontend/src/test/playback.test.ts
git commit -m "feat(playback): add speedKmh to PlaybackPoint"
```

---

## Task 3: 回放页 UI 增强

- [ ] **Step 1: 扩展回放页测试（RED）**

在 `frontend/src/test/playbackPage.test.tsx` 中新增测试项：

```tsx
it('shows zoom controls with +/- buttons', async () => { ... })
it('shows selected point detail on click', async () => { ... })
it('shows movement summary card', async () => { ... })
```

- [ ] **Step 2: 跑测试确认 RED**

- [ ] **Step 3: 实现回放页增强**

在 `frontend/src/pages/PlaybackPage.tsx`：
- 新增 `zoom` 状态（默认 1，范围 0.5–3）
- 新增 `selectedPoint` 状态
- 新增 `PlaybackZoomControls` 内联组件
- 新增 `PlaybackPointDetail` 内联组件（Popover）
- 新增 `PlaybackSpeedLegend` 内联组件
- 新增 `PlaybackMovementSummary` 内联组件
- SVG 画布 `transform: scale(zoom)` 和 `transform-origin: top left`
- 轨迹点颜色根据 `speedKmh` 映射

- [ ] **Step 4: 跑测试确认 GREEN**

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/PlaybackPage.tsx frontend/src/test/playbackPage.test.tsx
git commit -m "feat(playback): add zoom, point detail, speed coloring, and movement summary"
```

---

## Task 4: 版本升级、README、构建闸口

- [ ] **Step 1: Bump version**

`frontend/package.json`: `"version": "0.4.30"` → `"version": "0.4.31"`
同步 `frontend/package-lock.json` 顶层 version field。

- [ ] **Step 2: 更新 README.md**

- 统一事实表版本号：`0.4.30` → `0.4.31`
- 已落地能力新增：行程历史、回放缩放/详情/速度/摘要
- 回归基线补充

- [ ] **Step 3: 最终闸口**

```bash
cd frontend && npm run check:full && npm run android:release
```

- [ ] **Step 4: 最终 commit + tag + GitHub Release**

```bash
git add frontend/package.json frontend/package-lock.json README.md
git commit -m "chore: bump to v0.4.31"
git tag -a v0.4.31 -m 'v0.4.31 trip history and playback enhancement'
git push origin main && git push origin v0.4.31
gh release create v0.4.31 \
  frontend/android/app/build/outputs/apk/debug/solo-youth-safety-v0.4.31-debug.apk \
  frontend/android/app/build/outputs/apk/release/solo-youth-safety-v0.4.31-release.apk \
  frontend/android/app/build/outputs/bundle/release/solo-youth-safety-v0.4.31-release.aab \
  --repo ProgramerLiang/solo-youth-safety \
  --title "v0.4.31 安全行程历史 + 轨迹回放增强" \
  --notes "..." \
  --latest
```