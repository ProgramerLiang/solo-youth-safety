# AI 流式支持 (Streaming Support) — 设计规范

日期：2026-08-19
状态：草稿

## 概述

为 AI 助手对话添加流式（SSE）输出支持，使 AI 回复逐 token 显示，提升交互体验。支持中断、重试和智能工具调用切换。

## 背景

当前 AI 对话使用非流式 POST 请求 `chatCompletion()`，整个响应返回后才展示。用户在等待期间只看到加载旋转图标，体验沉闷。需升级至 `stream: true` 流式模式。

## 技术栈约束

- 前端：React 19 + TypeScript + Zustand 5
- AI API：OpenAI 兼容接口（可配置 `baseUrl`/`key`/`model`），支持 `stream: true` SSE 格式
- 网络：fetch + ReadableStream（无额外依赖）
- 无后端转发，浏览器直接请求 AI API

## 新增/修改文件

| 文件 | 类型 | 说明 |
|---|---|---|
| `src/ai/aiStreamService.ts` | 新增 | SSE 流式 fetch 封装，事件解析 |
| `src/hooks/useAiStream.ts` | 新增 | React hook 管理流式状态、abort、重试、对话循环 |
| `src/components/AiChatBox.tsx` | 修改 | 集成 hook，展示流式内容、停止按钮、重试 |
| `src/components/AiChatMessage.tsx` | 微调 | 使用已有 isRunning prop 实现打字光标效果 |
| `src/ai/aiService.ts` | 无改动 | 保留非流式接口备用 |

## 架构

### 数据流

```
                   ┌─────────────────┐
                   │  AiChatBox       │
                   │  (组件)          │
                   └────────┬────────┘
                            │ useAiStream()
                            ▼
                   ┌─────────────────┐
                   │  useAiStream     │
                   │  (React Hook)    │
                   │                  │
                   │  streamingContent│──→ AiChatBox 渲染流式消息
                   │  isStreaming     │──→ 控制停止按钮/加载态
                   │  error           │──→ 显示重试
                   │  abort()         │──→ 用户取消
                   │  retry()         │──→ 重试失败请求
                   │  sendMessage()   │──→ 发起对话
                   └────────┬────────┘
                            │ streamChatCompletion()
                            ▼
                   ┌─────────────────┐
                   │ aiStreamService  │
                   │ (SSE 解析层)    │
                   │                  │
                   │ fetch +          │
                   │ AbortController  │
                   │ ReadableStream   │
                   └────────┬────────┘
                            │ SSE events
                            ▼
                   ┌─────────────────┐
                   │  AI API          │
                   │  /chat/completions│
                   │  {stream: true}  │
                   └─────────────────┘
```

### 对话循环流程

```
sendMessage(text)
  │
  ├─① addMessage({role:'user', content:text})
  │
  └─② conversation loop (max 10 rounds)
       │
       ├─③ streamChatCompletion(messages, tools)
       │    ├─ SSE: {delta:{content:"你好"}} → 追加 streamingContent
       │    ├─ SSE: {delta:{content:"有什么"}} → 追加 streamingContent
       │    ├─ SSE: {delta:{tool_calls:[...]}} → 累积 streamingToolCalls
       │    ├─ SSE: {delta:{}} + finish_reason → 结束
       │    └─ SSE: [DONE] → 流结束
       │
       ├─④ 根据 finish_reason 分支:
       │   ├─ "stop" → addMessage(assistant, content) → 结束循环
       │   ├─ "tool_calls" → addMessage(assistant, tool_calls)
       │   │                 → 逐个执行工具 (runTool)
       │   │                 → addMessage(tool results)
       │   │                 → 继续循环 ③
       │   └─ "length" → 截断提示, 继续循环
       │
       └─⑤ 异常处理
            ├─ 网络错误 → error + 重试按钮
            └─ abort → 保留已收内容, 可重发
```

## 接口设计

### aiStreamService.ts

```typescript
interface StreamEvent {
  type: 'content' | 'tool_call_start' | 'tool_call_delta' | 'done'
  /** 文本增量 */
  contentDelta?: string
  /** tool_call 索引+数据 */
  toolCall?: {
    index: number
    id?: string          // 首次出现时携带
    name?: string        // 首次出现时携带
    arguments?: string   // 分片累积
  }
  finishReason?: 'stop' | 'tool_calls' | 'length' | null
}

/**
 * 流式对话补全
 * 返回 AsyncGenerator，逐个产出 StreamEvent
 */
export async function* streamChatCompletion(
  messages: ChatMessage[],
  tools: ToolDefinition[],
  toolChoice?: 'auto' | 'none' | 'required',
  signal?: AbortSignal,
): AsyncGenerator<StreamEvent>
```

### useAiStream.ts — Hook 签名

```typescript
interface UseAiStreamOptions {
  /** 自动滚动到底部 */
  autoScroll?: boolean
}

interface UseAiStreamReturn {
  /** 当前正在流式输出的文本内容 */
  streamingContent: string
  /** 是否正在流式传输中 */
  isStreaming: boolean
  /** 错误信息 */
  error: string | null
  /** 中断当前流 */
  abort: () => void
  /** 重试（重新发起上次请求） */
  retry: () => void
  /** 发送消息并启动流式对话 */
  sendMessage: (text: string) => Promise<void>
}

export function useAiStream(options?: UseAiStreamOptions): UseAiStreamReturn
```

### AiChatBox 行为变更

| 场景 | 行为 |
|---|---|
| 空闲 | 输入框 + 发送按钮（同当前） |
| 流式中 | 输入框禁用 + 停止按钮（替代发送）+ 消息区末尾显示流式消息 |
| 流式消息展示 | AiChatMessage 带 `isRunning` prop，末尾闪烁光标 `▌` |
| 错误 | 错误提示 + "重试" / "新对话" 按钮 |
| 工具调用 | 流式结束 → 隐藏流式消息 → 执行工具（同当前工具状态显示） |

## SSE 解析

### OpenAI 流式格式解析

```
data: {"id":"...","object":"chat.completion.chunk","choices":[{"index":0,"delta":{"role":"assistant"},"finish_reason":null}]}

data: {"id":"...","choices":[{"index":0,"delta":{"content":"你好"},"finish_reason":null}]}

data: {"id":"...","choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}

data: [DONE]
```

工具调用格式：

```
data: {"choices":[{"index":0,"delta":{"role":"assistant","content":null,"tool_calls":[{"index":0,"id":"call_xxx","type":"function","function":{"name":"get_location","arguments":""}}]},"finish_reason":null}]}

data: {"choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"function":{"arguments":"{\"la"}}]},"finish_reason":null}]}

data: {"choices":[{"index":0,"delta":{},"finish_reason":"tool_calls"}]}
```

解析策略：
1. 按 `\n\n` 分割事件块
2. 每块取 `data: ` 后的 JSON
3. 合并 tool_call 字段（按 index 合并增量 arguments）
4. `[DONE]` 信号结束流

## 错误处理

| 错误类型 | 处理 |
|---|---|
| 网络断开 | `error` 状态 + "重试" 按钮 |
| HTTP 错误 | `error` 状态 + 显示状态码和错误信息 |
| 用户中断 | AbortController.abort() → 保留已收内容 |
| 解析错误 | 跳过异常 chunk，继续接收 |
| 超时 | 设置合理 timeout，超时后 abort + 错误提示 |

## 重试逻辑

1. 记录最后一次请求的 `messages` 参数
2. 出错时保存到 ref
3. 用户点击重试 → 清除最后一段 `error` 消息后的内容 → 重新发送

## 边界情况

- **空回复**：模型返回空 `content` 时显示"（空回复）"
- **多个 choice**：仅处理 `choices[0]`（当前配置只返回一个）
- **流结束后的工具调用**：stream 完结后检查 `streamingToolCalls`，不为空则执行
- **并发消息**：流式进行中禁用输入（当前 `busy` 状态已覆盖）
- **切换对话**：切换时如果正在流式，自动 abort

## 非目标（明确不包含）

- 不修改 Zusand store 的对话持久化方式
- 不引入第三方 SSE 库
- 不做 WebSocket 或其他传输协议
- 不改动 AI 工具定义和权限系统

## 验收标准

1. ✅ 发送消息后 AI 回复逐字显示，而不是一次性出现
2. ✅ 流式过程中可点击"停止"中断生成
3. ✅ 中断后可重新发送消息
4. ✅ 工具调用正常工作（文本流式结束后执行工具）
5. ✅ 网络错误时显示提示，可重试
6. ✅ 切换对话时中断当前流
7. ✅ 流式文本保留 Markdown 格式
8. ✅ 无额外运行时依赖