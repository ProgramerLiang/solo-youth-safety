# 首页 + 底栏导航 + 页面间跳转 设计

- 日期: 2026-08-09
- 状态: 已认可,待实现
- 方案: B(保留页面独立性,底栏作分组导航)
- 范围: 纯前端,本地存储,无网络/无后端

## 目标

1. 精简侧边栏,新增底部导航栏(BottomNavigation),让多数功能通过底栏即可跳转访问。
2. 新增首页(HomePage),替代并升格现有「总览(Overview)」:
   - 上方一个大号圆形 SOS 按钮;
   - 中间四栏卡片,用户可自定义显示内容并支持跳转;
   - 预留 AI 陪伴助手位置(占位)。
3. 在页面之间增加适当的跳转接缝(如 SOS 检测到配置不全可一键跳转配置页)。

## 非目标

- 不引入 React Router 或任何新路由库;沿用 hash 路由。
- 不合并/删除现有功能页(历史、回放、轨迹、配置、联系人、主题、工具、智能规则)。
- 不接入任何 AI 后端或网络服务;AI 陪伴助手本期仅占位。
- 不改动既有领域逻辑(riskAssessment / safetyTrip / ruleEngine / SOS 触发链)。

## 导航模型(方案 B)

现有功能页全部保留、不合并。底栏 5 个 Tab 作为分组入口:

| Tab | 交互 | 内容 |
|---|---|---|
| 首页 | 直达页面(新 `home`) | 大圆 SOS + 四栏卡 + AI 陪伴占位 + 守护状态 |
| 消息 | 点击展开面板(BottomSheet/Menu) | 最近事件预览(最近 SOS / 围栏进出 / 规则触发)+ 入口:历史、轨迹 |
| 场景 | 点击展开面板 | 入口:智能规则、地理围栏(→config 锚点)、安全行程、行程预设(→config 锚点) |
| 会员 | 直达页面(新 `membership`) | 权益卡片 ×4 + "即将上线"占位,无后端 |
| 我的 | 点击展开面板 | 入口:紧急配置、联系人、主题、隐私锁屏、数据工具(开发者模式可见) |

- 底栏 Tab 高亮规则:当前页属于该组、或该面板打开时高亮。
- 侧边栏精简为仅辅助页:回放地图、轨迹页、SOS 模拟训练;开发者模式下追加数据工具/诊断。
- 顶栏 AppBar 保持不变(汉堡 + 应用名)。

## 首页布局(HomePage)

```
┌─────────────────────────────────────┐
│            ⭕  大号圆形 SOS           │  ← ~176px,红色渐变;点击→5秒倒计时
│        (未配置号码时下方黄色警示)      │     +「一键去配置」按钮
├─────────────────────────────────────┤
│  🗺 安全行程      👥 紧急联系人        │
│  📍 轨迹新鲜度    ⚠ 智能风险提示       │  ← 四栏卡片(2×2),CardActionArea 跳转
├─────────────────────────────────────┤
│  🤖 AI 陪伴助手(占位)                │
│  「即将上线,敬请期待」+ 禁用按钮       │
├─────────────────────────────────────┤
│                      [底栏]          │
└─────────────────────────────────────┘
```

### 大号圆形 SOS

- 复用 `useSosStore.arm()` + `useSosCountdown`,与 SOS 页同一套触发逻辑;倒计时进行中按钮文案变为"取消({n})"。
- 通道与位置状态微型指示灯(电话/短信/位置新鲜度),复用 SosPage 既有数据源。
- 未配置紧急号码(`!callNumber || !smsNumber`)时,按钮下方显示黄色警示 + "一键前往配置"按钮 → `navigate('config')`。

### 四栏自定义卡片

- 默认四槽:`safetyTrip / contacts / trackingFreshness / smartRisk`。
- 每槽为 `Card` + `CardActionArea`,`onClick` 跳转对应页;`aria-label` 为卡片标题(非导航 button),以兼容 overview 测试语义。
- 候选槽位枚举 `HomeSlotKey`:
  - `safetyTrip` 安全行程(→ overview 行程卡内联或 smartRules)
  - `contacts` 紧急联系人(→ contacts)
  - `trackingFreshness` 轨迹新鲜度(→ tracking)
  - `smartRisk` 智能风险提示(→ smartRules)
  - `recentSos` 最近 SOS(→ history)
  - `geofence` 围栏状态(→ config#geofence)
  - `membership` 会员权益(→ membership)
- 自定义入口:在「我的」面板中提供"首页布局"设置,可改每槽显示内容;数据存 localStorage(新 `useHomeStore`,Zustand persist)。
- 无数据槽位显示空状态文案 + 跳转链接(如无联系人 → "添加联系人")。

### AI 陪伴助手占位

- 首页固定占位区:图标 + "AI 陪伴助手 · 即将上线,敬请期待" + 禁用按钮。
- 类型定义预留 `src/domain/companion.ts`(空接口/枚举),本期不接任何后端。
- 禁用后该占位区折叠为单行提示(可在「我的」重新启用)。

## 页面间跳转接缝

| 触发条件 | 跳转入口 | 目标 |
|---|---|---|
| SOS 页 / 首页 SOS 块 检测到 `!callNumber \|\| !smsNumber` | "一键前往配置"按钮 | `config` |
| 首页"紧急联系人"卡 + 无联系人 | 卡内"添加联系人"链接 | `contacts` |
| 首页"安全行程"卡 + 无行程 | 卡内"创建安全行程" | 同页弹窗(复用 overview Dialog) |
| 首页"安全行程"卡 + 超时 | "查看智能规则"链接 | `smartRules` |
| 首页"智能风险"卡 + 围栏风险项 | 风险项点击 | `config` 锚点 `geofence` |
| 首页"轨迹新鲜度"卡 + 未采样 | "开启轨迹追踪" | `tracking` |
| 消息面板 SOS 记录条 | 点击条目 | `history` |
| 消息面板 围栏事件 | 点击条目 | `playback` |

### 接缝实现

- 给需要跳转的页面注入 `onNavigate: (pageId: PageId) => void` prop。
- `App.tsx` 的 `pageMap` 由预编译 JSX 元素改为渲染函数:`pageMap: Record<PageId, (nav: NavigateFn) => ReactElement>`,在 `App` 渲染处把 `navigate` 注入每个页面。hash 路由核心不动。
- 锚点跳转(`config#geofence`):首页卡片点击时 `navigate('config')` + 写 `useUiStore.scrollAnchor`;ConfigPage `useEffect` 读到后滚动到对应区块并消费。

## 路由与类型变更

- `PageId` 扩 5 值:`home / messages / scenes / membership / profile`。
- `ALL_PAGE_IDS` 同步;`overview` 退役(从白名单移除,pageMap 删除,OverviewPage 组件可保留供首页复用其行程卡逻辑或删除——决策:删除,行程卡逻辑迁入 HomePage)。
- `useHashRouter.parseHash` 白名单加 5 新页;空/非法落地由 `overview` 改为 `home`;`!onboardingDone → config` 不变。
- `zhCN.pages` 加 5 文案;新增 `zhCN.bottomNav`(5 Tab)与 `zhCN.home`(SOS/四栏/AI 文案)。

## 数据/状态新增

- `useHomeStore`(Zustand + persist,localStorage key `safety_v2_home`):
  - `slots: [HomeSlotKey, HomeSlotKey, HomeSlotKey, HomeSlotKey]`
  - `companionEnabled: boolean`
  - `setSlot(index: number, key: HomeSlotKey): void`
  - `setCompanionEnabled(enabled: boolean): void`
- `useUiStore` 加:`scrollAnchor: string | null` + `consumeScrollAnchor(): string | null`。
- `src/domain/companion.ts`:预留空接口/枚举(类型契约占位)。

## 测试迁移与新增

### 必须更新(否则会红)

1. **`appShell.test.tsx`**:抽屉从"唯一导航面"改为"辅助页导航面";新增"底栏是主导航面"断言(5 Tab 渲染、点击行为)。
2. **`overviewPage.test.tsx`**:原断言"总览内不得出现 SOS/配置/联系人/历史/轨迹 button"随 overview 退役。其中第 49-53 行的 `queryByRole('button').not` 断言迁移到 `homePage.test.tsx`,语义改为"首页四栏卡为 CardActionArea,不得出现直达子页的独立 nav button(role=tab/aria-label 为导航)"。
3. **`useHashRouter`**:白名单加 5 新页;落地改 `home`。
4. **`NavigationDrawer`**:精简为辅助页 + 开发者工具。

### 新增

- `homePage.test.tsx`:大 SOS 触发倒计时、未配置→一键配置跳转、四栏渲染与自定义、AI 占位、行程卡跳转。
- `bottomNav.test.tsx`:5 Tab 渲染、消息/场景/我的面板展开、组高亮、点击子项触发 onNavigate + 关闭面板。
- `messagesPanel.test.tsx`:最近事件聚合渲染、空状态。
- `scenesPanel.test.tsx`:4 入口渲染与跳转。
- `membershipPage.test.tsx`:权益卡片 ×4 + 占位文案。
- `homeStore.test.ts`:slots 默认值、setSlot、persist。
- `useUiStore.scrollAnchor` 测试:写入/消费。

## 受影响文件清单

新增:
- `frontend/src/pages/HomePage.tsx`
- `frontend/src/pages/MembershipPage.tsx`
- `frontend/src/components/BottomNav.tsx`
- `frontend/src/components/MessagesPanel.tsx`
- `frontend/src/components/ScenesPanel.tsx`
- `frontend/src/components/ProfilePanel.tsx`
- `frontend/src/components/HomeSosButton.tsx`
- `frontend/src/components/HomeSlotCard.tsx`
- `frontend/src/components/AiCompanionPlaceholder.tsx`
- `frontend/src/stores/useHomeStore.ts`
- `frontend/src/domain/companion.ts`
- 上述对应测试文件

修改:
- `frontend/src/types/index.ts`(PageId / ALL_PAGE_IDS / HomeSlotKey)
- `frontend/src/hooks/useHashRouter.ts`(白名单 + 落地)
- `frontend/src/App.tsx`(pageMap 改渲染函数 + 注入 navigate + 新页)
- `frontend/src/shell/AppShell.tsx`(挂载 BottomNav)
- `frontend/src/shell/NavigationDrawer.tsx`(精简)
- `frontend/src/stores/useUiStore.ts`(scrollAnchor)
- `frontend/src/i18n/zh-CN.ts`(文案)
- `frontend/src/pages/SosPage.tsx`(未配置→一键配置跳转)
- `frontend/src/pages/ConfigPage.tsx`(scrollAnchor 消费)
- `frontend/src/pages/OverviewPage.tsx`(退役/删除)
- `frontend/src/test/appShell.test.tsx`
- `frontend/src/test/overviewPage.test.tsx`(迁移/删除)
- README.md(能力边界/版本表后续随发版更新)

## 验证

- `npm run check`:typecheck + lint + 全量测试 + build 全绿。
- 新增测试覆盖:首页、底栏、3 面板、会员页、homeStore、scrollAnchor。
- 浏览器/模拟器手测:底栏 5 Tab、面板展开/关闭、首页大 SOS 倒计时、四栏跳转、未配置一键配置、AI 占位。
- 按既定发版流程发 v0.7.0(功能版本号 +0.1)。
