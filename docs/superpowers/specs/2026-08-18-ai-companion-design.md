# AI 陪伴助手(debug 包) 设计规格

- 日期: 2026-08-18
- 状态: 已设计,待实现
- 范围: debug 包可用的 AI 对话 + 工具调用;release 包保持占位

## 目标

1. debug 包中,用户可配置 OpenAI 兼容 API 端点,与 AI 助手对话。
2. 助手通过 OpenAI Function Calling(tools) 调用应用能力(读/写),写入操作需用户确认。
3. release 包 `AiCompanionPlaceholder` 保持原有占位文案,不渲染对话 UI。

## 非目标

- 不引入 React Router / 新路由库 / 服务端依赖。
- 不接入 MCP Server / WebSocket / 外部客户端。
- 不实现语音输入/输出。
- 不处理用户认证(API Key 由用户自管,明文本地存储)。
- 不承诺消息加密(API Key 和消息均明文存 localStorage)。

## 架构

```
用户输入 → AiChatBox
              ↓  (dispatch)
         AiService.chatCompletion(userMessage)
              ↓  (fetch POST /v1/chat/completions)
    ┌──────────┴──────────┐
    │  messages: [...]     │
    │  tools: [...]        │
    │  tool_choice: auto   │
    └──────────┬──────────┘
              ↓  (response)
         choices[0].message
              ↓
    ┌──────────┴──────────┐
    │  content? → 显示     │
    │  tool_calls? → 执行  │
    └──────────┬──────────┘
              ↓
         ToolRunner.run(toolCall)
              ↓  (if write: show confirm dialog)
         call store action → result
              ↓  (append tool result message)
         AiService.chatCompletion(next round)
```

## 文件结构

### 新增

| 文件 | 职责 |
|---|---|
| `frontend/src/ai/aiService.ts` | OpenAI Chat Completions API 调用封装 |
| `frontend/src/ai/aiTools.ts` | 工具定义列表 + `ToolRunner`(函数名 → 执行器 + 权限分级) |
| `frontend/src/ai/aiConfigStore.ts` | API base URL、key、model、enabled 持久化配置 |
| `frontend/src/ai/aiContext.ts` | 构建 system prompt(注入 app 状态摘要) |
| `frontend/src/ai/aiMemory.ts` | 对话历史维护(max N 轮,纯内存) |
| `frontend/src/components/AiChatBox.tsx` | 对话 UI 容器(消息列表 + 输入框 + 确认弹窗) |
| `frontend/src/components/AiChatMessage.tsx` | 单条消息渲染(用户/AI/工具调用/结果) |
| 对应测试: `aiService.test.ts`、`aiTools.test.ts`、`aiChatBox.test.tsx`、`aiConfigStore.test.ts` |

### 修改

| 文件 | 改动 |
|---|---|
| `frontend/src/components/AiCompanionPlaceholder.tsx` | debug 模式渲染 AiChatBox,release 保持占位 |
| `frontend/src/i18n/zh-CN.ts` | 新增 `ai` 文案区块 |
| `frontend/src/pages/ProfilePanel.tsx` | 加「AI 助手配置」入口 + API 配置表单 |
| `frontend/src/types/home.ts` | 可选:HomeSlotKey 加 `aiAssistant` 槽位(供四栏展示 AI 入口) |

## API 配置

用户在 **「我的」面板 → AI 助手配置** 填写:

| 字段 | 默认值 | 说明 |
|---|---|---|
| API 地址 | `https://api.openai.com/v1` | 完整 base URL,含 `/v1` |
| API Key | `(空)` | 明文存储于 `safety_v2_ai_config`,用户自管 |
| 模型 | `gpt-4o-mini` | 兼容 OpenAI 及兼容端点 |
| 启用 | `false` | debug 包中启用后才渲染 AiChatBox |

- `aiConfigStore.ts` 使用 `storage.getJson/setJson`(key `safety_v2_ai_config`)。
- Release 包中即使启用,`AiCompanionPlaceholder` 也不渲染对话 UI(通过 `__DEV__` 或 `Capacitor.isNativePlatform()` + devMode 判定)。

## 工具定义与权限

工具定义在 `aiTools.ts`,格式为 OpenAI `tools` 数组( `{ type: 'function', function: { name, description, parameters } }`)。

### 只读工具(自动执行)

| 工具名 | 操作 | 对应的 Store/Data |
|---|---|---|
| `get_location` | 获取当前位置 | `getCurrentPosition()` |
| `get_sos_history` | 最近 SOS 记录(最近 5 条) | `useSosStore.getState().history` |
| `get_tracking_status` | 轨迹状态(启用/新鲜度/总点数) | `useTrackingStore.getState()` |
| `get_contacts` | 紧急联系人列表 | `useContactsStore.getState().list` |
| `get_geofence_zones` | 围栏区域 | `useGeofenceStore.getState().zones` |
| `get_safety_trip` | 当前安全行程(状态/目的地/超时) | `useSafetyTripStore.getState().current` |
| `get_rules` | 智能规则列表(名称/启用/最后触发) | `useRuleEngineStore.getState().rules` |
| `get_risk_summary` | 风险摘要(等级/项数) | `aggregateRiskData` 调用 |

### 写入工具(需用户确认)

| 工具名 | 操作 | 确认方式 |
|---|---|---|
| `create_safety_trip` | 创建安全行程 | 弹窗显示目的地+时长,[允许]/[拒绝] |
| `add_contact` | 添加紧急联系人 | 弹窗显示姓名+电话,[允许]/[拒绝] |
| `trigger_sos` | 触发 SOS | **双重确认**:弹窗 1"AI 请求触发 SOS"→弹窗 2 倒计时 5 秒取消 |
| `enable_tracking` | 开启周期轨迹 | 弹窗[允许]/[拒绝] |

### 工具执行流程

```
ToolRunner.run(toolCall)
  → 查 permission map
  → read-only: 直接执行,返回结果
  → write: 挂起,showConfirmDialog(toolName, params)
      → 用户点击「允许」:执行,返回结果,append tool result message
      → 用户点击「拒绝」:返回 { error: '用户拒绝了操作' }
```

## AiChatBox UI

- 渲染在首页 `AiCompanionPlaceholder` 位置。
- **消息列表**:滚动容器,最新消息在底部。每条消息有头像/角色标识。
  - 用户消息:右对齐,蓝色气泡。
  - AI 回复:左对齐,灰色气泡,AI 名字 "🤖 安全助手"。
  - 工具调用中:显式 loading 指示器("正在获取位置..." + CircularProgress)。
  - 工具结果:折叠/展开块,绿色/红色状态标识。
- **输入框**:底部固定,TextField + IconButton(发送)。
- **确认弹窗**:`<Dialog>` 显示工具名称、参数摘要,「允许」「拒绝」按钮。
- **空状态**:AI 发送欢迎消息 "你好!我是你的安全助手。我可以帮你查看位置、联系人、行程信息,也可以帮你创建行程、添加联系人。需要我做什么?"
- **错误状态**:API 调用失败 → 显示错误消息"连接 AI 服务失败,请检查配置和网络" + 重试按钮。
- 对话历史存 `localStorage`(`safety_v2_ai_messages`),最多 50 条。

## AiCompanionPlaceholder 改动

当前占位组件改为两分支:

```
function AiCompanionPlaceholder() {
  const devEnabled = useDevModeStore((s) => s.enabled)
  const aiConfig = useAiConfigStore((s) => s.config)

  if (!devEnabled || !aiConfig.enabled) {
    return <CurrentPlaceholder />   // 保持原有占位
  }

  return <AiChatBox />
}
```

- `devEnabled` 即 debug 模式(v0.7.0 已有 `useDevModeStore`)。
- Release 包无法开启 debug 模式,因此不会渲染 `AiChatBox`。

## 系统 Prompt

`aiContext.ts` 构建 system message,包含:

```
你是一个安全助手,运行在「独行青年安全守护」App 中。
当前用户状态:
- 位置: {lat}, {lng} (新鲜度: fresh/stale)
- 紧急电话: {callNumber} (已配置/未配置)
- 联系人: N 人
- 安全行程: {destination} (进行中/超时/无)
- 围栏: N 个
- 智能规则: N 条(当前触发: ...)
- 风险等级: ok|attention|warning
- 最近 SOS: N 条

你有以下工具可用:
[工具列表摘要,每工具名+描述]

注意:
- 读取操作你直接执行。
- 写入操作(创建行程/添加联系人/启用轨迹/触发SOS)你需要先告诉用户你的计划,执行时会弹出确认框。
- 触发 SOS 是严肃操作,只在用户明确要求时执行,且执行前需要告知用户即将弹出双重确认。
- 保持语气友好、简洁,使用中文。
```

## 测试计划

| 测试文件 | 测试内容 |
|---|---|
| `src/test/aiConfigStore.test.ts` | 配置持久化:set/get/initialize;debug/release 不可互斥 |
| `src/test/aiService.test.ts` | 构造请求体含 tools/messages;mock fetch 返回正常/错误/空响应 |
| `src/test/aiTools.test.ts` | 每个只读工具调对应 store→返回预期格式;写入工具返回权限障碍 |
| `src/test/aiChatBox.test.tsx` | 发送消息→显示气泡;工具调用→确认弹窗→执行→结果渲染;API 错误→错误消息;空状态→欢迎语 |
| `src/test/aiMemory.test.ts` | 追加消息→截断超限;clear 清空 |
| `src/test/aiCompanionPlaceholder.test.tsx` | debug+启用→AiChatBox;release/禁用→占位 |

## 测试与构建验证

- `npm run check`: typecheck + lint + 全量测试 + build 全绿。
- 增量测试:预期新增 ~6 个测试文件,~25 个测试用例。
- 按既定发版流程发 v0.8.0(功能版本号 +0.1)。