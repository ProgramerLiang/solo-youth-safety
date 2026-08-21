import { useAiConfigStore } from './aiConfigStore'
import { buildAllBundles, mergeBundles, findOffendingBundleKey } from './reasoningParams'

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
  type: 'content' | 'reasoning' | 'tool_call_start' | 'tool_call_delta' | 'done'
  contentDelta?: string
  reasoningDelta?: string
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

  // 构建所有推理参数组（先全发，遇错再减）
  const allBundles = buildAllBundles(config.reasoningEffort)
  let activeBundles = [...allBundles]

  function buildBody(): Record<string, unknown> {
    const body: Record<string, unknown> = {
      model: config.model,
      messages,
      stream: true,
    }
    if (tools.length > 0) {
      body.tools = tools
      body.tool_choice = toolChoice
    }
    if (activeBundles.length > 0) {
      Object.assign(body, mergeBundles(activeBundles))
    }
    return body
  }

  let response!: Response

  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.key}`,
        },
        body: JSON.stringify(buildBody()),
        signal,
      })
    } catch (err) {
      if ((err as Error).name === 'AbortError') throw err
      throw new Error(`连接 AI 服务失败: ${err instanceof TypeError ? err.message : '网络错误'}`)
    }

    if (response.ok) break

    // 400 — 尝试移除不支持的推理参数后重试
    if (response.status === 400 && activeBundles.length > 0) {
      const errorBody = await response.json().catch(() => ({}))
      const key = findOffendingBundleKey(400, errorBody, activeBundles)
      if (key) {
        activeBundles = activeBundles.filter((b) => b.key !== key)
        continue
      }
    }

    // 非可重试错误
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

        // 推理模型（如 deepseek-v4-flash）先流式输出 reasoning_content（思考过程）
        if (delta.reasoning_content && typeof delta.reasoning_content === 'string') {
          yield { type: 'reasoning', reasoningDelta: delta.reasoning_content }
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