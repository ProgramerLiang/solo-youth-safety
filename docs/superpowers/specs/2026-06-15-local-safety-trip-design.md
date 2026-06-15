# v0.4.29 本地安全行程 / 守护倒计时设计

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为独行、晚归、打车、夜跑等短时场景增加一个本地安全行程倒计时，让用户手动确认“已安全到达”，并在未确认时只产生本地风险提示。

**Architecture:** 采用纯本地能力：domain 层负责行程状态机和风险派生，data 层负责本地持久化，pages/stores 负责创建、确认、延长、取消和展示。该功能复用现有总览风险卡、诊断导出、快照和配置能力边界，不引入后台保活、远端同步、自动短信、自动电话或自动 SOS。

**Tech Stack:** React + TypeScript + MUI + Zustand + 现有 `frontend/src/data/storage.ts` 本地持久化；Android 仍通过现有 Capacitor 壳构建。

---

## 1. 范围

### 1.1 本次要做

- 在前端新增“安全行程”能力，面向短时出行场景。
- 用户手动创建一个当前行程：目的地名称、预计到达时间、可选备注。
- 当前行程在应用存活期间显示倒计时；刷新或重启后从本地存储恢复。
- 用户可手动执行：确认到达、延长 10 分钟、取消行程。
- 到点后如果未确认，只在本地派生并显示“行程超时未确认”风险项；不要求后台定时写入状态。
- 行程确认到达或取消后写入本地历史；超时中的行程仍保留为当前行程，直到用户确认到达或取消。
- 诊断导出和本地快照包含脱敏后的行程摘要。
- README、版本号、测试和 Android release gate 跟随 v0.4.29 更新。

### 1.2 本次不做

- 不做自动 SOS。
- 不做自动短信、自动电话、自动上报。
- 不做后台常驻、前台服务、force-stop 后恢复。
- 不做实时地图监护。
- 不做联系人自动通知。
- 不接后端，不新增账号体系，不新增远端 API。
- 不保存精确目的地坐标；目的地只是用户输入的文本名称。

## 2. 用户体验

### 2.1 入口

优先在现有页面中接入，避免新增复杂导航：

- 总览页新增“安全行程”卡片，展示当前行程状态和主操作。
- 如当前无行程，卡片展示“创建安全行程”。
- 如已有进行中行程，卡片展示目的地、剩余时间、预计到达时间、备注摘要，以及“已到达 / 延长 10 分钟 / 取消”。
- 如行程已超时，卡片强调“超时未确认”，但文案必须明确“仅本地提醒”。

如果总览页卡片过长，第二步再拆到独立页面；v0.4.29 第一版不新增导航页面。

### 2.2 创建表单

字段：

- `目的地名称`：必填，1-40 个可见字符，去除首尾空白。
- `预计时长`：必填，快捷选项 15 / 30 / 45 / 60 分钟，并允许手动输入 5-240 分钟。
- `备注`：可选，最多 120 个字符。

创建成功后立即成为当前行程，并显示倒计时。

### 2.3 状态和文案

行程状态：

- `active`：进行中，未到预计时间。
- `overdue`：已超过预计时间但用户未确认。
- `arrived`：用户手动确认到达。
- `extended` 不是独立终态；延长只是更新预计到达时间并追加事件。
- `cancelled`：用户手动取消。

状态派生约定：

- `active` / `arrived` / `cancelled` 是用户动作或创建时写入的持久化状态。
- `overdue` 是基于 `expectedArrivalAt` 和当前设备时间派生出的展示 / 风险状态；应用恢复后重新计算，不依赖后台定时器。
- 如果用户在超时后点击“已到达”，历史终态记录为 `arrived`，事件里保留到达时间；如果点击“取消”，历史终态记录为 `cancelled`。

关键文案：

- 创建说明：“安全行程只在本机记录和提醒，不会自动通知联系人。”
- 超时说明：“行程已超时未确认。请手动确认状态；当前版本不会自动发送 SOS。”
- 取消说明：“取消只结束本地行程记录，不会删除历史。”

## 3. 数据模型

新增 `frontend/src/domain/safetyTrip.ts`：

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
```

Domain 层提供纯函数：

- `createSafetyTrip(input, now): SafetyTrip`
- `deriveSafetyTripStatus(trip, now): SafetyTripStatus`
- `extendSafetyTrip(trip, minutes, now): SafetyTrip`
- `markSafetyTripArrived(trip, now): SafetyTrip`
- `cancelSafetyTrip(trip, now): SafetyTrip`
- `summarizeSafetyTripForDiagnostics(trip): object`

ID 用现有测试可控的本地生成方式；如果当前项目没有统一 ID 工具，则在 data/store 层注入 `now` 和 `id`，domain 保持纯函数。

## 4. 持久化

新增 `frontend/src/data/safetyTripRepo.ts`：

- `loadCurrentSafetyTrip(): Promise<SafetyTrip | null>`
- `saveCurrentSafetyTrip(trip: SafetyTrip | null): Promise<void>`
- `loadSafetyTripHistory(): Promise<SafetyTrip[]>`
- `appendSafetyTripHistory(trip: SafetyTrip): Promise<void>`

存储 key：

- `safety_v2_current_trip`
- `safety_v2_trip_history`

历史保留最近 50 条，按 `createdAt` 倒序或追加顺序稳定展示。若读取到坏数据，repo 返回安全默认值并不抛出到 UI。

## 5. 状态管理

新增或扩展一个 store，优先新增 `frontend/src/stores/useSafetyTripStore.ts`，避免把总览页变成持久化入口。

Store 职责：

- 初始化时加载当前行程和历史。
- 创建行程后保存 current。
- 确认到达 / 取消后将行程写入历史并清空 current。
- 延长后保存 current。
- 提供 `currentStatus(now)` 或直接提供派生状态给页面。

Store 不直接调用 native，不接远端 API。

## 6. 风险接入

扩展 `frontend/src/domain/riskAssessment.ts` 的输入：

```ts
safetyTrip?: SafetyTrip | null
```

规则：

- 当前行程存在且 `deriveSafetyTripStatus(trip, now) === 'overdue'` 时，新增风险项：
  - `rule: 'safetyTrip'`
  - `level: 'warning'`
  - 标题：“安全行程超时未确认”
  - 详情包含目的地和超时分钟数，但不包含敏感坐标。
- 该风险项只进入总览风险提示，不触发任何自动动作。

如果后续需要可配置，v0.4.29 不新增独立规则开关；先固定为本地提示。这样避免配置页继续膨胀。

## 7. 诊断和快照

诊断报告新增脱敏摘要：

```ts
safetyTrip: {
  hasCurrentTrip: boolean
  currentStatus: SafetyTripStatus | null
  historyCount: number
  lastTripStatus: SafetyTripStatus | null
}
```

不得导出完整备注文本、联系人号码、精确坐标或用户输入的敏感长文本。目的地名称可在本地 UI 展示，但诊断导出只输出是否存在目的地和长度，例如 `destinationLength`。

本地快照用于用户手动备份，允许包含完整本地数据；导出仍是用户主动操作，不自动上传。

## 8. 错误处理

- 创建时目的地为空：阻止提交，提示“请输入目的地名称”。
- 预计时长小于 5 或大于 240：阻止提交，提示“预计时长需在 5 到 240 分钟之间”。
- 当前已有行程时再次创建：不允许覆盖；先确认、延长或取消当前行程。
- localStorage 读取失败：UI 显示空状态，诊断摘要记录存储不可用；不阻断其他页面。
- 时间被系统调整：按当前设备时间重新派生状态，不尝试校正网络时间。

## 9. 测试策略

新增单元测试：

- `safetyTrip` domain：创建、超时派生、延长、到达、取消、边界时长。
- `safetyTripRepo`：空存储默认值、保存 / 加载 current、历史最多保留 50 条、坏数据回退。
- `riskAssessment`：安全行程未超时不产生风险；超时产生本地风险项；风险详情不包含坐标。
- `OverviewPage`：无行程显示创建入口；创建后显示倒计时；超时显示本地提醒；确认到达后风险消失。
- `diagnostics`：导出包含脱敏行程摘要，不包含完整备注和目的地文本。

验证命令：

- 相关测试：`npx vitest run src/test/safetyTrip.test.ts src/test/safetyTripRepo.test.ts src/test/riskAssessment.test.ts src/test/overviewPage.test.tsx src/test/diagnostics.test.ts`
- 全量前端：`npm run check`
- 发布闸口：`npm run check:full && npm run android:release`

## 10. 发布要求

- 版本升级到 `0.4.29`：`frontend/package.json` 和 `frontend/package-lock.json`。
- README 事实表、已落地能力、回归基线和 release 说明同步更新。
- Android 产物命名应包含 `v0.4.29`。
- Release notes 必须明确：安全行程是本地提醒，不自动通知联系人，不自动 SOS，不保证后台 / force-stop 后继续倒计时提醒。

## 11. 验收标准

v0.4.29 完成时必须满足：

1. 用户可创建一个当前安全行程，并看到剩余时间。
2. 用户可确认到达、延长 10 分钟、取消。
3. 行程超时时，总览风险卡出现“安全行程超时未确认”。
4. 确认到达或取消后，当前行程清空并进入历史。
5. 刷新页面后，当前行程和历史保持一致。
6. 诊断导出只包含脱敏行程摘要。
7. 没有自动短信、自动电话、自动 SOS、远端上传或后台保活承诺。
8. `npm run check:full && npm run android:release` 通过，并生成 debug APK、release APK、release AAB。
