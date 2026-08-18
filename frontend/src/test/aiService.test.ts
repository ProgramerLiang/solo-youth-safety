import { describe, expect, it, vi, beforeEach } from 'vitest'
import { chatCompletion } from '../ai/aiService'
import { useAiConfigStore } from '../ai/aiConfigStore'

beforeEach(() => {
  useAiConfigStore.setState({ config: { baseUrl: 'https://api.openai.com/v1', key: 'sk-test', model: 'gpt-4o-mini', enabled: true }, loaded: true })
})

describe('chatCompletion', () => {
  it('sends correct request body and returns response', async () => {
    const mockResponse = { choices: [{ message: { role: 'assistant', content: 'Hello!' } }] }
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true, json: async () => mockResponse,
    } as Response)

    const result = await chatCompletion([{ role: 'user', content: 'hi' }], [])
    expect(result.choices[0].message.content).toBe('Hello!')
    expect(fetch).toHaveBeenCalledWith(
      'https://api.openai.com/v1/chat/completions',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer sk-test' }),
      }),
    )
  })

  it('sends tools in the request body', async () => {
    const mockResponse = { choices: [{ message: { role: 'assistant', content: null, tool_calls: [{ id: 'call_1', type: 'function', function: { name: 'get_contacts', arguments: '{}' } }] } }] }
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true, json: async () => mockResponse,
    } as Response)

    const tools = [{ type: 'function' as const, function: { name: 'get_contacts', description: '', parameters: {} } }]
    const result = await chatCompletion([{ role: 'user', content: 'contacts' }], tools)
    expect(result.choices[0].message.tool_calls).toHaveLength(1)
    expect(result.choices[0].message.tool_calls![0].function.name).toBe('get_contacts')
  })

  it('throws on HTTP error', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: false, status: 401, statusText: 'Unauthorized', text: async () => 'Invalid key',
    } as Response)

    await expect(chatCompletion([{ role: 'user', content: 'hi' }], [])).rejects.toThrow(/401/)
  })

  it('throws on network error', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new TypeError('Failed to fetch'))
    await expect(chatCompletion([{ role: 'user', content: 'hi' }], [])).rejects.toThrow(/Failed to fetch/)
  })
})