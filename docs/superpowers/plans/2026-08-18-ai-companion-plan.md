# AI 陪伴助手(debug) 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Debug 包中,用户配置 OpenAI 兼容 API 端点,通过对话调用应用能力(只读自动执行,写入用户确认)。Release 保持占位。

**Architecture:** 纯前端 Function Calling: AiService(API 调用) → ToolRunner(工具调度) → Zustand stores。无额外依赖。

**Tech Stack:** React 19 + TypeScript + OpenAI Chat Completions API + Zustand

## Global Constraints

- 中文 UI 文案统一在 `frontend/src/i18n/zh-CN.ts`;禁止内联 `import("pkg").Type`,类型依赖用顶层 `import type`。
- 存储走 `frontend/src/data/storage.ts` 的 `storage.getJson/setJson`;localStorage key 前缀 `safety_v2_`。
- Debug build 判定: `useDevModeStore.getState().enabled`(dev mode 开启后 `AiCompanionPlaceholder` 渲染 `AiChatBox`)。
- 写入操作需弹窗确认:`create_safety_trip`、`add_contact`、`enable_tracking` 单次确认;`trigger_sos` 双重确认(弹窗 + 5s 倒计时)。
- 对话历史存 `safety_v2_ai_messages`,最多 50 条;API Key 明文本地存储(`safety_v2_ai_config`),用户自管安全。
- 所有新增文件在 `frontend/src/ai/` 目录,组件在 `frontend/src/components/`。
- 每个任务结束 `git add + commit`;最终 `npm run check` 全绿后发版 v0.8.0。

---

## 文件结构

| 文件 | 职责 |
|---|---|
| `frontend/src/ai/aiConfigStore.ts` | API baseURL/key/model/enabled 配置持久化 |
| `frontend/src/ai/aiContext.ts` | 构建 system prompt(注入 App 状态摘要) |
| `frontend/src/ai/aiMemory.ts` | 对话历史维护(内存 + localStorage) |
| `frontend/src/ai/aiService.ts` | OpenAI Chat Completions API 调用封装 |
| `frontend/src/ai/aiTools.ts` | 工具定义列表 + ToolRunner 执行调度 |
| `frontend/src/components/AiChatMessage.tsx` | 单条消息渲染 |
| `frontend/src/components/AiChatBox.tsx` | 对话 UI(消息列表 + 输入框 + 确认弹窗) |
| 对应测试: 每文件一个 `.test.ts`/`.test.tsx` |
| 修改: `AiCompanionPlaceholder`、`ProfilePanel`、`zh-CN.ts`、`types/home.ts` |

---

## Task 1: aiConfigStore + aiContext

**Files:**
- Create: `frontend/src/ai/aiConfigStore.ts`
- Create: `frontend/src/ai/aiContext.ts`
- Test: `frontend/src/test/aiConfigStore.test.ts`

**Interfaces:**
- Produces: `AiConfig`(baseUrl/key/model/enabled), `useAiConfigStore`(initialize/setConfig/toggle), `buildSystemPrompt()` 返回 string。

- [ ] **Step 1: 写失败测试**

```typescript
// frontend/src/test/aiConfigStore.test.ts
import { beforeEach, describe, expect, it } from 'vitest'
import { useAiConfigStore } from '../ai/aiConfigStore'
import { buildSystemPrompt } from '../ai/aiContext'

beforeEach(() => { localStorage.clear() })

describe('aiConfigStore', () => {
  it('defaults to disabled with OpenAI defaults', () => {
    expect(useAiConfigStore.getState().config.enabled).toBe(false)
    expect(useAiConfigStore.getState().config.baseUrl).toBe('https://api.openai.com/v1')
    expect(useAiConfigStore.getState().config.model).toBe('gpt-4o-mini')
  })

  it('setConfig updates and persists', async () => {
    await useAiConfigStore.getState().setConfig({ baseUrl: 'http://localhost:11434/v1', key: 'ollama', model: 'llama3' })
    const saved = JSON.parse(localStorage.getItem('safety_v2_ai_config')!)
    expect(saved.baseUrl).toBe('http://localhost:11434/v1')
  })

  it('toggle changes enabled state', () => {
    useAiConfigStore.getState().toggle()
    expect(useAiConfigStore.getState().config.enabled).toBe(true)
  })

  it('initialize loads from storage', async () => {
    localStorage.setItem('safety_v2_ai_config', JSON.stringify({ baseUrl: 'http://test', key: 'k', model: 'm', enabled: true }))
    useAiConfigStore.setState({ config: { baseUrl: '', key: '', model: '', enabled: false }, loaded: false })
    await useAiConfigStore.getState().initialize()
    expect(useAiConfigStore.getState().config.baseUrl).toBe('http://test')
    expect(useAiConfigStore.getState().config.enabled).toBe(true)
  })
})
```

- [ ] **Step 2: 跑测试确认失败 → Step 3: 写 aiConfigStore.ts → Step 4: 写 aiContext.ts → Step 5: 跑测试通过 → Step 6: Commit**

(代码见 spec `docs/superpowers/specs/2026-08-18-ai-companion-design.md` §API 配置)

---

## Task 2: aiMemory

**Files:**
- Create: `frontend/src/ai/aiMemory.ts`
- Test: `frontend/src/test/aiMemory.test.ts`

**Interfaces:**
- Produces: `AiMessage`(role: 'user'|'assistant'|'system'|'tool', content?, tool_calls?, tool_call_id?, name?), `addMessage(msg)`, `getMessages(): AiMessage[]`, `clearMessages()`, `initializeMemory()`。
- 上限 50 条,超出则裁剪最早的历史(保留 system)。

- [ ] **Step 1: 写测试**

```typescript
// frontend/src/test/aiMemory.test.ts
import { describe, expect, it, beforeEach } from 'vitest'
import { addMessage, getMessages, clearMessages, initializeMemory } from '../ai/aiMemory'

beforeEach(() => { localStorage.removeItem('safety_v2_ai_messages') })

describe('aiMemory', () => {
  it('starts empty after init', () => {
    initializeMemory('system prompt')
    const msgs = getMessages()
    expect(msgs.length).toBe(1)
    expect(msgs[0].role).toBe('system')
  })

  it('addMessage appends message', () => {
    initializeMemory('sys')
    addMessage({ role: 'user', content: 'hi' })
    expect(getMessages().length).toBe(2)
  })

  it('trims to 50 messages max', () => {
    initializeMemory('sys')
    for (let i = 0; i < 60; i++) addMessage({ role: 'user', content: `msg-${i}` })
    expect(getMessages().length).toBe(50)
  })

  it('clearMessages resets to system only', () => {
    initializeMemory('sys')
    addMessage({ role: 'user', content: 'hi' })
    clearMessages()
    expect(getMessages().length).toBe(1)
  })

  it('persists to localStorage and loads back', () => {
    initializeMemory('sys')
    addMessage({ role: 'user', content: 'hello' })
    const saved = JSON.parse(localStorage.getItem('safety_v2_ai_messages')!)
    expect(saved.length).toBe(2)
  })
})
```

- [ ] **Step 2-5: 实现 → 测试 → 提交**

---

## Task 3: aiTools

**Files:**
- Create: `frontend/src/ai/aiTools.ts`
- Test: `frontend/src/test/aiTools.test.ts`

**Interfaces:**
- Produces: `TOOL_DEFINITIONS: ChatCompletionTool[]`(OpenAI tools 格式), `ToolRunner`(runTool(name, args): Promise<object>), `TOOL_PERMISSIONS: Record<string, 'read'|'write'>`。

- [ ] **Step 1: 写测试**

```typescript
// frontend/src/test/aiTools.test.ts
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { TOOL_DEFINITIONS, runTool, TOOL_PERMISSIONS } from '../ai/aiTools'
import { useContactsStore } from '../stores/useContactsStore'

beforeEach(() => {
  useContactsStore.setState({ list: [], editingId: null, draft: { name: '', phone: '' }, loaded: true })
})

describe('aiTools', () => {
  it('exposes tool definitions with get_contacts', () => {
    const getContacts = TOOL_DEFINITIONS.find(t => t.function?.name === 'get_contacts')
    expect(getContacts).toBeDefined()
    expect(getContacts!.type).toBe('function')
  })

  it('get_contacts returns the contact list', async () => {
    useContactsStore.setState({ list: [{ id: '1', name: '张三', phone: '13800138000' }] })
    const result = await runTool('get_contacts', {})
    expect(result.contacts).toHaveLength(1)
    expect(result.contacts[0].name).toBe('张三')
  })

  it('get_contacts returns empty list when no contacts', async () => {
    const result = await runTool('get_contacts', {})
    expect(result.contacts).toEqual([])
  })

  it('read tools require no confirmation', () => {
    expect(TOOL_PERMISSIONS['get_contacts']).toBe('read')
    expect(TOOL_PERMISSIONS['create_safety_trip']).toBe('write')
    expect(TOOL_PERMISSIONS['trigger_sos']).toBe('write')
  })

  it('returns error for unknown tool', async () => {
    const result = await runTool('nonexistent')
    expect((result as any).error).toBeDefined()
  })
})
```

- [ ] **Step 2-5: 实现 → 测试 → 提交**

**aiTools.ts 实现要点:**
- 8 个只读 + 4 个写入工具定义
- `runTool` 函数根据 name 分发到对应 store action(只读直接调 store state,写入不执行→返回权限标记让 UI 处理)
- `TOOL_PERMISSIONS: Record<string, 'read'|'write'>` 供 AiChatBox 判断是否需要确认框
- 只读工具示例:`get_location` → `getCurrentPosition()`, `get_sos_history` → `useSosStore.getState().history.slice(-5)`
- 写入工具 `runTool` 只验证参数格式,返回 `__needs_confirmation__: true` 标记,实际执行由确认后的二次调用完成

---

## Task 4: aiService

**Files:**
- Create: `frontend/src/ai/aiService.ts`
- Test: `frontend/src/test/aiService.test.ts`

**Interfaces:**
- Produces: `chatCompletion(messages, tools): Promise<ChatCompletionResponse>` 封装 fetch 到 `/v1/chat/completions`。
- 使用 `useAiConfigStore.getState().config` 获取 baseUrl/key/model。
- 错误处理:网络错误 / HTTP 非 200 / JSON parse 失败 → throw 可读错误。

- [ ] **Step 1: 写测试**

```typescript
// frontend/src/test/aiService.test.ts
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { chatCompletion } from '../ai/aiService'
import { useAiConfigStore } from '../ai/aiConfigStore'

beforeEach(() => {
  useAiConfigStore.setState({ config: { baseUrl: 'https://api.openai.com/v1', key: 'sk-test', model: 'gpt-4o-mini', enabled: true }, loaded: true })
})

describe('chatCompletion', () => {
  it('sends correct request body and returns response', async () => {
    const mockResponse = { choices: [{ message: { role: 'assistant', content: 'Hello!' } }] }
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true, json: async () => mockResponse,
    } as Response)

    const result = await chatCompletion([{ role: 'user', content: 'hi' }], [])
    expect(result.choices[0].message.content).toBe('Hello!')
    expect(fetch).toHaveBeenCalledWith(
      'https://api.openai.com/v1/chat/completions',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer sk-test' }),
      }),
    )
  })

  it('throws on HTTP error', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: false, status: 401, statusText: 'Unauthorized', text: async () => 'Invalid key',
    } as Response)

    await expect(chatCompletion([{ role: 'user', content: 'hi' }], [])).rejects.toThrow(/401/)
  })

  it('throws on network error', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new TypeError('Failed to fetch'))
    await expect(chatCompletion([{ role: 'user', content: 'hi' }], [])).rejects.toThrow(/Failed to fetch/)
  })
})
```

- [ ] **Step 2-5: 实现 → 测试 → 提交**

**aiService.ts 实现要点:**
- `chatCompletion(messages, tools, tool_choice?)` → fetch POST
- headers: `'Authorization': 'Bearer ' + config.key`, `'Content-Type': 'application/json'`
- body: `{ model: config.model, messages, tools, tool_choice: tool_choice ?? (tools.length > 0 ? 'auto' : undefined) }`

---

## Task 5: AiChatMessage + AiChatBox

**Files:**
- Create: `frontend/src/components/AiChatMessage.tsx`
- Create: `frontend/src/components/AiChatBox.tsx`
- Test: `frontend/src/test/aiChatMessage.test.tsx`、`frontend/src/test/aiChatBox.test.tsx`

**Interfaces:**
- Consumes: `AiMessage`(from aiMemory), `TOOL_DEFINITIONS`, `runTool`, `TOOL_PERMISSIONS`, `chatCompletion`, `addMessage`, `getMessages`, `clearMessages`, `buildSystemPrompt`, `useAiConfigStore`, `useDevModeStore`。
- Produces: `<AiChatBox />` 完整对话 UI。

- [ ] **Step 1: 写 AiChatMessage 测试**

```typescript
// frontend/src/test/aiChatMessage.test.tsx
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AiChatMessage } from '../components/AiChatMessage'

describe('AiChatMessage', () => {
  it('renders user message right-aligned', () => {
    render(<AiChatMessage role="user" content="你好" />)
    expect(screen.getByText('你好')).toBeInTheDocument()
  })

  it('renders assistant message with avatar', () => {
    render(<AiChatMessage role="assistant" content="我是助手" />)
    expect(screen.getByText('我是助手')).toBeInTheDocument()
    expect(screen.getByText(/🤖/)).toBeInTheDocument()
  })

  it('renders tool call in progress state', () => {
    render(<AiChatMessage role="tool" toolCallId="call_1" toolName="get_location" isRunning />)
    expect(screen.getByText(/正在获取位置/)).toBeInTheDocument()
  })

  it('renders tool result', () => {
    render(<AiChatMessage role="tool" toolCallId="call_1" toolName="get_location" content='{"lat":31.23,"lng":121.47}' />)
    expect(screen.getByText(/31.23/)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: 写 AiChatBox 测试(简化版)**

```typescript
// frontend/src/test/aiChatBox.test.tsx
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { AiChatBox } from '../components/AiChatBox'
import { useAiConfigStore } from '../ai/aiConfigStore'
import { useDevModeStore } from '../stores/useDevModeStore'

beforeEach(() => {
  useAiConfigStore.setState({ config: { baseUrl: '', key: '', model: '', enabled: true }, loaded: true })
  useDevModeStore.setState({ enabled: true, tapProgress: 0, loaded: true })
  localStorage.removeItem('safety_v2_ai_messages')
})

describe('AiChatBox', () => {
  it('shows welcome message on first render', () => {
    render(<AiChatBox />)
    expect(screen.getByText(/你好/)).toBeInTheDocument()
  })

  it('shows error state when API is not configured', async () => {
    useAiConfigStore.setState({ config: { baseUrl: '', key: '', model: '', enabled: false } })
    render(<AiChatBox />)
    expect(screen.getByText(/未配置 API/)).toBeInTheDocument()
  })

  it('sends a message and shows user bubble', () => {
    render(<AiChatBox />)
    const input = screen.getByRole('textbox')
    fireEvent.change(input, { target: { value: '查看我的位置' } })
    fireEvent.click(screen.getByRole('button', { name: /发送/ }))
    expect(screen.getByText('查看我的位置')).toBeInTheDocument()
  })
})
```

- [ ] **Step 3-6: 实现组件 → 测试 → 提交**

**AiChatBox 实现要点:**
- 首次挂载:初始化 memory(buildSystemPrompt()),发送欢迎消息后渲染
- 发送消息:addMessage(user msg) → 调 chatCompletion → 检查 tool_calls → 对每个 tool_call:
  - 只读:runTool → addMessage(tool result) → 再次调 chatCompletion(循环直到返回 content)
  - 写入:显示确认弹窗 → 用户允许后 runTool(真实执行) → addMessage + 继续循环
- 消息列表使用 flex column + overflow auto,最新消息在底部(auto-scroll)
- 加载状态:发送中禁用输入框,显示 "AI 思考中..."

---

## Task 6: AiCompanionPlaceholder 集成 + ProfilePanel + i18n + HomeSlot

**Files:**
- Modify: `frontend/src/components/AiCompanionPlaceholder.tsx`
- Modify: `frontend/src/components/ProfilePanel.tsx`
- Modify: `frontend/src/i18n/zh-CN.ts`
- Modify: `frontend/src/types/home.ts`
- Update test: `frontend/src/test/aiCompanionPlaceholder.test.tsx`

**Changes:**

### AiCompanionPlaceholder 改动

```typescript
import { useDevModeStore } from '../stores/useDevModeStore'
import { useAiConfigStore } from '../ai/aiConfigStore'
import { AiChatBox } from './AiChatBox'

export function AiCompanionPlaceholder() {
  const devEnabled = useDevModeStore((s) => s.enabled)
  const aiEnabled = useAiConfigStore((s) => s.config.enabled)
  // ... 保持原有占位渲染逻辑 ...

  if (devEnabled && aiEnabled) {
    return <AiChatBox />
  }
  // 保持原来占位
}
```

### ProfilePanel 改动

添加「AI 助手配置」列表项,展开后显示:

```
<FormControl size="small" fullWidth>
  <TextField label="API 地址" value={config.baseUrl} onChange={...} />
  <TextField label="API Key" type="password" value={config.key} onChange={...} />
  <TextField label="模型" value={config.model} onChange={...} />
  <Switch checked={config.enabled} onChange={toggle} label="启用 AI 助手" />
</FormControl>
```

### i18n 新增

```typescript
ai: {
  configTitle: 'AI 助手配置',
  apiUrl: 'API 地址',
  apiKey: 'API Key',
  model: '模型',
  enabled: '启用 AI 助手',
  welcome: '你好!我是你的安全助手。我可以帮你查看位置、联系人、行程信息,也可以帮你创建行程、添加联系人。需要我做什么?',
  send: '发送',
  typing: 'AI 思考中...',
  error: '连接 AI 服务失败,请检查配置和网络',
  toolConfirm: 'AI 请求执行以下操作:{action},是否允许?',
  toolConfirmSos: 'AI 请求触发 SOS!此操作将拨打电话并发送短信。确定要触发吗?',
  notConfigured: '未配置 API,请在「我的」面板设置 AI 助手',
  writeExecuted: '操作已执行: {result}',
  writeRejected: '操作已被用户拒绝',
}
```

---

## Task 7: 最终验证 + 发版 v0.8.0

- [ ] `npm run check` 全绿(原有 333 + 新增 ~25 = ~358 测试)
- [ ] `git add && git commit -m "feat: AI 陪伴助手(debug) v0.8.0"`
- [ ] `git push origin main`
- [ ] 升版本号: `frontend/package.json` 0.8.0, `frontend/package-lock.json`, README 版本表两行
- [ ] `npm run android:release && npm run android:apk:debug`
- [ ] 写 release notes → `gh release create v0.8.0`