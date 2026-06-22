# v0.4.33 回放滑块 + 行程预设 + 统计面板 + 隐私锁屏

## 目标

在 v0.4.32 基础上新增四个独立的本地优化功能：

1. **回放时间轴滑块** - 用户可拖拽跳转到任意轨迹点查看
2. **快捷预设行程** - 用户可在配置页管理常用行程预设（目的地+时长），创建时快速选择
3. **行程统计面板** - 行程历史页顶部展示统计卡片（总数、平均时长、准时率、常去目的地）
4. **隐私锁屏** - 应用级 PIN 码保护，进入后台 30 秒后锁定，回前台需解锁

## 能力边界

- 所有功能均为本地 local-first，不涉及远端 API
- 隐私锁屏仅 PIN 码（不使用生物识别插件），不承诺后台 force-stop 后保持锁定状态
- 统计仅基于本地行程历史，不上传、不云端汇总
- 预设行程存储在 localStorage，设备间不同步

## 设计

### 1. 回放时间轴滑块

**UI 位置：** PlaybackPage 动画播放控制卡片下方新增时间轴滑块卡片

**组件结构：**
- MUI Slider 水平滑块，最小值 0，最大值 `route.points.length - 1`
- 滑块左侧显示当前点时间戳，右侧显示总点数
- 拖拽过程中实时更新 `playbackIndex`
- 拖拽时如果正在播放则暂停，松手后恢复播放（如果拖拽前在播放）

**交互逻辑：**
- 用户拖拽滑块时，`onChangeCommitted` 时记录是否正在播放
- 拖拽中 `onChange` 更新 `playbackIndex` 并暂停播放
- 松手后如果之前在播放则恢复播放状态

### 2. 快捷预设行程

**数据模型：**
```typescript
interface TripPreset {
  id: string
  destination: string
  durationMinutes: number
}
```

**存储：** localStorage key `safety_v2_trip_presets`，数组上限 10 个

**配置页管理：**
- ConfigPage 新增"行程预设"卡片
- 列表展示所有预设（目的地 + 时长）
- 每个预设有"编辑"和"删除"按钮
- 顶部"添加预设"按钮打开对话框（输入目的地、时长）

**创建行程集成：**
- OverviewPage 创建行程对话框顶部新增"快速选择"区域
- 横向滚动显示所有预设 Chip，点击自动填充目的地和时长
- 用户仍可手动修改填充后的值

**Domain 层：**
- `frontend/src/domain/tripPreset.ts` - 纯函数：创建、更新、删除预设
- `frontend/src/data/tripPresetRepo.ts` - 持久化封装

**Store 层：**
- `frontend/src/stores/useTripPresetStore.ts` - Zustand store 管理预设列表

### 3. 行程统计面板

**UI 位置：** TripHistoryPage 顶部（"安全行程历史"标题下方）

**统计指标：**
- **总行程数：** 历史列表长度
- **平均时长：** 所有行程的实际时长（`createdAt` 到最终状态事件时间）平均值
- **准时率：** 状态为 `arrived` 且最后一个事件时间 <= `expectedArrivalAt` 的行程数 / 总数
- **常去目的地（前 3）：** 按 destination 分组计数，取前 3

**UI 呈现：**
- 一个 Card，内部 Grid 4 列（xs: 2 列 + 2 列，sm: 4 列）
- 每列展示一个指标：图标 + 数字 + 标签
- 如果历史为空则不显示统计卡片

**Domain 层：**
- `frontend/src/domain/tripStats.ts` - `computeTripStats(trips: SafetyTrip[]): TripStats`
  - 返回 `{ total, avgDurationMinutes, onTimeRate, topDestinations: {destination, count}[] }`

### 4. 隐私锁屏

**数据模型：**
```typescript
interface PrivacyLockConfig {
  enabled: boolean
  pinHash: string // bcrypt-like hash or sha256(pin + salt)
}
```

**存储：** localStorage key `safety_v2_privacy_lock`

**锁定逻辑：**
- 应用进入后台（`document.visibilityState === 'hidden'`）时启动 30 秒倒计时
- 30 秒后标记 `locked = true`
- 回前台（`visibilitychange` 事件）时检查 `locked`，如果为 true 则显示解锁屏幕

**UI 组件：**
- `frontend/src/components/PrivacyLockScreen.tsx` - 全屏覆盖层，PIN 输入框（4-6 位数字）
- 输入完成后自动校验，正确则解锁，错误则清空并提示

**集成点：**
- AppShell 包裹 children 前检查锁定状态
- 如果锁定则渲染 PrivacyLockScreen 替代 children

**配置页设置：**
- ConfigPage 新增"隐私锁屏"卡片
- 开关控制是否启用
- 启用时弹出对话框设置 PIN（输入两次确认）
- 已启用时显示"修改 PIN"和"关闭锁屏"按钮

**Domain 层：**
- `frontend/src/domain/privacyLock.ts` - `hashPin(pin: string): string`, `verifyPin(pin: string, hash: string): boolean`
  - 使用简单 SHA-256 + 固定 salt（不引入 bcrypt 依赖）

**Store 层：**
- `frontend/src/stores/usePrivacyLockStore.ts` - 管理锁定状态、配置、解锁

## 测试策略

### 回放滑块
- 测试拖拽更新 playbackIndex
- 测试拖拽中暂停播放
- 测试松手后恢复播放（如果之前在播放）

### 行程预设
- 测试预设 CRUD（创建、读取、更新、删除）
- 测试预设填充到创建对话框
- 测试预设上限（10 个）

### 统计面板
- 测试统计计算正确性（总数、平均时长、准时率、常去目的地）
- 测试空历史不显示统计卡片

### 隐私锁屏
- 测试 PIN 哈希和校验
- 测试锁定时机（进入后台 30 秒）
- 测试解锁流程（正确 PIN / 错误 PIN）
- 测试配置页 PIN 设置

## 实现顺序

1. **回放滑块** - 修改 PlaybackPage，新增 Slider 卡片
2. **行程预设** - domain + repo + store + ConfigPage 管理 + OverviewPage 集成
3. **统计面板** - domain stats 计算 + TripHistoryPage 顶部卡片
4. **隐私锁屏** - domain hash + store + PrivacyLockScreen 组件 + AppShell 集成 + ConfigPage 设置
5. **版本 bump、README、release gate**

每个功能独立实现、测试、提交。
