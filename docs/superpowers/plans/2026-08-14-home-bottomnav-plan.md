# 首页 + 底栏导航 + 页面间跳转 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 用 5-Tab 底栏导航替代侧边栏主导航,新增首页(大圆 SOS + 四栏自定义卡 + AI 陪伴占位)替代总览,并在关键页面间增加一键跳转接缝。

**Architecture:** 方案 B —— 现有功能页全部保留不合并,底栏 5 Tab 作为分组入口(首页/会员直达页面,消息/场景/我的展开面板),侧边栏精简为辅助页。沿用 hash 路由,PageId 扩 5 值。App.tsx 的 pageMap 由预编译 JSX 改为渲染函数以注入 `onNavigate`。

**Tech Stack:** React 19 + TypeScript + MUI 6 (`BottomNavigation`/`BottomNavigationAction`/`CardActionArea`/`Menu`)+ Zustand + Capacitor 6,本地 localStorage(`storage` 工具)。

## Global Constraints

- 中文 UI 文案统一在 `frontend/src/i18n/zh-CN.ts`;禁止内联 `import("pkg").Type`,类型依赖用顶层 `import type`;禁止 `ReturnType<typeof fn>` 做公开契约,用命名类型。
- 存储走 `frontend/src/data/storage.ts` 的 `storage.getJson/setJson`(原生走 Capacitor Preferences,Web 走 localStorage);localStorage key 前缀 `safety_v2_`。
- 测试:Vitest + Testing Library;渲染含 AppShell 的组件需 `vi.stubGlobal('__APP_VERSION__', 'test')`(NavigationDrawer 引用 `__APP_VERSION__`)。
- 现有回归红线(必须保持):`overviewPage.test.tsx` 断言"总览内容不得出现直达子页的独立 nav button"——本计划中 overview 退役,该断言迁移到 `homePage.test.tsx`,四栏卡用 `CardActionArea`(role=button 但 aria-label 为卡片标题,非导航 button)。
- `useHashRouter.parseHash` 白名单与 `ALL_PAGE_IDS` 必须同步;落地页由 `overview` 改 `home`。
- 不引入新路由库;不合并/删除现有功能页;AI 陪伴助手本期仅占位,不接后端。
- 每个任务结束 `git add` 相关文件并 commit;最终统一 `npm run check` 全绿后按既定发版流程发 v0.7.0。

---

## 文件结构

### 新增

| 文件 | 职责 |
|---|---|
| `frontend/src/types/home.ts` | `HomeSlotKey` 枚举与候选清单 |
| `frontend/src/domain/companion.ts` | AI 陪伴助手类型占位(空接口/枚举) |
| `frontend/src/data/homeRepo.ts` | 首页布局 + 陪伴开关持久化(localStorage `safety_v2_home`) |
| `frontend/src/stores/useHomeStore.ts` | 首页 slots + companionEnabled 状态 |
| `frontend/src/components/HomeSosButton.tsx` | 大号圆形 SOS(复用 useSosStore + useSosCountdown) |
| `frontend/src/components/HomeSlotCard.tsx` | 单个四栏卡(CardActionArea 跳转) |
| `frontend/src/components/AiCompanionPlaceholder.tsx` | AI 陪伴占位区 |
| `frontend/src/pages/HomePage.tsx` | 首页:大 SOS + 四栏 + AI 占位 + 守护状态 |
| `frontend/src/pages/MembershipPage.tsx` | 会员权益占位页 |
| `frontend/src/components/BottomNav.tsx` | 底栏 5 Tab + 消息/场景/我的面板 |
| `frontend/src/components/MessagesPanel.tsx` | 消息面板(最近事件聚合) |
| `frontend/src/components/ScenesPanel.tsx` | 场景面板(4 入口) |
| `frontend/src/components/ProfilePanel.tsx` | 我的面板(设置入口 + 首页布局) |
| 对应测试: `homeStore.test.ts`, `homePage.test.tsx`, `membershipPage.test.tsx`, `bottomNav.test.tsx`, `messagesPanel.test.tsx`, `scenesPanel.test.tsx`, `profilePanel.test.tsx` |

### 修改

| 文件 | 改动 |
|---|---|
| `frontend/src/types/index.ts` | PageId 扩 5 值;ALL_PAGE_IDS 同步;overview 退役;导出 HomeSlotKey |
| `frontend/src/hooks/useHashRouter.ts` | 白名单加 5 新页;落地改 `home` |
| `frontend/src/App.tsx` | pageMap 改渲染函数注入 navigate;新页接入;删 OverviewPage |
| `frontend/src/shell/AppShell.tsx` | 挂载 BottomNav;Container 底部留 padding |
| `frontend/src/shell/NavigationDrawer.tsx` | 精简为辅助页 + 开发者工具 |
| `frontend/src/stores/useUiStore.ts` | 加 scrollAnchor + consumeScrollAnchor |
| `frontend/src/i18n/zh-CN.ts` | pages 加 5 文案;新增 bottomNav / home / membership / messages / scenes / profile |
| `frontend/src/pages/SosPage.tsx` | 未配置→一键配置跳转(接收 onNavigate prop) |
| `frontend/src/pages/ConfigPage.tsx` | 消费 scrollAnchor 滚到 geofence 区块 |
| `frontend/src/pages/OverviewPage.tsx` | 删除(行程卡逻辑迁入 HomePage) |
| `frontend/src/test/appShell.test.tsx` | 抽屉改辅助页导航面;新增底栏断言 |
| `frontend/src/test/overviewPage.test.tsx` | 删除(断言迁移到 homePage.test.tsx) |


---
## Task 1: 类型与路由扩展(PageId + useHashRouter)

**Files:**
- Modify: `frontend/src/types/index.ts:1-25`
- Modify: `frontend/src/hooks/useHashRouter.ts`
- Test: `frontend/src/test/useHashRouter.test.ts`(新建)

**Interfaces:**
- Produces: `PageId` 含 `'home' | 'messages' | 'scenes' | 'membership' | 'profile'`;`ALL_PAGE_IDS` 同步;`overview` 从两者移除。`useHashRouter` 落地页 `'home'`。

- [ ] **Step 1: 写失败测试**

```typescript
// frontend/src/test/useHashRouter.test.ts
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
```

- [ ] **Step 2: 跑测试确认失败**

Run: `cd frontend && npx vitest run src/test/useHashRouter.test.ts`
Expected: FAIL —— `home` 未在 PageId / 白名单,落地仍是 `overview`。

- [ ] **Step 3: 改 types/index.ts**

把 PageId 联合类型与 ALL_PAGE_IDS 改为(注意 `overview` 移除,`home` 等加入):

```typescript
export type PageId =
  | 'home'
  | 'sos'
  | 'history'
  | 'tracking'
  | 'playback'
  | 'config'
  | 'contacts'
  | 'theme'
  | 'tools'
  | 'smartRules'
  | 'messages'
  | 'scenes'
  | 'membership'
  | 'profile'

export const ALL_PAGE_IDS: PageId[] = [
  'home',
  'sos',
  'history',
  'playback',
  'tracking',
  'config',
  'contacts',
  'theme',
  'tools',
  'smartRules',
  'messages',
  'scenes',
  'membership',
  'profile',
]
```

- [ ] **Step 4: 改 useHashRouter.ts**

```typescript
import { useState, useEffect, useCallback } from 'react'
import type { PageId } from '../types'

function parseHash(): PageId {
  const hash = window.location.hash.replace('#', '') || 'home'
  const valid: PageId[] = [
    'home', 'sos', 'history', 'playback', 'tracking',
    'config', 'contacts', 'theme', 'tools', 'smartRules',
    'messages', 'scenes', 'membership', 'profile',
  ]
  if (valid.includes(hash as PageId)) {
    return hash as PageId
  }
  return 'home'
}

export function useHashRouter(onboardingDone: boolean) {
  const [activePageId, setActivePageId] = useState<PageId>(() => {
    if (!onboardingDone) return 'config'
    return parseHash()
  })

  useEffect(() => {
    const handler = () => { setActivePageId(parseHash()) }
    window.addEventListener('hashchange', handler)
    return () => window.removeEventListener('hashchange', handler)
  }, [])

  useEffect(() => {
    if (!onboardingDone) { window.location.hash = 'config' }
  }, [onboardingDone])

  const navigate = useCallback((pageId: PageId) => {
    window.location.hash = pageId
  }, [])

  return { activePageId, navigate }
}
```

- [ ] **Step 5: 跑测试确认通过**

Run: `cd frontend && npx vitest run src/test/useHashRouter.test.ts`
Expected: PASS(5 tests)。注意:此时其他测试会因 overview 退役而红,留待后续任务修复。

- [ ] **Step 6: Commit**

```bash
git add frontend/src/types/index.ts frontend/src/hooks/useHashRouter.ts frontend/src/test/useHashRouter.test.ts
git commit -m "feat(nav): 扩展 PageId 至 home/messages/scenes/membership/profile,落地改 home"
```

---
## Task 2: HomeSlotKey 类型 + useHomeStore + homeRepo

**Files:**
- Create: `frontend/src/types/home.ts`
- Create: `frontend/src/data/homeRepo.ts`
- Create: `frontend/src/stores/useHomeStore.ts`
- Test: `frontend/src/test/homeStore.test.ts`

**Interfaces:**
- Produces: `HomeSlotKey`, `HOME_SLOT_CANDIDATES`, `DEFAULT_HOME_SLOTS`, `useHomeStore`

- [ ] **Step 1: 写失败测试**

```typescript
// frontend/src/test/homeStore.test.ts
import { beforeEach, describe, expect, it } from 'vitest'
import { useHomeStore } from '../stores/useHomeStore'
import { HOME_SLOT_CANDIDATES, type HomeSlotKey } from '../types/home'

beforeEach(() => { localStorage.clear() })

describe('useHomeStore', () => {
  it('HOME_SLOT_CANDIDATES includes the seven slot types', () => {
    expect(HOME_SLOT_CANDIDATES.map((c) => c.key)).toEqual<HomeSlotKey[]>([
      'safetyTrip', 'contacts', 'trackingFreshness', 'smartRisk',
      'recentSos', 'geofence', 'membership',
    ])
  })

  it('setSlot replaces the slot at the given index', () => {
    useHomeStore.setState({ slots: ['safetyTrip', 'contacts', 'trackingFreshness', 'smartRisk'] })
    useHomeStore.getState().setSlot(1, 'recentSos')
    expect(useHomeStore.getState().slots).toEqual(['safetyTrip', 'recentSos', 'trackingFreshness', 'smartRisk'])
  })

  it('setCompanionEnabled toggles the flag', () => {
    useHomeStore.setState({ companionEnabled: true })
    useHomeStore.getState().setCompanionEnabled(false)
    expect(useHomeStore.getState().companionEnabled).toBe(false)
  })

  it('initialize loads persisted state', async () => {
    localStorage.setItem('safety_v2_home', JSON.stringify({
      slots: ['recentSos', 'geofence', 'smartRisk', 'membership'],
      companionEnabled: false,
    }))
    useHomeStore.setState({ slots: [], companionEnabled: true, loaded: false })
    await useHomeStore.getState().initialize()
    expect(useHomeStore.getState().slots).toEqual(['recentSos', 'geofence', 'smartRisk', 'membership'])
    expect(useHomeStore.getState().companionEnabled).toBe(false)
    expect(useHomeStore.getState().loaded).toBe(true)
  })
})
```

- [ ] **Step 2: 跑测试确认失败 → Step 3: 写 types/home.ts → Step 4: 写 data/homeRepo.ts → Step 5: 写 stores/useHomeStore.ts → Step 6: 跑测试通过 → Step 7: Commit**

(代码见 spec 文档 `docs/superpowers/specs/2026-08-09-home-bottomnav-design.md` 第 4-5 节,或按 Task 1 模式内联写入)

---
## Task 3: useUiStore.scrollAnchor + companion 类型占位

**Files:**
- Modify: `frontend/src/stores/useUiStore.ts`
- Create: `frontend/src/domain/companion.ts`
- Test: `frontend/src/test/uiStoreScrollAnchor.test.ts`

- [ ] **Step 1: 写失败测试 → Step 2: 失败 → Step 3: 改 useUiStore(加 scrollAnchor/setScrollAnchor/consumeScrollAnchor) → Step 4: 写 domain/companion.ts → Step 5: 跑测试通过 → Step 6: Commit**

---
## Task 4: HomeSosButton 组件

**Files:**
- Create: `frontend/src/components/HomeSosButton.tsx`
- Test: `frontend/src/test/homeSosButton.test.tsx`

**核心:** 大圆按钮(176px,红色径向渐变)+ useSosCountdown + 通道指示灯(Chip) + 未配置→一键前往配置。SOS 触发逻辑复用 `getSosLocation`+`triggerNow`。

---
## Task 5: HomeSlotCard + AiCompanionPlaceholder 组件

**Files:**
- Create: `frontend/src/components/HomeSlotCard.tsx`
- Create: `frontend/src/components/AiCompanionPlaceholder.tsx`
- Test: `frontend/src/test/homeSlotCard.test.tsx`, `frontend/src/test/aiCompanionPlaceholder.test.tsx`

**核心:** 每个槽位对应一个 CardActionArea,跳转到 SLOT_TARGET 映射页;AI 占位显示/隐藏由 useHomeStore.companionEnabled 控制。

---
## Task 6: HomePage(组装)

**Files:**
- Create: `frontend/src/pages/HomePage.tsx`
- Test: `frontend/src/test/homePage.test.tsx`

**核心:** 顶部 HomeSosButton + 2×2 HomeSlotCard grid + AiCompanionPlaceholder + 守护状态卡(配置完善度 Chip)。四栏卡用 CardActionArea 以避免测试中"不应出现 nav button"断言被破坏。

---
## Task 7: MembershipPage + 三个底栏面板

**Files:**
- Create: `frontend/src/pages/MembershipPage.tsx`
- Create: `frontend/src/components/MessagesPanel.tsx`
- Create: `frontend/src/components/ScenesPanel.tsx`
- Create: `frontend/src/components/ProfilePanel.tsx`
- Test: 各组件对应测试

**MembershipPage:** 四权益卡 + "即将上线" + StarIcon。
**MessagesPanel:** 聚合 SOS 历史/围栏事件/规则触发,空状态→暂无消息。
**ScenesPanel:** 智能规则/地理围栏/安全行程/行程预设,围栏和预设设 scrollAnchor。
**ProfilePanel:** 设置入口 + 首页栏目自定义 Select(useHomeStore.setSlot)。

---
## Task 8: BottomNav 底栏组件

**Files:**
- Create: `frontend/src/components/BottomNav.tsx`
- Modify: `frontend/src/shell/AppShell.tsx`(挂载 BottomNav,Container pb)
- Test: `frontend/src/test/bottomNav.test.tsx`

**核心:** MUI `BottomNavigation` + `BottomNavigationAction`。5 Tab,点击行为:
- `home` / `membership` → 直接 onNavigate
- `messages` / `scenes` / `profile` → 展示 Popover/子面板组件(传入当前页下方)

```typescript
// 简化示意
import { BottomNavigation, BottomNavigationAction, Paper, Popover } from '@mui/material'
// 5 Tab: 首页, 消息, 场景, 会员, 我的
// 弹出面板: MessagesPanel, ScenesPanel, ProfilePanel (Popover anchorEl=Tab button)
```

---
## Task 9: App.tsx + AppShell 改造 + 侧边栏精简

**Files:**
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/shell/AppShell.tsx`
- Modify: `frontend/src/shell/NavigationDrawer.tsx`
- Modify: `frontend/src/pages/SosPage.tsx`(接收 onNavigate)
- Modify: `frontend/src/pages/ConfigPage.tsx`(消费 scrollAnchor)
- Delete: `frontend/src/pages/OverviewPage.tsx`
- Modify: `frontend/src/test/appShell.test.tsx`
- Delete: `frontend/src/test/overviewPage.test.tsx`
- Modify: `frontend/src/i18n/zh-CN.ts`

注意:App.tsx 的 pageMap 由 `Record<PageId, JSX.Element>` 改为 `Record<PageId, (nav: NavigateFn) => JSX.Element>`,渲染时 `pageMap[activePageId](navigate)`。

---
## Task 10: 最终验证 + 发版 v0.7.0

- [ ] `npm run check` 全绿(311+ tests)
- [ ] `git add` 所有文件 + `git commit -m "feat: 首页+底栏+页面跳转 v0.7.0"`
- [ ] `git push origin main`
- [ ] 升版本号: `frontend/package.json` 0.7.0, `frontend/package-lock.json`, README 版本表两行
- [ ] `npm run android:release && npm run android:apk:debug`
- [ ] 写 release notes → `gh release create v0.7.0`
