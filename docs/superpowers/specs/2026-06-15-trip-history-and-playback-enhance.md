# v0.4.31 安全行程历史 + 轨迹回放增强

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 补全安全行程历史列表 UI，让用户回顾已完成的行程；增强轨迹回放页，增加点位详情、缩放和速度可视化。

**Architecture:** 纯本地，无新增后端依赖。行程历史复用现有 `safetyTripRepo` 数据层；回放增强在现有 `PlaybackPage` 组件内扩展，复用 `playback.ts` 和 `movementAnalysis.ts` domain。

**Tech Stack:** React + TypeScript + MUI + Zustand（现有技术栈，无新增依赖）。

---

## 1. 范围

### 1.1 本次要做

**安全行程历史：**

- 新增 `frontend/src/pages/TripHistoryPage.tsx`：展示已归档行程列表（已到达、已取消、已超时）。
- 每个历史条目展示：目的地、状态标签、创建时间、预计到达时间、事件摘要。
- 列表按创建时间倒序排列。
- 空态：无历史行程时展示引导文字。
- 导航侧边栏新增"行程历史"入口。
- 新增 `PageId` 类型 `'tripHistory'`。

**轨迹回放增强：**

- 点位点击展示详情浮层：时间、经纬度、精度、来源（轨迹/SOS）。
- 缩放控制：+/- 按钮调整 SVG 画布缩放比例（0.5x–3x）。
- 速度颜色编码：根据相邻轨迹点速度给轨迹点标注颜色（低速绿 / 中速黄 / 高速红）。
- 回放底部新增移动摘要卡片：总距离、平均速度、静止时段数。
- 回放无数据时展示与现有 EmptyState 一致的空态。

### 1.2 本次不做

- 不做行程历史导出或删除。
- 不做行程历史与诊断报告的联动。
- 不做回放页面动画播放（逐点推进）。
- 不做回放页面地图 SDK 替换（保持 CSS/SVG 方案）。
- 不做回放页面的实时数据接入。
- 不新增依赖。

## 2. 用户体验

### 2.1 行程历史

- 从侧边栏进入"行程历史"页面。
- 页面标题："安全行程历史"。
- 列表每项展示：
  - 目的地（脱敏：仅展示名称，无坐标）
  - 状态标签：`已完成`（绿色）/ `已取消`（灰色）/ `已超时`（红色）
  - 创建时间：`2026-06-15 12:00`
  - 预计到达时间：`2026-06-15 12:30`
  - 事件数：`N 条事件`
- 空态：中央展示"暂无安全行程记录"。

### 2.2 回放增强

- 缩放控制：地图画布右上角 +/- 按钮，点击缩放 SVG 视图。
- 点位点击：点击地图上的轨迹点/SOS 点，在底部/侧边弹出详情浮层。
- 详情浮层内容：
  - 角色标签（开始点/轨迹点/SOS/结束点）
  - 时间
  - 经纬度（5 位小数）
  - 精度（如果有）
  - 来源（轨迹采样 / SOS 事件）
- 速度颜色：轨迹点根据与前一点的推算速度着色：
  - < 5 km/h：绿色
  - 5–30 km/h：黄色
  - > 30 km/h：红色
- 移动摘要卡片：总距离、平均速度、静止时段数。

## 3. 数据模型

### 3.1 行程历史

无需新增数据模型。复用现有 `SafetyTrip` 和 `safetyTripRepo`。

### 3.2 回放增强

扩展 `PlaybackPoint`（domain 层）：

```ts
export interface PlaybackPoint {
  // ... existing fields
  speedKmh?: number  // 新增：与前一点的推算速度
}
```

新增 `PlaybackDetail` 类型（组件内或 domain 层）：

```ts
export interface PlaybackDetail {
  point: PlaybackPoint
  speedKmh: number | null
  distanceFromPrevM: number | null
}
```

## 4. 页面与组件

### 4.1 TripHistoryPage

- 从 `safetyTripRepo.loadSafetyTripHistory()` 加载数据。
- 使用 MUI `List` + `ListItem` 展示。
- 每项使用 `Chip` 展示状态。
- 空态使用 `EmptyState` 组件。

### 4.2 PlaybackPage 增强

- 新增 `PlaybackZoomControls`：`IconButton` + `Chip` 显示当前缩放倍率。
- 新增 `PlaybackPointDetail`：`Popover` 或 `Paper` 浮层展示选中点详情。
- 新增 `PlaybackSpeedLegend`：图例说明速度颜色编码。
- 新增 `PlaybackMovementSummary`：复用 `computeMovementSummary` 展示总距离/平均速度/静止时段。

## 5. 测试策略

新增单元测试：

- `tripHistoryPage.test.tsx`：渲染列表、空态、状态标签、导航入口。
- `playback.test.ts`：扩展 `buildPlaybackRoute` 测试覆盖速度字段。
- `playbackPage.test.tsx`：扩展测试覆盖缩放控制、点位点击、速度颜色、移动摘要卡片。

验证命令：

- 相关测试：`npx vitest run src/test/tripHistoryPage.test.tsx src/test/playback.test.ts src/test/playbackPage.test.tsx`
- 全量前端：`npm run check`
- 发布闸口：`npm run check:full && npm run android:release`

## 6. 发布要求

- 版本升级到 `0.4.31`：`frontend/package.json` 和 `frontend/package-lock.json`。
- README 事实表、已落地能力、回归基线同步更新。
- 无新增依赖。
- Release notes 明确：行程历史仅本地存储，回放增强仅本地数据。

## 7. 验收标准

1. 侧边栏有新入口"行程历史"，点击进入行程历史页面。
2. 有已归档行程时展示列表，每项含目的地、状态标签、时间、事件数。
3. 无历史行程时展示空态。
4. 回放页有 +/- 缩放按钮，可调整画布缩放（0.5x–3x）。
5. 点击轨迹点展示详情浮层（时间、坐标、精度、来源）。
6. 轨迹点按速度着色（绿/黄/红）。
7. 回放页底部展示移动摘要卡片（总距离、平均速度、静止时段数）。
8. `npm run check:full && npm run android:release` 通过。