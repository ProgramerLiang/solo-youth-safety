import { useAiConfigStore } from './aiConfigStore'

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

interface ChatCompletionResponse {
  choices: Array<{
    message: {
      role: string
      content?: string | null
      tool_calls?: Array<{
        id: string
        type: 'function'
        function: { name: string; arguments: string }
      }>
    }
  }>
}

export async function chatCompletion(
  messages: ChatMessage[],
  tools: ToolDefinition[],
  toolChoice?: 'auto' | 'none' | 'required',
): Promise<ChatCompletionResponse> {
  const config = useAiConfigStore.getState().config
  if (!config.baseUrl || !config.key) {
    throw new Error('AI 服务未配置,请在「我的」面板设置 API 地址和 Key')
  }

  const url = `${config.baseUrl.replace(/\/$/, '')}/chat/completions`
  const body: Record<string, unknown> = {
    model: config.model,
    messages,
  }
  if (tools.length > 0) {
    body.tools = tools
    body.tool_choice = toolChoice ?? 'auto'
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
    })
  } catch (err) {
    throw new Error(`连接 AI 服务失败:${err instanceof TypeError ? err.message : '网络错误'}`)
  }

  if (!response.ok) {
    const errorText = await response.text().catch(() => '')
    throw new Error(`AI 服务返回错误 (${response.status}):${errorText || response.statusText}`)
  }

  const data = (await response.json()) as ChatCompletionResponse
  return data
}