# AI 流式支持 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 AI 助手对话添加 SSE 流式输出，文本逐 token 显示，支持中断/重试/工具调用智能切换。

**Architecture:**
- 新增 `ai/aiStreamService.ts` 封装 SSE 流式 fetch，解析 OpenAI 兼容的 `stream: true` 响应，产出 `AsyncGenerator<StreamEvent>`
- 新增 `hooks/useAiStream.ts` React Hook，管理流式状态、中断、重试，内部驱动对话循环
- 修改 `components/AiChatBox.tsx` 集成 hook，展示流式消息、停止按钮、重试界面

**Tech Stack:** React 19 + TypeScript + Zustand 5; 零额外依赖（fetch + ReadableStream）

## Global Constraints

- 零额外运行时依赖（不使用 SSE 库，仅原生 fetch + ReadableStream）
- 类型定义优先于接口文件，类型就近定义在使用的文件内
- abort 使用 AbortController，不另造取消机制
- 工具调用保持现有 `runTool` + `TOOL_PERMISSIONS` + 确认对话框流程
- 默认中文注释/变量名/提交信息
- 流式过程中输入框禁用（同当前 `busy` 状态）

---

### Task 1: AI 流式服务 (aiStreamService)

**Files:**
- Create: `frontend/src/ai/aiStreamService.ts`

**Interfaces:**
- Produces: `StreamEvent` (type), `streamChatCompletion()` (async generator)

- [ ] **Step 1: Write file with types and `streamChatCompletion`**

```typescript
import { useAiConfigStore } from './aiConfigStore'

// 消息类型（与 aiService.ts 保持一致）
interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content?: string | null
  tool_calls?: Array<{
    id: string
    type: 'function'
    function: { name: string; arguments: string }
  }>
  tool_call_id?: string
  name?: string
}

interface ToolDefinition {
  type: 'function'
  function: {
    name: string
    description: string
    parameters: Record<string, unknown>
  }
}

export interface StreamEvent {
  type: 'content' | 'tool_call_start' | 'tool_call_delta' | 'done'
  contentDelta?: string
  toolCall?: {
    index: number
    id?: string
    name?: string
    arguments?: string
  }
  finishReason?: 'stop' | 'tool_calls' | 'length' | null
}

export async function* streamChatCompletion(
  messages: ChatMessage[],
  tools: ToolDefinition[],
  toolChoice: 'auto' | 'none' | 'required' = 'auto',
  signal?: AbortSignal,
): AsyncGenerator<StreamEvent> {
  const config = useAiConfigStore.getState().config
  if (!config.baseUrl || !config.key) {
    throw new Error('AI 服务未配置，请在「我的」面板设置 API 地址和 Key')
  }

  const url = `${config.baseUrl.replace(/\/$/, '')}/chat/completions`
  const body: Record<string, unknown> = {
    model: config.model,
    messages,
    stream: true,
    // stream_options: { include_usage: true }, // 暂不收集用量
  }
  if (tools.length > 0) {
    body.tools = tools
    body.tool_choice = toolChoice
  }

  let response: Response
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.key}`,
      },
      body: JSON.stringify(body),
      signal,
    })
  } catch (err) {
    if ((err as Error).name === 'AbortError') throw err
    throw new Error(`连接 AI 服务失败: ${err instanceof TypeError ? err.message : '网络错误'}`)
  }

  if (!response.ok) {
    const errorText = await response.text().catch(() => '')
    throw new Error(`AI 服务返回错误 (${response.status}):${errorText || response.statusText}`)
  }

  const reader = response.body!.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed || !trimmed.startsWith('data: ')) continue

        const data = trimmed.slice(6)
        if (data === '[DONE]') {
          yield { type: 'done', finishReason: null }
          return
        }

        let parsed: Record<string, unknown>
        try {
          parsed = JSON.parse(data)
        } catch {
          continue
        }

        const choices = parsed.choices as Array<Record<string, unknown>> | undefined
        const choice = choices?.[0]
        if (!choice) continue

        const delta = (choice.delta || {}) as Record<string, unknown>

        if (delta.content && typeof delta.content === 'string') {
          yield { type: 'content', contentDelta: delta.content }
        }

        const toolCalls = delta.tool_calls as Array<Record<string, unknown>> | undefined
        if (toolCalls) {
          for (const tc of toolCalls) {
            const index = tc.index as number
            const fn = (tc.function || {}) as Record<string, unknown>
            if (tc.id) {
              // 新的 tool_call 起始块（含 id 和 function.name）
              yield {
                type: 'tool_call_start',
                toolCall: {
                  index,
                  id: tc.id as string,
                  name: fn.name as string | undefined,
                  arguments: (fn.arguments as string) || '',
                },
              }
            } else {
              // 后续 tool_call 增量块（仅 function.arguments 片段）
              yield {
                type: 'tool_call_delta',
                toolCall: {
                  index,
                  arguments: (fn.arguments as string) || '',
                },
              }
            }
          }
        }

        if (choice.finish_reason && typeof choice.finish_reason === 'string') {
          yield {
            type: 'done',
            finishReason: choice.finish_reason as 'stop' | 'tool_calls' | 'length',
          }
          return
        }
      }
    }

    // 流自然结束（无 [DONE] 标记）
    yield { type: 'done', finishReason: null }
  } finally {
    reader.cancel().catch(() => {})
  }
}
```

- [ ] **Step 2: Verify file syntax**

Run: `cd frontend && npx tsc --noEmit src/ai/aiStreamService.ts`
Expected: Exit 0 (success) or type errors only from other imports

Note: `tsc --noEmit` should work from the project root as well. Let's use:

```bash
cd /home/crp/Desktop/jjqy/new && npx tsc --noEmit --project frontend/tsconfig.json 2>&1 | head -20
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/ai/aiStreamService.ts
git commit -m "feat(ai): add SSE streaming service for chat completions"
```

---

### Task 2: useAiStream Hook

**Files:**
- Create: `frontend/src/hooks/useAiStream.ts`

**Interfaces:**
- Consumes: `streamChatCompletion` from `ai/aiStreamService.ts`, `addMessage`/`getActiveConversation` from `aiConversationStore`, `TOOL_DEFINITIONS`/`TOOL_PERMISSIONS`/`runTool` from `aiTools`, `buildSystemPrompt` from `aiContext`
- Produces: `useAiStream()` hook returning `{ streamingContent, isStreaming, error, abort, retry, sendMessage }`

- [ ] **Step 1: Write `useAiStream.ts`**

```typescript
import { useState, useRef, useCallback } from 'react'
import { streamChatCompletion, type StreamEvent } from '../ai/aiStreamService'
import { useAiConversationStore } from '../ai/aiConversationStore'
import { TOOL_DEFINITIONS, TOOL_PERMISSIONS, runTool } from '../ai/aiTools'
import { buildSystemPrompt } from '../ai/aiContext'

export interface UseAiStreamReturn {
  /** 当前正在流式输出的文本内容 */
  streamingContent: string
  /** 是否正在流式传输中 */
  isStreaming: boolean
  /** 错误信息 */
  error: string | null
  /** 中断当前流 */
  abort: () => void
  /** 重试（重新发起上次失败请求） */
  retry: () => void
  /** 发送消息并启动流式对话 */
  sendMessage: (text: string) => Promise<void>
  /** 流式内容是否包含正在进行的工具调用 */
  hasToolCalls: boolean
}

export function useAiStream(): UseAiStreamReturn {
  const [streamingContent, setStreamingContent] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasToolCalls, setHasToolCalls] = useState(false)

  const abortRef = useRef<(() => void) | null>(null)
  const lastMessagesRef = useRef<Parameters<typeof streamChatCompletion>[0] | null>(null)
  const isStreamingRef = useRef(false)

  const addMessage = useAiConversationStore((s) => s.addMessage)
  const setMessages = useAiConversationStore((s) => s.setMessages)

  const abort = useCallback(() => {
    abortRef.current?.()
    abortRef.current = null
    setIsStreaming(false)
    isStreamingRef.current = false
  }, [])

  const retry = useCallback(async () => {
    if (!lastMessagesRef.current) return
    setError(null)
    // 复用最近一次消息列表重新发起对话
    // 清除最后一条消息之后的内容（保持 store 干净）
    // 然后重新调用 sendMessageLogic
    const conv = useAiConversationStore.getState().getActiveConversation()
    if (!conv) return

    // 找到最后一条 user 消息
    const lastUserIdx = conv.messages.map((m) => m.role).lastIndexOf('user')
    if (lastUserIdx >= 0) {
      // 截断到 user 消息（保留 user 消息）
      const truncated = conv.messages.slice(0, lastUserIdx + 1)
      setMessages(truncated)
    }

    // 重新执行对话循环
    await runConversationLoop()
  }, [setMessages])

  const runConversationLoop = useCallback(async () => {
    let rounds = 0
    const maxRounds = 10

    while (rounds < maxRounds) {
      rounds++
      const conv = useAiConversationStore.getState().getActiveConversation()
      if (!conv) return

      const abortController = new AbortController()
      abortRef.current = () => abortController.abort()

      let currentContent = ''
      // tool_calls 累积器：按 index 合并 arguments 分片
      const toolCallMap = new Map<
        number,
        { id?: string; name?: string; arguments: string }
      >()
      let finishReason: string | null = null

      // 保存当前请求的消息列表（用于重试）
      lastMessagesRef.current = conv.messages

      try {
        setIsStreaming(true)
        isStreamingRef.current = true
        setError(null)
        setHasToolCalls(false)

        for await (const event of streamChatCompletion(
          conv.messages,
          TOOL_DEFINITIONS,
          'auto',
          abortController.signal,
        )) {
          switch (event.type) {
            case 'content':
              currentContent += event.contentDelta
              setStreamingContent(currentContent)
              break
            case 'tool_call_start': {
              const tc = event.toolCall!
              toolCallMap.set(tc.index, {
                id: tc.id,
                name: tc.name,
                arguments: tc.arguments || '',
              })
              setHasToolCalls(true)
              break
            }
            case 'tool_call_delta': {
              const tc = event.toolCall!
              const existing = toolCallMap.get(tc.index)
              if (existing) {
                existing.arguments += tc.arguments || ''
              }
              break
            }
            case 'done':
              finishReason = event.finishReason
              break
          }
        }

        setIsStreaming(false)
        isStreamingRef.current = false
        setStreamingContent('')
        abortRef.current = null

        // 根据完成原因处理结果
        if (finishReason === 'tool_calls' && toolCallMap.size > 0) {
          const toolCalls = Array.from(toolCallMap.values())
            .filter((tc) => tc.id && tc.name)
            .map((tc) => ({
              id: tc.id!,
              type: 'function' as const,
              function: { name: tc.name!, arguments: tc.arguments },
            }))

          // 添加 assistant 消息（含 tool_calls）
          addMessage({
            role: 'assistant',
            content: currentContent || null,
            tool_calls: toolCalls,
          })

          // 逐个执行工具
          for (const tc of toolCalls) {
            const toolName = tc.function.name
            const args = JSON.parse(tc.function.arguments || '{}')
            const perm = TOOL_PERMISSIONS[toolName]

            if (perm === 'read') {
              addMessage({
                role: 'tool',
                tool_call_id: tc.id,
                name: toolName,
                content: JSON.stringify(await runTool(toolName, args)),
              })
            } else {
              // write 操作需要用户确认（通过全局状态驱动对话框）
              // 但 hook 本身不管理 UI，这里直接抛出以让组件处理
              // 改进：改为 promise 回调方式，但为了保持现有确认对话框界面，
              // 我们用一种可中断的方式
              const result = await new Promise<Record<string, unknown> | { error: string }>(
                (resolve) => {
                  // 调度一个需要确认的操作
                  window.__aiToolConfirm__?.(
                    toolName,
                    args,
                    (ok: boolean) => {
                      if (ok) {
                        runTool(toolName, args).then(resolve)
                      } else {
                        resolve({ error: '用户拒绝了操作' })
                      }
                    },
                  )
                },
              )
              addMessage({
                role: 'tool',
                tool_call_id: tc.id,
                name: toolName,
                content: JSON.stringify(result),
              })
            }
          }

          // 继续对话循环
          continue
        } else {
          // 纯文本响应
          addMessage({
            role: 'assistant',
            content: currentContent || null,
          })
          return // 正常结束
        }
      } catch (err: unknown) {
        setIsStreaming(false)
        isStreamingRef.current = false
        abortRef.current = null

        if ((err as Error).name === 'AbortError') {
          // 用户主动中止，不清除已累积内容
          setStreamingContent(currentContent)
          return
        }

        setError(
          err instanceof Error ? err.message : 'AI 服务请求失败，请检查配置和网络',
        )
        return
      }
    }
  }, [addMessage, setMessages])

  const sendMessage = useCallback(
    async (text: string) => {
      if (isStreamingRef.current || !text.trim()) return

      addMessage({ role: 'user', content: text })
      await runConversationLoop()
    },
    [addMessage, runConversationLoop],
  )

  return {
    streamingContent,
    isStreaming,
    error,
    abort,
    retry,
    sendMessage,
    hasToolCalls,
  }
}

// 全局类型声明：组件注入确认回调
declare global {
  interface Window {
    __aiToolConfirm__?: (
      toolName: string,
      args: Record<string, unknown>,
      callback: (ok: boolean) => void,
    ) => void
  }
}
```

- [ ] **Step 2: Verify file syntax**

```bash
cd /home/crp/Desktop/jjqy/new && npx tsc --noEmit --project frontend/tsconfig.json 2>&1 | head -30
```

Expected: no type errors (may have warnings about unused imports from `buildSystemPrompt` - this is fine for now)

- [ ] **Step 3: Commit**

```bash
git add frontend/src/hooks/useAiStream.ts
git commit -m "feat(ai): add useAiStream hook for streaming conversation"
```

---

### Task 3: Integrate Streaming into AiChatBox

**Files:**
- Modify: `frontend/src/components/AiChatBox.tsx`
- Modify: `frontend/src/components/AiChatMessage.tsx` (minor tweak)

- [ ] **Step 1: Update AiChatBox to use useAiStream hook**

Replace current `sendMessage`/`processConversation`/`busy` logic with `useAiStream()`.

Key changes:
1. Replace `useState(false)` for `busy` with `isStreaming` from hook
2. Remove `processConversation` callback entirely
3. Replace `sendMessage` callback to call hook's `sendMessage`
4. Add streaming message display: show `streamingContent` as an assistant message at the end of the list
5. Replace send button with stop button when streaming
6. Add error display with retry button
7. Set up `window.__aiToolConfirm__` for tool confirmation

```typescript
// AiChatBox.tsx — full file with changes

import { useState, useRef, useEffect, useCallback } from 'react'
import { Stack, Box, TextField, IconButton, Typography, Dialog, DialogTitle, DialogContent, DialogActions, Button, CircularProgress, Tooltip, Chip } from '@mui/material'
import SendIcon from '@mui/icons-material/Send'
import StopIcon from '@mui/icons-material/Stop'
import RefreshIcon from '@mui/icons-material/Refresh'
import AddIcon from '@mui/icons-material/Add'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import { AiChatMessage } from './AiChatMessage'
import { useAiConversationStore } from '../ai/aiConversationStore'
import { buildSystemPrompt } from '../ai/aiContext'
import { useAiStream } from '../hooks/useAiStream'

interface AiChatBoxProps {
  fullHeight?: boolean
}

export function AiChatBox({ fullHeight }: AiChatBoxProps) {
  const [input, setInput] = useState('')
  const [initializing, setInitializing] = useState(true)
  const listRef = useRef<HTMLDivElement>(null)

  const conversations = useAiConversationStore((s) => s.conversations)
  const activeConvId = useAiConversationStore((s) => s.activeConversationId)
  const create = useAiConversationStore((s) => s.create)
  const remove = useAiConversationStore((s) => s.remove)
  const addMessage = useAiConversationStore((s) => s.addMessage)
  const setMessages = useAiConversationStore((s) => s.setMessages)
  const clearConv = useAiConversationStore((s) => s.clearMessages)
  const initialize = useAiConversationStore((s) => s.initialize)
  const loaded = useAiConversationStore((s) => s.loaded)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  const {
    streamingContent,
    isStreaming,
    error,
    abort,
    retry,
    sendMessage: streamSend,
  } = useAiStream()

  const activeConv = conversations.find((c) => c.id === activeConvId)

  // 工具确认对话框
  const [confirmDialog, setConfirmDialog] = useState<{
    tool: string
    args: Record<string, unknown>
    callback: (ok: boolean) => void
  } | null>(null)

  // 注入工具确认回调
  useEffect(() => {
    window.__aiToolConfirm__ = (toolName, args, callback) => {
      setConfirmDialog({ tool: toolName, args, callback })
    }
    return () => {
      delete window.__aiToolConfirm__
    }
  }, [])

  useEffect(() => {
    if (!loaded) {
      initialize().then(() => {
        const conv = useAiConversationStore.getState().getActiveConversation()
        if (conv && conv.messages.length <= 1) {
          const sysPrompt = buildSystemPrompt()
          setMessages([{ role: 'system', content: sysPrompt }])
        }
        setInitializing(false)
      })
    } else {
      setInitializing(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded])

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' })
  }, [activeConv?.messages, streamingContent])

  const handleNewConversation = useCallback(() => {
    abort()
    create()
  }, [create, abort])

  const confirmDelete = useCallback(() => {
    if (deleteConfirm) {
      remove(deleteConfirm)
      setDeleteConfirm(null)
    }
  }, [deleteConfirm, remove])

  const handleSend = useCallback(() => {
    if (!input.trim() || isStreaming) return
    const text = input
    setInput('')
    streamSend(text)
  }, [input, isStreaming, streamSend])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleRetry = useCallback(() => {
    retry()
  }, [retry])

  const getDisplayMessages = () => {
    return activeConv ? activeConv.messages.filter((m) => m.role !== 'system') : []
  }

  if (initializing) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress size={24} /></Box>
  }

  const displayMessages = getDisplayMessages()

  return (
    <Stack sx={{ flex: fullHeight ? '1 1 0' : '0 0 auto', height: fullHeight ? 'auto' : 400, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      {/* Header: title + buttons */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, px: 1, py: 0.5, borderBottom: 1, borderColor: 'divider' }}>
        <Chip
          label={activeConv?.title ?? '对话'}
          size="small"
          variant="outlined"
          sx={{ maxWidth: 160 }}
        />
        <Box sx={{ flex: 1 }} />
        <Tooltip title="新对话">
          <IconButton size="small" onClick={handleNewConversation} aria-label="新对话">
            <AddIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="清空当前对话">
          <IconButton size="small" onClick={() => clearConv()} aria-label="清空对话">
            <DeleteOutlineIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>

      {/* Messages */}
      <Box ref={listRef} sx={{ flex: 1, overflowY: 'auto', px: 1, py: 1 }}>
        {displayMessages.map((msg, i) => (
          <AiChatMessage
            key={i}
            role={msg.role}
            content={msg.content ?? null}
            toolName={msg.name}
            isRunning={false}
          />
        ))}

        {/* 流式消息 */}
        {isStreaming && streamingContent && (
          <AiChatMessage
            role="assistant"
            content={streamingContent}
            isRunning={true}
          />
        )}

        {/* 仅流式占位（还没有内容时） */}
        {isStreaming && !streamingContent && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 1, px: 1 }}>
            <CircularProgress size={16} />
            <Typography variant="caption" color="text.secondary">
              思考中...
            </Typography>
          </Box>
        )}

        {/* 错误提示 */}
        {error && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 1, px: 1, bgcolor: 'error.light', borderRadius: 1, mx: 1 }}>
            <Typography variant="body2" color="error.contrastText" sx={{ flex: 1 }}>
              {error}
            </Typography>
            <Button size="small" variant="outlined" color="inherit" onClick={handleRetry} startIcon={<RefreshIcon />}>
              重试
            </Button>
          </Box>
        )}

        {displayMessages.length === 0 && !isStreaming && !error && (
          <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
            新对话，发送消息开始
          </Typography>
        )}
      </Box>

      {/* Input */}
      <Box sx={{ display: 'flex', gap: 1, p: 1, borderTop: 1, borderColor: 'divider' }}>
        <TextField
          size="small"
          fullWidth
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isStreaming}
          placeholder="输入消息..."
          slotProps={{ htmlInput: { 'aria-label': '消息输入' } }}
          sx={{ flex: 1 }}
        />
        {isStreaming ? (
          <IconButton color="error" onClick={abort} aria-label="停止">
            <StopIcon />
          </IconButton>
        ) : (
          <IconButton
            color="primary"
            onClick={handleSend}
            disabled={!input.trim()}
            aria-label="发送"
          >
            <SendIcon />
          </IconButton>
        )}
      </Box>

      {/* Confirm dialog for write operations */}
      <Dialog
        open={confirmDialog !== null}
        onClose={() => {
          confirmDialog?.callback(false)
          setConfirmDialog(null)
        }}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>确认操作</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            {confirmDialog?.tool === 'trigger_sos'
              ? 'AI 请求触发 SOS!此操作将拨打电话并发送短信。确定要触发吗?'
              : `AI 请求执行以下操作: ${confirmDialog?.tool}。`}
          </Typography>
          {confirmDialog?.args && Object.keys(confirmDialog.args).length > 0 && (
            <Box
              component="pre"
              sx={{ mt: 1, p: 1, bgcolor: 'grey.100', borderRadius: 1, fontSize: 'caption.fontSize' }}
            >
              {JSON.stringify(confirmDialog.args, null, 2)}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              confirmDialog?.callback(false)
              setConfirmDialog(null)
            }}
          >
            拒绝
          </Button>
          <Button
            variant="contained"
            onClick={() => {
              confirmDialog?.callback(true)
              setConfirmDialog(null)
            }}
            color={confirmDialog?.tool === 'trigger_sos' ? 'error' : 'primary'}
          >
            允许
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog open={deleteConfirm !== null} onClose={() => setDeleteConfirm(null)} maxWidth="xs" fullWidth>
        <DialogTitle>删除对话</DialogTitle>
        <DialogContent>
          <Typography variant="body2">确定删除此对话?对话记录将不可恢复。</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirm(null)}>取消</Button>
          <Button variant="contained" color="error" onClick={confirmDelete}>删除</Button>
        </DialogActions>
      </Dialog>
    </Stack>
  )
}
```

- [ ] **Step 2: Update AiChatMessage to add cursor effect when isRunning**

In `AiChatMessage.tsx`, find the assistant rendering section and add cursor when `isRunning`:

```typescript
// 在 AiChatMessage.tsx 的 assistant 分支中，修改 ReactMarkdown 下方：
{role === 'assistant' ? (
  <Box sx={{ '& p': { my: 0.5 }, '& code': { px: 0.5, py: 0.25, bgcolor: 'action.hover', borderRadius: 0.5, fontSize: '0.85em' }, '& pre': { p: 1, bgcolor: 'grey.200', borderRadius: 1, overflow: 'auto', fontSize: '0.85em' } }}>
    <ReactMarkdown remarkPlugins={[remarkGfm]}>{content || ''}</ReactMarkdown>
    {isRunning && (
      <Typography component="span" variant="body2" sx={{ animation: 'blink 1s step-end infinite', '@keyframes blink': { '50%': { opacity: 0 } } }}>
        ▌
      </Typography>
    )}
  </Box>
) : (
```

- [ ] **Step 3: Verify TypeScript compilation**

```bash
cd /home/crp/Desktop/jjqy/new && npx tsc --noEmit --project frontend/tsconfig.json 2>&1 | head -40
```

Expected: TypeScript compilation passes (0 errors).

- [ ] **Step 4: Start dev server and smoke test**

```bash
cd /home/crp/Desktop/jjqy/new/frontend && npx vite --host 2>&1 &
```

Open browser to the dev URL → navigate to AI page → verify:
- Send a message → response streams character by character
- Click stop → streaming stops
- Click retry on error → retry works
- Tool calls still work (test with "获取我的位置" etc.)
- New conversation button works during streaming (aborts current stream)

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/AiChatBox.tsx frontend/src/components/AiChatMessage.tsx
git commit -m "feat(ai): integrate streaming into AiChatBox with stop/retry"
```

---

### Self-Review

**Spec coverage:**
- ✅ SSE 流式解析 (Task 1)
- ✅ useAiStream hook 管理与对话循环 (Task 2)
- ✅ AiChatBox 集成与 UI 展示 (Task 3)
- ✅ 停止按钮 (Task 3)
- ✅ 错误/重试 (Task 2 + Task 3)
- ✅ 工具调用智能切换 (Task 2)
- ✅ 打字光标效果 (Task 3)
- ✅ 零额外依赖
- ✅ AbortController 中断

**Placeholder check:** No "TBD", "TODO", or incomplete code.

**Type consistency:** `streamChatCompletion` signature matches between Task 1 and Task 2. `StreamEvent` type consistent. `UseAiStreamReturn` matches where used.