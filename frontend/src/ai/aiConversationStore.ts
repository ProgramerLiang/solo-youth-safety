import { create } from 'zustand'
import { storage } from '../data/storage'
import type { AiMessage } from '../ai/aiMemory'

const CONVERSATIONS_KEY = 'safety_v2_ai_conversations'
const DEFAULT_TITLE = '新对话'

export interface AiConversation {
  id: string
  title: string
  messages: AiMessage[]
  createdAt: number
  updatedAt: number
}

interface AiConversationState {
  conversations: AiConversation[]
  activeConversationId: string | null
  loaded: boolean
  initialize: () => Promise<void>
  create: (title?: string) => string
  remove: (id: string) => void
  rename: (id: string, title: string) => void
  setActive: (id: string) => void
  addMessage: (msg: AiMessage) => void
  clearMessages: () => void
  setMessages: (msgs: AiMessage[]) => void
  getActiveConversation: () => AiConversation | null
}

let idCounter = Date.now()
function genId(): string { return `conv-${++idCounter}` }

export const useAiConversationStore = create<AiConversationState>((set, get) => ({
  conversations: [],
  activeConversationId: null,
  loaded: false,

  initialize: async () => {
    const saved = await storage.getJson<AiConversation[]>(CONVERSATIONS_KEY)
    if (saved && saved.length > 0) {
      set({ conversations: saved, activeConversationId: saved[0]!.id, loaded: true })
    } else {
      const id = genId()
      const first: AiConversation = { id, title: DEFAULT_TITLE, messages: [{ role: 'system', content: '' }], createdAt: Date.now(), updatedAt: Date.now() }
      set({ conversations: [first], activeConversationId: id, loaded: true })
      await storage.setJson(CONVERSATIONS_KEY, [first])
    }
  },

  create: (title) => {
    const id = genId()
    const conv: AiConversation = {
      id,
      title: title || DEFAULT_TITLE,
      messages: [{ role: 'system', content: '' }],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    const state = get()
    const next = [...state.conversations, conv]
    set({ conversations: next, activeConversationId: id })
    storage.setJson(CONVERSATIONS_KEY, next)
    return id
  },

  remove: (id) => {
    const state = get()
    const next = state.conversations.filter((c) => c.id !== id)
    const newActive = state.activeConversationId === id
      ? (next[0]?.id ?? null)
      : state.activeConversationId
    set({ conversations: next, activeConversationId: newActive })
    storage.setJson(CONVERSATIONS_KEY, next)
  },

  rename: (id, title) => {
    const state = get()
    const next = state.conversations.map((c) =>
      c.id === id ? { ...c, title, updatedAt: Date.now() } : c,
    )
    set({ conversations: next })
    storage.setJson(CONVERSATIONS_KEY, next)
  },

  setActive: (id) => set({ activeConversationId: id }),

  addMessage: (msg) => {
    const state = get()
    const conv = state.conversations.find((c) => c.id === state.activeConversationId)
    if (!conv) return
    const updated = structuredClone(conv)
    updated.messages = [...conv.messages, msg]
    updated.updatedAt = Date.now()
    const next = state.conversations.map((c) => c.id === updated.id ? updated : c)
    set({ conversations: next })
    storage.setJson(CONVERSATIONS_KEY, next)
  },

  clearMessages: () => {
    const state = get()
    const conv = state.conversations.find((c) => c.id === state.activeConversationId)
    if (!conv) return
    const system = conv.messages[0]
    const newMsgs: AiMessage[] = system ? [{ role: system.role, content: system.content ?? '' }] : [{ role: 'system', content: '' }]
    const updated = structuredClone(conv)
    updated.messages = newMsgs
    updated.updatedAt = Date.now()
    const next = state.conversations.map((c) => c.id === updated.id ? updated : c)
    set({ conversations: next })
    storage.setJson(CONVERSATIONS_KEY, next)
  },

  setMessages: (msgs) => {
    const state = get()
    const conv = state.conversations.find((c) => c.id === state.activeConversationId)
    if (!conv) return
    const updated = structuredClone(conv)
    updated.messages = msgs
    updated.updatedAt = Date.now()
    const next = state.conversations.map((c) => c.id === updated.id ? updated : c)
    set({ conversations: next })
    storage.setJson(CONVERSATIONS_KEY, next)
  },

  getActiveConversation: () => {
    const state = get()
    return state.conversations.find((c) => c.id === state.activeConversationId) ?? null
  },
}))