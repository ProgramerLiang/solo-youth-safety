import { describe, expect, it, beforeEach } from 'vitest'
import { addMessage, getMessages, clearMessages, initializeMemory } from '../ai/aiMemory'

beforeEach(() => { localStorage.removeItem('safety_v2_ai_messages') })

describe('aiMemory', () => {
  it('starts empty after init', async () => {
    await initializeMemory('system prompt')
    const msgs = getMessages()
    expect(msgs.length).toBe(1)
    expect(msgs[0].role).toBe('system')
    expect(msgs[0].content).toBe('system prompt')
  })

  it('addMessage appends message', async () => {
    await initializeMemory('sys')
    addMessage({ role: 'user', content: 'hi' })
    expect(getMessages().length).toBe(2)
    expect(getMessages()[1].content).toBe('hi')
  })

  it('trims to 50 messages max', async () => {
    await initializeMemory('sys')
    for (let i = 0; i < 60; i++) addMessage({ role: 'user', content: `msg-${i}` })
    expect(getMessages().length).toBe(50)
  })

  it('clearMessages resets to system only', async () => {
    await initializeMemory('sys')
    addMessage({ role: 'user', content: 'hi' })
    clearMessages()
    expect(getMessages().length).toBe(1)
    expect(getMessages()[0].role).toBe('system')
  })

  it('persists to localStorage and loads back', async () => {
    await initializeMemory('sys')
    addMessage({ role: 'user', content: 'hello' })
    const saved = JSON.parse(localStorage.getItem('safety_v2_ai_messages')!)
    expect(saved.length).toBe(2)
  })
})