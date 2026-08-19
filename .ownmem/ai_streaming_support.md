---
name: ai_streaming_support
description: "AI 助手流式输出支持（v0.9.0）的架构和关键文件"
metadata:
  node_type: memory
  type: lesson
  status: active
  scopes: [ai, streaming]
  applies_to: [frontend]
  triggers: ["流式", "streaming", "SSE", "流式支持", "逐字", "aiStreamService", "useAiStream", "AiChatBox", "stop", "停止生成"]
  last_verified: 2026-08-19
  expires_at: null
  authority: observed
  authority_docs: ["readme.md"]
  history_docs: []
  supersedes: []
  code_evidence:
    - {path: "frontend/src/ai/aiStreamService.ts", symbols: ["streamChatCompletion", "StreamEvent"], tests: []}
    - {path: "frontend/src/hooks/useAiStream.ts", symbols: ["useAiStream", "UseAiStreamReturn", "PendingToolConfirm"], tests: []}
    - {path: "frontend/src/components/AiChatBox.tsx", symbols: [], tests: []}
    - {path: "frontend/src/components/AiChatMessage.tsx", symbols: [], tests: []}
  evidence: [commit-c49bae1, commit-7d39c9f, commit-9027b34]
---

# AI 流式支持（v0.9.0）

## 关键文件与职责

| 文件 | 职责 |
|---|---|
| `ai/aiStreamService.ts` | SSE 流式 fetch 封装，解析 OpenAI 兼容的 `stream: true` 响应，产出 `AsyncGenerator<StreamEvent>` |
| `hooks/useAiStream.ts` | 管理流式状态、对话循环、AbortController、工具确认，暴露 `UseAiStreamReturn` |
| `components/AiChatBox.tsx` | 集成 hook，展示流式消息、停止/重试按钮、工具确认对话框 |
| `components/AiChatMessage.tsx` | `isRunning` 时显示闪烁光标 `▊` |

## 架构要点

- **零额外依赖** — 原生 `fetch` + `ReadableStream`
- **智能切换** — 流式同时累积 `content` 和 `tool_calls` delta，结束时按 `finish_reason` 决定走文本回显或工具执行
- **AbortController** 中断 — 用户点击停止按钮即时取消网络请求
- **工具确认** — hook 透出 `pendingToolConfirm`/`confirmTool`，组件弹确认框，避免全局 hack
- **重试** — 截断到最后一条 user 消息，保留上下文重跑对话循环
- **切换对话** — `handleNewConversation` 先 `abort()` 再 `create()` 确保中断

## StreamEvent 接口

```typescript
interface StreamEvent {
  type: 'content' | 'tool_call_start' | 'tool_call_delta' | 'done'
  contentDelta?: string
  toolCall?: { index: number; id?: string; name?: string; arguments?: string }
  finishReason?: 'stop' | 'tool_calls' | 'length' | null
}
```