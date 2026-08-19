import { useState, useRef, useCallback } from 'react'
import { streamChatCompletion } from '../ai/aiStreamService'
import { useAiConversationStore } from '../ai/aiConversationStore'
import { TOOL_DEFINITIONS, TOOL_PERMISSIONS, runTool } from '../ai/aiTools'

export interface PendingToolConfirm {
  tool: string
  args: Record<string, unknown>
}

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
  /** 有待用户确认的工具调用 */
  pendingToolConfirm: PendingToolConfirm | null
  /** 用户确认或拒绝工具调用 */
  confirmTool: (ok: boolean) => void
}

export function useAiStream(): UseAiStreamReturn {
  const [streamingContent, setStreamingContent] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pendingToolConfirm, setPendingToolConfirm] = useState<PendingToolConfirm | null>(null)

  const abortRef = useRef<(() => void) | null>(null)
  const confirmResolveRef = useRef<((ok: boolean) => void) | null>(null)
  const isStreamingRef = useRef(false)

  const addMessage = useAiConversationStore((s) => s.addMessage)
  const setMessages = useAiConversationStore((s) => s.setMessages)

  const abort = useCallback(() => {
    abortRef.current?.()
    abortRef.current = null
    setIsStreaming(false)
    isStreamingRef.current = false
  }, [])

  const confirmTool = useCallback((ok: boolean) => {
    confirmResolveRef.current?.(ok)
    confirmResolveRef.current = null
    setPendingToolConfirm(null)
  }, [])

  const runConversationLoop = useCallback(async (): Promise<void> => {
    let rounds = 0
    const maxRounds = 10

    while (rounds < maxRounds) {
      rounds++
      const conv = useAiConversationStore.getState().getActiveConversation()
      if (!conv) return

      const abortController = new AbortController()
      abortRef.current = () => abortController.abort()

      let currentContent = ''
      const toolCallMap = new Map<
        number,
        { id?: string; name?: string; arguments: string }
      >()
      let finishReason: string | null | undefined = null

      try {
        setIsStreaming(true)
        isStreamingRef.current = true
        setError(null)

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
          // 构造 tool_calls 数组
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
              // 只读工具，直接执行
              addMessage({
                role: 'tool',
                tool_call_id: tc.id,
                name: toolName,
                content: JSON.stringify(await runTool(toolName, args)),
              })
            } else {
              // 写入工具，需要用户确认
              const confirmed = await new Promise<boolean>((resolve) => {
                confirmResolveRef.current = resolve
                setPendingToolConfirm({ tool: toolName, args })
              })

              if (confirmed) {
                const result = await runTool(toolName, args)
                addMessage({
                  role: 'tool',
                  tool_call_id: tc.id,
                  name: toolName,
                  content: JSON.stringify(result),
                })
              } else {
                addMessage({
                  role: 'tool',
                  tool_call_id: tc.id,
                  name: toolName,
                  content: JSON.stringify({ error: '用户拒绝了操作' }),
                })
              }
            }
          }

          // 继续对话循环（下一轮将包含工具结果）
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
          // 用户主动中止，保留已累积内容到下次
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

  const retry = useCallback(async () => {
    setError(null)
    const conv = useAiConversationStore.getState().getActiveConversation()
    if (!conv) return

    // 找到最后一条 user 消息，截断到该位置
    const msgs = conv.messages
    const lastUserIdx = msgs.map((m) => m.role).lastIndexOf('user')
    if (lastUserIdx >= 0) {
      setMessages(msgs.slice(0, lastUserIdx + 1))
    }

    await runConversationLoop()
  }, [setMessages, runConversationLoop])

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
    pendingToolConfirm,
    confirmTool,
  }
}