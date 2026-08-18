import { storage } from '../data/storage'

const MEMORY_KEY = 'safety_v2_ai_messages'
const MAX_MESSAGES = 50

export interface AiMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content?: string
  tool_calls?: Array<{
    id: string
    type: 'function'
    function: { name: string; arguments: string }
  }>
  tool_call_id?: string
  name?: string
}

let messages: AiMessage[] = []

export async function initializeMemory(systemPrompt: string): Promise<void> {
  const saved = await storage.getJson<AiMessage[]>(MEMORY_KEY)
  if (saved && saved.length > 0 && saved[0].role === 'system') {
    messages = saved
  } else {
    messages = [{ role: 'system', content: systemPrompt }]
  }
}

export function addMessage(msg: AiMessage): void {
  messages.push(msg)
  if (messages.length > MAX_MESSAGES) {
    const system = messages[0]
    messages = [system, ...messages.slice(-(MAX_MESSAGES - 1))]
  }
  save()
}

export function getMessages(): AiMessage[] {
  return messages
}

export function clearMessages(): void {
  const system = messages[0]
  messages = system.role === 'system' ? [system] : [{ role: 'system', content: '' }]
  save()
}

function save(): void {
  storage.setJson(MEMORY_KEY, messages)
}