import { beforeEach, describe, expect, it } from 'vitest'
import { useAiConversationStore } from '../ai/aiConversationStore'

beforeEach(() => { localStorage.removeItem('safety_v2_ai_conversations') })

describe('useAiConversationStore', () => {
  it('initialize creates a default conversation', async () => {
    await useAiConversationStore.getState().initialize()
    expect(useAiConversationStore.getState().conversations).toHaveLength(1)
    expect(useAiConversationStore.getState().activeConversationId).toBeTruthy()
    expect(useAiConversationStore.getState().loaded).toBe(true)
  })

  it('create adds a new conversation and switches to it', async () => {
    await useAiConversationStore.getState().initialize()
    const newId = useAiConversationStore.getState().create()
    expect(useAiConversationStore.getState().conversations).toHaveLength(2)
    expect(useAiConversationStore.getState().activeConversationId).toBe(newId)
  })

  it('addMessage appends to active conversation', async () => {
    await useAiConversationStore.getState().initialize()
    useAiConversationStore.getState().addMessage({ role: 'user', content: 'hi' })
    const conv = useAiConversationStore.getState().getActiveConversation()
    expect(conv!.messages).toHaveLength(2)
    expect(conv!.messages[1]!.content).toBe('hi')
  })

  it('remove deletes and switches to another conversation', async () => {
    await useAiConversationStore.getState().initialize()
    const id1 = useAiConversationStore.getState().activeConversationId!
    const id2 = useAiConversationStore.getState().create()
    useAiConversationStore.getState().remove(id1)
    expect(useAiConversationStore.getState().conversations).toHaveLength(1)
    expect(useAiConversationStore.getState().activeConversationId).toBe(id2)
  })

  it('rename updates the title', async () => {
    await useAiConversationStore.getState().initialize()
    const id = useAiConversationStore.getState().activeConversationId!
    useAiConversationStore.getState().rename(id, '安全咨询')
    const conv = useAiConversationStore.getState().getActiveConversation()
    expect(conv!.title).toBe('安全咨询')
  })

  it('persists to localStorage and loads back', async () => {
    await useAiConversationStore.getState().initialize()
    const id = useAiConversationStore.getState().activeConversationId!
    useAiConversationStore.getState().rename(id, '测试对话')
    useAiConversationStore.getState().addMessage({ role: 'user', content: 'hello' })

    const saved = JSON.parse(localStorage.getItem('safety_v2_ai_conversations')!)
    expect(saved).toHaveLength(1)
    expect(saved[0].title).toBe('测试对话')
    expect(saved[0].messages).toHaveLength(2)
  })
})