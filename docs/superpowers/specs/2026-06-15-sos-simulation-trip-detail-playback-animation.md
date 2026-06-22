# v0.4.32 SOS 模拟训练 + 行程历史详情 + 回放动画播放

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 增加 SOS 模拟训练模式让用户熟悉操作流程而不触发真实动作；为行程历史补充事件时间线详情视图；为轨迹回放增加逐点动画播放控制。

**Architecture:** 纯本地，无新增依赖。SOS 训练复用现有倒计时 hook 但走模拟分支；行程详情在 TripHistoryPage 内展开；回放动画在 PlaybackPage 内增加播放状态和定时器。

**Tech Stack:** React + TypeScript + MUI + Zustand（现有技术栈，无新增依赖）。

---

## 1. 范围

### 1.1 本次要做

**SOS 模拟训练模式：**

- SOS 页面新增"模拟训练"按钮。
- 点击后启动 5 秒倒计时，可取消。
- 倒计时结束后展示模拟结果：
  - 定位步骤：标记为"训练模式 - 模拟定位成功"
  - 持久化步骤：标记为"训练模式 - 模拟记录"
  - 短信步骤：标记为"训练模式 - 未发送短信"
  - 电话步骤：标记为"训练模式 - 未拨打电话"
  - 最终状态：`finalStatus: 'success'`，`finalLabel: '训练完成'`
  - 摘要："这是一次模拟训练，未拨打电话或发送短信。"
- 模拟训练不调用任何原生桥（不拨号、不发短信、不采样轨迹）。
- 模拟训练不写入 SOS 历史记录。
- 模拟训练结果展示后可"重新训练"或"返回"。

**行程历史详情：**

- TripHistoryPage 中点击行程条目展开/收起事件时间线。
- 时间线展示每个 `SafetyTripEvent`：
  - 事件类型标签（创建 / 延长 / 到达 / 取消 / 超时记录）
  - 时间戳
  - 详情（如果有）
- 时间线按时间顺序排列。
- 同一时间线内使用不同图标/颜色区分事件类型。

**回放动画播放：**

- 回放页新增播放控制栏：播放/暂停按钮 + 倍速选择（1x / 2x / 4x）。
- 播放时按时间顺序逐点高亮当前点，其余点保持正常显示。
- 当前点用更大尺寸或外圈光环标记。
- 播放到达最后一个点时自动暂停。
- 倍速控制每个轨迹点之间的停留时间（1x = 1s, 2x = 0.5s, 4x = 0.25s）。

### 1.2 本次不做

- 不做 SOS 模拟训练的历史记录持久化。
- 不做 SOS 模拟训练的自定义场景配置。
- 不做行程历史的删除或导出。
- 不做回放动画的进度条拖拽。
- 不做回放动画的反向播放。
- 不新增依赖。

## 2. 用户体验

### 2.1 SOS 模拟训练

- SOS 页面在现有"快速操作"卡片下方新增"模拟训练"卡片。
- 卡片内容：
  - 说明文字："模拟训练不会拨打电话或发送短信，帮助你熟悉 SOS 操作流程。"
  - "开始模拟训练"按钮
- 点击后进入 5 秒倒计时（与真实 SOS 相同的 UI）。
- 倒计时结束 → 展示模拟结果（步骤状态 + 摘要）。
- 结果区底部：
  - "重新训练"按钮
  - "返回"按钮（清除模拟结果，回到初始状态）

### 2.2 行程历史详情

- 行程历史列表中每个条目可点击展开。
- 展开后显示事件时间线：
  - 每个事件一行
  - 左侧图标（创建=播放箭头, 延长=时钟, 到达=对勾, 取消=X, 超时=警告）
  - 右侧：事件类型 + 时间 + 详情
- 再次点击收起。

### 2.3 回放动画播放

- 地图卡片下方新增播放控制栏。
- 播放按钮（三角形图标）→ 点击开始播放。
- 播放中变为暂停按钮（双竖线图标）。
- 倍速选择：1x / 2x / 4x（Chip 或 ToggleButton）。
- 当前播放点在地图上用更大尺寸 + 外圈光环标记。
- 播放进度：显示"3 / 12"（当前点 / 总点数）。
- 播放到最后一个点自动暂停。

## 3. 数据模型

### 3.1 SOS 模拟训练

新增 `SimulationResult` 类型（domain 层）：

```ts
export interface SimulationResult {
  steps: {
    location: { label: string, detail: string, tone: 'success', badge: string }
    persistence: { label: string, detail: string, tone: 'success', badge: string }
    sms: { label: string, detail: string, tone: 'idle', badge: string }
    call: { label: string, detail: string, tone: 'idle', badge: string }
  }
  summary: string
}
```

或者直接复用 `SosResult` 类型，标记 `finalLabel: '训练完成'`。

建议复用 `SosResult`，在 domain 层新增 `createSimulationResult()` 函数。

### 3.2 行程历史详情

无需新增数据模型。复用 `SafetyTripEvent`。

### 3.3 回放动画播放

无需新增 domain 类型。在 PlaybackPage 内增加 `playbackIndex` 和 `isPlaying` 状态。

## 4. 实现方案

### 4.1 SOS 模拟训练

- `frontend/src/domain/sosState.ts` 新增 `createSimulationResult(): SosResult`
- `frontend/src/hooks/useSosCountdown.ts` 无需修改（倒计时逻辑不变）
- `frontend/src/pages/SosPage.tsx`：
  - 新增 `simulationMode` 状态
  - 新增 `handleSimulationTrigger`：设置 simulationMode = true，启动倒计时
  - 倒计时的 `onElapsed` 回调：如果 simulationMode，调用 `createSimulationResult()` 并设置到 store 的 `sosResult`
  - 模拟结果不写入历史
  - 新增"模拟训练"卡片 UI

### 4.2 行程历史详情

- `frontend/src/pages/TripHistoryPage.tsx`：
  - 新增 `expandedId` 状态
  - 点击 ListItem 切换展开
  - 展开时渲染事件时间线（`Collapse` + `Stack`）

### 4.3 回放动画播放

- `frontend/src/pages/PlaybackPage.tsx`：
  - 新增 `isPlaying`、`playbackIndex`、`playbackSpeed` 状态
  - `useEffect` + `setInterval` 控制播放
  - 当前点标记：更大尺寸 + 外圈光环
  - 播放控制栏 UI

## 5. 测试策略

新增单元测试：

- `sosState.test.ts`：扩展 `createSimulationResult` 测试。
- `sosPage.test.tsx`：模拟训练流程测试（启动、倒计时、结果展示）。
- `tripHistoryPage.test.tsx`：扩展点击展开/收起事件时间线测试。
- `playbackPage.test.tsx`：扩展播放控制、倍速选择测试。

验证命令：

- 相关测试：`npx vitest run src/test/sosState.test.ts src/test/sosPage.test.tsx src/test/tripHistoryPage.test.tsx src/test/playbackPage.test.tsx`
- 全量前端：`npm run check`
- 发布闸口：`npm run check:full && npm run android:release`

## 6. 发布要求

- 版本升级到 `0.4.32`：`frontend/package.json` 和 `frontend/package-lock.json`。
- README 事实表、已落地能力、回归基线同步更新。
- 无新增依赖。
- Release notes 明确：模拟训练不触发真实动作。

## 7. 验收标准

1. SOS 页面有"模拟训练"入口，点击后启动 5 秒倒计时。
2. 倒计时结束后展示模拟结果，步骤标记为"训练模式"。
3. 模拟训练不调用原生桥，不写入 SOS 历史。
4. 模拟结果可"重新训练"或"返回"。
5. 行程历史列表条目可点击展开事件时间线。
6. 时间线展示事件类型、时间、详情。
7. 回放页有播放/暂停按钮和倍速选择（1x/2x/4x）。
8. 播放时当前点用更大尺寸 + 光环标记。
9. 显示播放进度（当前点 / 总点数）。
10. 播放到最后一个点自动暂停。
11. `npm run check:full && npm run android:release` 通过。