# v0.4.30 本地通知集成 + 总览仪表盘 UX 打磨

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为独行青年安全 App 增加本地设备通知能力，让安全行程提醒和本地风险提示在应用存活期间通过系统通知触达用户；同时打磨总览页仪表盘，提升可读性和操作引导。

**Architecture:** 纯本地能力。新增 `@capacitor/local-notifications` 插件桥接通知，通知调度由 data/repo 层封装，stores/domain 层决策触发时机。总览页 UI 改造集中在 OverviewPage 组件内部和现有 components/ 目录。

**Tech Stack:** React + TypeScript + MUI + Zustand + `@capacitor/local-notifications` + 现有 `frontend/src/data/storage.ts` 本地持久化；Android 仍通过现有 Capacitor 壳构建。

---

## 1. 范围

### 1.1 本次要做

**本地通知：**

- 新增 `@capacitor/local-notifications` 依赖，在 Android 壳中启用通知渠道。
- 新增 `frontend/src/data/localNotificationRepo.ts`：封装通知权限请求、通知调度、已调度通知管理。
- 新增 `frontend/src/domain/notificationChannels.ts`：定义通知触发条件（行程即将超时、风险状态变化）。
- 行程超时前（默认提前 5 分钟）调度一条本地通知，提醒用户即将超时。
- 总览风险状态变化时调度一条本地通知（仅当风险等级升高）。
- 配置页新增"本地通知"卡片，包含：启用/关闭通知总开关、行程超时提醒开关、风险变化提醒开关、行程通知提前时间（1/5/10/15 分钟）。
- 通知内容明确标注"仅本地提醒，不自动报警"。
- 通知渠道名称使用中文、描述安全边界。

**总览仪表盘 UX 打磨：**

- 页面顶部新增全局风险等级指示器（色块 + 文字：安全 / 注意 / 警告）。
- 风险卡片列表改为可折叠分组（轨迹风险、配置风险、行程风险、围栏风险）。
- 无数据时展示空态引导（"暂无风险"不同分组展示对应引导文字）。
- 安全行程卡片位置调整到风险卡片上方（优先级更高）。
- 卡片使用 MUI Paper 统一内边距和圆角，各卡片高度和视觉权重对齐。
- 新增总览页面标题栏小提示："所有提示仅本地，不会自动通知联系人"。

### 1.2 本次不做

- 不做远程推送通知（Push Notifications）。
- 不做后台保活通知（如前台服务常驻通知栏）。
- 不做通知点击跳转到特定页面（当前仅展示通知内容）。
- 不做通知频道自定义铃声或震动模式。
- 不承诺通知在 Android force-stop、最近任务划掉或系统深度休眠后送达。
- 不改动现有导航/路由结构。
- 不新增页面，仅改造现有总览页组件。
- 不做图表或数据可视化。

## 2. 用户体验

### 2.1 本地通知体验

**权限：**

- 首次触发通知时请求 `Permissions.request()`（Android 13+ 需要 `POST_NOTIFICATIONS` 权限）。
- 权限被拒绝时通知调度静默跳过，不影响其他功能。
- 配置页展示通知权限状态和引导文字。

**行程超时提醒：**

- 创建行程时，根据 `expectedArrivalAt - leadMinutes` 调度一条本地通知。
- 通知标题："安全行程即将超时"
- 通知正文："{destination} 预计 {time} 到达，请确认安全。仅本地提醒，不自动报警。"
- 用户确认到达或取消行程后，自动取消该通知。
- 用户延长行程后，重新调度通知。

**风险变化提醒：**

- 总览风险等级从"无风险"变为"有风险"时（或等级升高时），调度一条通知。
- 通知标题："安全提示"
- 通知正文："检测到新的本地安全提示，请查看总览页。仅本地提醒，不自动报警。"
- 通知频率控制：同一风险项在 30 分钟内不重复通知（防抖）。

**配置页控制（可关闭每个类型）：**

- 总开关：启用/关闭所有本地通知。
- 行程超时提醒：开关 + 提前时间（1/5/10/15 分钟）。
- 风险变化提醒：开关。

### 2.2 总览仪表盘打磨

**顶部风险等级指示器：**

```
[ (色块) 安全 所有检查正常 ]
[ (色块) 注意 存在一些需要注意的项目 ]
[ (色块) 警告 存在需要立即关注的风险 ]
```

- 色块颜色：安全 → `success.main`（绿）、注意 → `warning.main`（黄）、警告 → `error.main`（红）。
- 文案跟随当前 `aggregateRiskData.level`。

**可折叠风险分组：**

- 现有 `riskItems` 按 `rule` 类别分组（轨迹、配置、围栏、安全行程）。
- 每个分组默认展开，但可折叠。
- 分组标题显示该项的风险小计。
- 分组使用 MUI `Accordion` 或自定义折叠组件（轻量自实现以避免 MUI Accordion 的额外样式影响）。

**空态：**

- 每个分组在无风险时显示简短正面文字："轨迹追踪正常"、"配置完整"、"暂无围栏事件"、"无进行中行程"。

**卡片布局：**

- 安全行程卡片提到风险卡片组上方，单独占据一个区域。
- 原有风险卡片（`riskLevel` + `riskItems`）整合为统一的风险区域。
- 使用 `Stack` 或 `Grid` 控制间距和对齐。
- 所有卡片内边距统一为 `{ xs: 2, sm: 3 }`。

**全局提示：**

- 总览页标题下方增加一行灰色小字："所有提示仅本地生成，不会自动通知联系人或触发 SOS。"

## 3. 数据模型

### 3.1 通知配置

新增 `frontend/src/domain/notificationChannels.ts`：

```ts
export type NotificationType = 'tripExpiring' | 'riskElevated'

export interface NotificationConfig {
  enabled: boolean
  tripExpiring: {
    enabled: boolean
    leadMinutes: 1 | 5 | 10 | 15
  }
  riskElevated: {
    enabled: boolean
  }
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
```

### 3.2 通知事件记录

用于防抖和取消通知：

```ts
export interface ScheduledNotification {
  id: string
  type: NotificationType
  scheduleAt: string
  tripId?: string
  fired: boolean
}
```

### 3.3 TotalRiskInput 扩展

当前 `aggregateRiskData` 已接受完整 input。无需变更 input 结构，只需在总览页包装时处理通知触发逻辑。

## 4. 持久化

新增 `frontend/src/data/localNotificationRepo.ts`：

- `requestNotificationPermission(): Promise<'granted' | 'denied' | 'prompt'>`
- `scheduleTripExpiryNotification(trip: SafetyTrip, leadMinutes: number): Promise<string>` — 返回通知 ID
- `scheduleRiskNotification(): Promise<string>`
- `cancelNotification(id: string): Promise<void>`
- `cancelAllTripNotifications(): Promise<void>`

存储 key（本地配置）：

- `safety_v2_notification_config` — `NotificationConfig`

## 5. 状态管理

新增或扩展 store：

**方案：扩展 `useSafetyTripStore`** 以包含通知调度：

- 创建行程时：根据 config 调度超时通知。
- 确认到达 / 取消时：取消对应的超时通知。
- 延长时：取消旧通知 + 调度新通知。

**新增通知配置 store 或复用配置页状态：**

- `useNotificationConfigStore`（新增）：加载/保存 `NotificationConfig`，提供 toggle 和 leadMinutes 更新。
- 或者直接扩展配置页读取 `NotificationConfig` 并使用现有 store 模式。

建议独立 store，职责清晰：`frontend/src/stores/useNotificationConfigStore.ts`。

## 6. 总览页改造

### 6.1 布局变更

当前结构：
```
[ 风险卡片（等级 + 风险项列表） ]
[ 安全行程卡片 ]
```

新结构：

```
[ 全局提示行 ]
[ 安全行程卡片 ] — 提到最上方
[ 风险等级指示器 ] — 色块 + 文案
[ 风险卡片组 ] — 可折叠分组
  ├ [ 轨迹风险 ] (风险项列表 / 空态)
  ├ [ 配置风险 ] (风险项列表 / 空态)
  ├ [ 围栏风险 ] (风险项列表 / 空态)
  └ [ 行程风险 ] (风险项列表 / 空态)
```

### 6.2 组件拆分建议

如果 OverviewPage 内单个组件过大，可以拆出：

- `RiskLevelIndicator.tsx` — 顶部色块 + 文案
- `RiskGroupCard.tsx` — 一个可折叠的风险分组
- `EmptyRiskGroup.tsx` — 分组空态
- `DashboardDisclaimer.tsx` — 底部声明行

**不做跨页面路由改动。**

## 7. 错误处理

- 通知权限被拒绝：静默跳过通知调度，配置页展示权限状态。
- Capacitor Local Notifications 插件在 Web 端不可用（开发环境）：repo 层在非 Capacitor 环境返回 mock，通知调度静默跳过。
- 通知调度失败（系统限制）：静默跳过，不影响其他功能。
- localStorage 读取失败：配置回退到 `DEFAULT_NOTIFICATION_CONFIG`。
- 无当前行程时取消通知：容错处理，不抛异常。

## 8. 测试策略

新增单元测试：

- `notificationChannels` domain：默认配置、配置合并。
- `localNotificationRepo`：mock `@capacitor/local-notifications`，测试调度/取消。
- `notificationConfigStore`：加载、保存、toggle。
- `OverviewPage` 布局变更：渲染顺序、折叠/展开、空态文本。
- `RiskLevelIndicator`：不同等级渲染不同色块和文案。
- `RiskGroupCard`：分组渲染、风险项列表、空态。

验证命令：

- 相关测试：`npx vitest run src/test/notificationChannels.test.ts src/test/localNotificationRepo.test.ts src/test/overviewPage.test.tsx`
- 全量前端：`npm run check`
- 发布闸口：`npm run check:full && npm run android:release`

## 9. 发布要求

- 版本升级到 `0.4.30`：`frontend/package.json` 和 `frontend/package-lock.json`。
- README 事实表、已落地能力、回归基线同步更新。
- Android 产物命名应包含 `v0.4.30`。
- Release notes 必须明确：
  - 本地通知仅在应用存活期间有效，不承诺 force-stop 后送达。
  - 通知内容不包含用户精确位置或联系人信息。
  - 所有通知可分别关闭。
- 新增依赖 `@capacitor/local-notifications` 需在 `npm install` 后同步 Android 壳。

## 10. 验收标准

v0.4.30 完成时必须满足：

1. 通知权限在首次调度时请求，拒绝后不打断其他功能。
2. 创建安全行程后，在预计到达前指定时间收到本地通知。
3. 确认到达或取消后，已调度的通知被取消。
4. 延长行程后，通知重新调度。
5. 总览风险升级时收到一条本地通知。
6. 配置页可分别关闭行程超时 / 风险变化通知。
7. 总览页顶部显示风险等级色块指示器。
8. 风险卡片按类别分组，可折叠，无风险时显示空态。
9. 安全行程卡片位于风险卡片上方。
10. 全局提示行展示"所有提示仅本地"声明。
11. `npm run check:full && npm run android:release` 通过，并生成 debug APK、release APK、release AAB。
12. Web 开发模式下（无 Capacitor）通知调度静默跳过，不报错。