# 智能规则（Smart Rules）规格文档

> 日期：2026-06-29  
> 状态：已确认  
> 关联：0.5.0 Release → 下一轮 P2 落地

## 1. 定位

"智能规则"是一个本地可配置的触发-动作链路系统。它串联项目已有的风险信号基础设施（风险等级、安全行程状态、地理围栏、移动分析），让用户在同一能力边界内设定自动化行为——触发本机通知或预武装 SOS 倒计时。

**仍然不自动触发 SOS**：预武装 SOS 会打开倒计时页面，用户可以在 5 秒内取消。

**仍然只做本地**：所有规则评估和动作执行完全在本地完成，不依赖远端后端/API。

## 2. 核心数据模型

### 2.1 AutomationRule

```typescript
interface AutomationRule {
  id: string
  name: string                 // 用户自定义名称
  enabled: boolean             // 是否启用
  conditions: RuleCondition[]  // 条件列表，全部 AND 连接
  actions: RuleAction[]        // 动作列表，全部执行
  cooldownMinutes: number      // 冷却间隔（分钟），默认 5
  lastFiredAt: number | null   // 上次触发时间戳
}
```

### 2.2 RuleCondition

```typescript
type RuleSignal =
  | 'riskLevel'          // 风险等级
  | 'tripStatus'         // 安全行程状态
  | 'tripOvertimeMinutes' // 行程超时持续（分钟）
  | 'geofenceEvent'      // 围栏事件
  | 'stationaryMinutes'  // 静止持续（分钟）

type RuleOperator = 'eq' | 'gte' | 'gt'

interface RuleCondition {
  signal: RuleSignal
  operator: RuleOperator
  value: string | number    // 阈值或枚举值
  label: string             // 展示用文本
}
```

### 2.3 RuleAction

```typescript
type RuleActionType =
  | 'localNotification'  // 本机通知
  | 'preArmSos'          // 预武装 SOS 倒计时

interface RuleAction {
  type: RuleActionType
  config: Record<string, string>  // 动作特定配置
  label: string                   // 展示用文本
}
```

对于 `localNotification`，`config` 包含：
- `title`: 通知标题
- `body`: 通知正文模板（支持 `{ruleName}` 等变量）

对于 `preArmSos`，当前无需额外配置（直接调用现有 `useSosStore.arm()`）。

### 2.4 冷却机制

每条规则记录 `lastFiredAt`。评估时如果距离上次触发未超过 `cooldownMinutes`，跳过该规则。默认 5 分钟，用户可设置为 1/5/15/30/60 分钟。

## 3. v1 能力范围

### 3.1 可用信号

| 信号 | 来源 | 运算符 | 示例值 |
|------|------|--------|--------|
| `riskLevel` | `riskAssessment.aggregateRiskData` | `eq`, `gte` | `attention`, `warning` |
| `tripStatus` | `safetyTrip.deriveSafetyTripStatus` | `eq` | `active`, `overtime`, `arrived`, `cancelled` |
| `tripOvertimeMinutes` | `safetyTrip` | `gt`, `gte` | `5`, `10`, `15`, `30` |
| `geofenceEvent` | `geofence.routeGeofenceEvents` | `eq` | `entered`, `left` + 围栏名称 |
| `stationaryMinutes` | `movementAnalysis` | `gt`, `gte` | `30`, `60`, `120` |

### 3.2 可用动作

| 动作 | 说明 |
|------|------|
| `localNotification` | 触发一条本地通知，支持自定义标题和正文 |
| `preArmSos` | 调用 `useSosStore.arm()`，打开 SOS 5 秒倒计时 |

### 3.3 暂不进入 v1

- 后续信号：采样间断、高速移动、配置缺失、位置过旧
- 后续动作：总览高亮标记、自定义短信、多次连续动作
- 时间段条件（如"仅夜间生效"）
- 规则模板/预设库

## 4. UI 设计

### 4.1 页面结构

- **入口**：侧边栏新增"智能规则"（`PageId: 'smartRules'`）
- **规则列表页**：卡片列表，每张卡片展示规则名、开关、条件/动作摘要
- **编辑界面**：底部 Sheet（MUI Drawer anchor="bottom" 或 Dialog）

### 4.2 规则列表卡片

```
┌─ 夜间行程超时预警 ────── [🔛] ─┐
│ 风险 ≥ attention                │
│ 行程状态 = 超时                 │
│ 超时 > 10 分钟                 │
│ → 🔔通知 + 🚨预武装 SOS         │
└────────────────────────────────┘
```

### 4.3 编辑界面

条件区：每行一个 `RuleCondition`，三栏下拉（信号、运算符、值），行末删除按钮，底部"+ 添加条件"。

动作区：每行一个 `RuleAction`，下拉选动作类型 + 配置字段（通知文案），行末删除按钮，底部"+ 添加动作"。

底部操作："删除规则"（红色）和"保存"。

### 4.4 空态

无规则时展示空态提示："暂无智能规则。创建一条规则，让应用在满足条件时自动提醒你。"

预设示例规则（可选，首次进入时展示）：
- "进入高风险围栏时通知我"
- "行程超时 10 分钟时预武装 SOS"

## 5. 架构与模块边界

### 5.1 新增文件

| 层 | 文件 | 职责 |
|----|------|------|
| domain | `domain/ruleEngine.ts` | 纯函数：`evaluateRule()`, `evaluateAllRules()`, `isRuleOnCooldown()` |
| types | `types/index.ts`（追加） | `AutomationRule`, `RuleCondition`, `RuleAction`, `RuleSignal`, `RuleActionType` |
| data | `data/ruleEngineRepo.ts` | `loadRules()`, `saveRules()`，走 `storage` 抽象 |
| stores | `stores/useRuleEngineStore.ts` | 规则 CRUD、评估调度、冷却追踪、动作分发 |
| pages | `pages/RuleEnginePage.tsx` | 规则列表 + 编辑 Sheet |

### 5.2 修改文件

| 文件 | 变更 |
|------|------|
| `App.tsx` | 注册 `RuleEnginePage` 路由 |
| `types/index.ts` | `PageId` 新增 `'smartRules'`，`ALL_PAGE_IDS` 追加 |
| `shell/NavigationDrawer.tsx` | `pageLabel` 新增映射 |
| `i18n/zh-CN.ts` | 新增 `pages.smartRules` 标签 |
| `pages/OverviewPage.tsx` | 在风险刷新处调用 `useRuleEngineStore.evaluate()` |
| `stores/useSafetyTripStore.ts` | 行程状态变更时调用评估 |
| `stores/useTrackingStore.ts` | 围栏事件触发评估 |

### 5.3 依赖方向

```
pages/RuleEnginePage
    ↓
stores/useRuleEngineStore
    ↓
data/ruleEngineRepo → storage
domain/ruleEngine (纯函数)
domain/riskAssessment, domain/safetyTrip, domain/geofence, domain/movementAnalysis
```

Store 不直接 import native/；页面不直接 import native/或 data/。

### 5.4 评估流程

```
信号源（Overview/行程/围栏）
    ↓ 调用
useRuleEngineStore.evaluate(currentState)
    ↓ 遍历规则
domain/ruleEngine.evaluateRule(rule, state)
    → 检查 enabled
    → 检查 cooldown
    → 逐条件 AND 评估
    → 返回 true/false
    ↓ 对触发的规则
domain/ruleEngine.executeActions(rule, state)
    → localNotification → localNotificationRepo.schedule()
    → preArmSos → useSosStore.arm()
    ↓
更新 lastFiredAt
```

## 6. 约束与兼容性

- 预武装 SOS 仍保留 5 秒取消窗口，不静默触发。
- 通知文案不可包含联系人手机号或精确坐标。
- 规则数据通过 `storage` 抽象持久化，Web 走 localStorage，Android 走 Capacitor Preferences。
- 规则评估是同步纯函数，不依赖网络。
- 现有回归测试全部保持通过。

## 7. 测试策略

### 7.1 领域层测试（`ruleEngine.test.ts`）

- `evaluateRule` 单条件匹配/不匹配
- `evaluateRule` 多条件 AND 全满足/部分满足
- `evaluateRule` 所有五种信号各自的条件评估
- `isRuleOnCooldown` 冷却期内/外
- `evaluateAllRules` 多条规则批量评估
- 禁用规则不触发

### 7.2 Store 测试（`useRuleEngineStore.test.ts`）

- 规则 CRUD（创建、更新、删除、启禁）
- 持久化往返
- 冷却时间记录与恢复
- 动作分发调用

### 7.3 页面测试（`ruleEnginePage.test.tsx`）

- 空态展示
- 规则列表渲染（名称、条件摘要、动作摘要、开关）
- 新建规则
- 编辑规则（修改条件、动作、名称）
- 删除规则
- 启用/禁用切换

## 8. 版本变更

- 前端版本跟随后续发版统一升版（当前从 0.5.0 起步）
- README 当前事实表更新：页面列表新增"智能规则"，已落地能力新增对应条目
- 能力边界不改变：仍只承诺本地-only + 人工确认
