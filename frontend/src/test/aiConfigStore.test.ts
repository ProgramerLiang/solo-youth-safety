import { beforeEach, describe, expect, it } from 'vitest'
import { useAiConfigStore } from '../ai/aiConfigStore'

beforeEach(() => { localStorage.clear() })

describe('aiConfigStore', () => {
  it('defaults to disabled with OpenAI defaults', () => {
    expect(useAiConfigStore.getState().config.enabled).toBe(false)
    expect(useAiConfigStore.getState().config.baseUrl).toBe('https://api.openai.com/v1')
    expect(useAiConfigStore.getState().config.model).toBe('gpt-4o-mini')
  })

  it('setConfig updates and persists', async () => {
    await useAiConfigStore.getState().setConfig({ baseUrl: 'http://localhost:11434/v1', key: 'ollama', model: 'llama3' })
    const saved = JSON.parse(localStorage.getItem('safety_v2_ai_config')!)
    expect(saved.baseUrl).toBe('http://localhost:11434/v1')
    expect(useAiConfigStore.getState().config.enabled).toBe(false)
  })

  it('toggle changes enabled state', () => {
    useAiConfigStore.getState().toggle()
    expect(useAiConfigStore.getState().config.enabled).toBe(true)
  })

  it('initialize loads from storage', async () => {
    localStorage.setItem('safety_v2_ai_config', JSON.stringify({ baseUrl: 'http://test', key: 'k', model: 'm', enabled: true }))
    useAiConfigStore.setState({ config: { baseUrl: '', key: '', model: '', enabled: false }, loaded: false })
    await useAiConfigStore.getState().initialize()
    expect(useAiConfigStore.getState().config.baseUrl).toBe('http://test')
    expect(useAiConfigStore.getState().config.enabled).toBe(true)
    expect(useAiConfigStore.getState().loaded).toBe(true)
  })
})