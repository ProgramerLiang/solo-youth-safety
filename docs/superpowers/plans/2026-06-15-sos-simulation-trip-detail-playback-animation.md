# v0.4.32 SOS 模拟训练 + 行程历史详情 + 回放动画播放 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 三项独立本地功能：SOS 模拟训练、行程历史详情、回放动画播放。

**Spec:** `docs/superpowers/specs/2026-06-15-sos-simulation-trip-detail-playback-animation.md`

---

## 文件结构

**修改：**
- `frontend/src/domain/sosState.ts` — 新增 `createSimulationResult`
- `frontend/src/pages/SosPage.tsx` — 模拟训练卡片 + 流程
- `frontend/src/pages/TripHistoryPage.tsx` — 事件时间线展开
- `frontend/src/pages/PlaybackPage.tsx` — 播放控制 + 动画
- `frontend/src/test/sosState.test.ts` — 模拟结果测试
- `frontend/src/test/sosPage.test.tsx` — 模拟训练流程测试
- `frontend/src/test/tripHistoryPage.test.tsx` — 展开详情测试
- `frontend/src/test/playbackPage.test.tsx` — 播放控制测试
- `frontend/package.json` — 版本 `0.4.31` → `0.4.32`
- `frontend/package-lock.json` — 同步版本
- `README.md` — 事实表、能力清单、回归基线

---

## Task 1: SOS 模拟训练 domain + 页面

- [ ] **Step 1: 写测试（RED）**

在 `frontend/src/test/sosState.test.ts` 中新增：

```ts
it('createSimulationResult returns training-mode result', () => {
  const result = createSimulationResult()
  expect(result.finalLabel).toBe('训练完成')
  expect(result.finalStatus).toBe('success')
  expect(result.summary).toContain('模拟训练')
  expect(result.steps.location.label).toContain('训练模式')
  expect(result.steps.sms.detail).toContain('未发送')
  expect(result.steps.call.detail).toContain('未拨打')
})
```

在 `frontend/src/test/sosPage.test.tsx` 中新增：

```tsx
it('shows simulation training card and runs training flow', async () => {
  render(<SosPage />)
  expect(screen.getByText('模拟训练')).toBeInTheDocument()
  fireEvent.click(screen.getByText('开始模拟训练'))
  // countdown should be active
  expect(screen.getByText(/取消/)).toBeInTheDocument()
})
```

- [ ] **Step 2: 跑测试确认 RED**

- [ ] **Step 3: 实现 `createSimulationResult`**

在 `frontend/src/domain/sosState.ts` 中新增：

```ts
export function createSimulationResult(): SosResult {
  return {
    stage: 'completed',
    steps: {
      location: { label: '训练模式 - 模拟定位成功', badge: '✓', detail: '模拟定位，未调用系统定位', tone: 'success' },
      persistence: { label: '训练模式 - 模拟记录', badge: '✓', detail: '模拟记录，未写入历史', tone: 'success' },
      sms: { label: '训练模式 - 未发送短信', badge: '-', detail: '训练模式不发送短信', tone: 'idle' },
      call: { label: '训练模式 - 未拨打电话', badge: '-', detail: '训练模式不拨打电话', tone: 'idle' },
    },
    finalStatus: 'success',
    finalLabel: '训练完成',
    summary: '这是一次模拟训练，未拨打电话或发送短信。',
  }
}
```

- [ ] **Step 4: 实现 SosPage 模拟训练卡片**

在 `frontend/src/pages/SosPage.tsx` 中：
- 新增 `simulationMode` 状态
- 新增 `handleSimulationTrigger`：设置 simulationMode = true，启动倒计时
- 修改 `onElapsed` 回调：如果 simulationMode，调用 `createSimulationResult()` 设置到 store，不调用 triggerNow
- 模拟结果不写入历史
- 新增"模拟训练"卡片 UI（说明文字 + 按钮）
- 模拟结果区底部新增"重新训练"和"返回"按钮

- [ ] **Step 5: 跑测试确认 GREEN**

- [ ] **Step 6: Commit**

```bash
git add frontend/src/domain/sosState.ts frontend/src/pages/SosPage.tsx frontend/src/test/sosState.test.ts frontend/src/test/sosPage.test.tsx
git commit -m "feat(sos): add simulation training mode"
```

---

## Task 2: 行程历史详情（事件时间线）

- [ ] **Step 1: 写测试（RED）**

在 `frontend/src/test/tripHistoryPage.test.tsx` 中新增：

```tsx
it('expands event timeline on click', async () => {
  await appendSafetyTripHistory(arrivedTrip)
  render(<TripHistoryPage />)
  const item = await screen.findByText('回家')
  fireEvent.click(item)
  expect(screen.getByText('到达')).toBeInTheDocument()
  expect(screen.getByText(/2026/)).toBeInTheDocument()
})
```

- [ ] **Step 2: 跑测试确认 RED**

- [ ] **Step 3: 实现事件时间线展开**

在 `frontend/src/pages/TripHistoryPage.tsx` 中：
- 新增 `expandedId` 状态
- 点击 ListItem 切换 expandedId
- 使用 MUI `Collapse` 展开事件时间线
- 每个事件一行：图标 + 类型标签 + 时间 + 详情

事件图标映射：
- created: 播放箭头
- extended: 时钟
- arrived: 对勾
- cancelled: X
- overdue_seen: 警告

- [ ] **Step 4: 跑测试确认 GREEN**

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/TripHistoryPage.tsx frontend/src/test/tripHistoryPage.test.tsx
git commit -m "feat(trip-history): add expandable event timeline"
```

---

## Task 3: 回放动画播放

- [ ] **Step 1: 写测试（RED）**

在 `frontend/src/test/playbackPage.test.tsx` 中新增：

```tsx
it('shows playback controls with play button and speed options', () => {
  useTrackingStore.setState({ history: [secondPoint, firstPoint] })
  render(<PlaybackPage />)
  expect(screen.getByLabelText('播放')).toBeInTheDocument()
  expect(screen.getByText('1x')).toBeInTheDocument()
  expect(screen.getByText('2x')).toBeInTheDocument()
  expect(screen.getByText('4x')).toBeInTheDocument()
})
```

- [ ] **Step 2: 跑测试确认 RED**

- [ ] **Step 3: 实现播放控制**

在 `frontend/src/pages/PlaybackPage.tsx` 中：
- 新增 `isPlaying`、`playbackIndex`、`playbackSpeed` 状态
- `useEffect` + `setInterval` 控制播放推进
- 倍速映射：1x = 1000ms, 2x = 500ms, 4x = 250ms
- 当前点标记：更大尺寸 + 外圈光环
- 播放控制栏 UI：播放/暂停按钮 + 倍速选择 Chip + 进度显示
- 播放到末尾自动暂停

- [ ] **Step 4: 跑测试确认 GREEN**

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/PlaybackPage.tsx frontend/src/test/playbackPage.test.tsx
git commit -m "feat(playback): add animation playback with speed controls"
```

---

## Task 4: 版本升级、README、构建闸口

- [ ] **Step 1: Bump version**

`frontend/package.json`: `"version": "0.4.31"` → `"version": "0.4.32"`
同步 `frontend/package-lock.json` 顶层 version field。

- [ ] **Step 2: 更新 README.md**

- 统一事实表版本号：`0.4.31` → `0.4.32`
- 已落地能力新增：SOS 模拟训练、行程历史详情、回放动画播放
- 回归基线补充

- [ ] **Step 3: 最终闸口**

```bash
cd frontend && npm run check:full && npm run android:release
```

- [ ] **Step 4: 最终 commit + tag + GitHub Release**

```bash
git add frontend/package.json frontend/package-lock.json README.md
git commit -m "chore: bump to v0.4.32"
git tag -a v0.4.32 -m 'v0.4.32 sos simulation, trip detail, playback animation'
git push origin main && git push origin v0.4.32
gh release create v0.4.32 \
  frontend/android/app/build/outputs/apk/debug/solo-youth-safety-v0.4.32-debug.apk \
  frontend/android/app/build/outputs/apk/release/solo-youth-safety-v0.4.32-release.apk \
  frontend/android/app/build/outputs/bundle/release/solo-youth-safety-v0.4.32-release.aab \
  --repo ProgramerLiang/solo-youth-safety \
  --title "v0.4.32 SOS 模拟训练 + 行程历史详情 + 回放动画播放" \
  --notes "..." \
  --latest
```