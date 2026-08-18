import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { AiChatBox } from '../components/AiChatBox'
import { useAiConfigStore } from '../ai/aiConfigStore'
import { useDevModeStore } from '../stores/useDevModeStore'

beforeEach(() => {
  useAiConfigStore.setState({ config: { baseUrl: 'https://api.openai.com/v1', key: 'sk-test', model: 'gpt-4o-mini', enabled: true }, loaded: true })
  useDevModeStore.setState({ enabled: true, tapProgress: 0, loaded: true })
  localStorage.removeItem('safety_v2_ai_messages')
})

describe('AiChatBox', () => {
  it('shows welcome message on first render', async () => {
    render(<AiChatBox />)
    expect(await screen.findByText(/你好/)).toBeInTheDocument()
  })

  it('renders send button and input field', () => {
    render(<AiChatBox />)
    expect(screen.getByRole('textbox')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /发送/ })).toBeInTheDocument()
  })

  it('sends a message and shows user bubble', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new TypeError('Failed to fetch'))
    render(<AiChatBox />)
    const input = screen.getByRole('textbox')
    fireEvent.change(input, { target: { value: '查看我的位置' } })
    fireEvent.click(screen.getByRole('button', { name: /发送/ }))
    expect(screen.getByText('查看我的位置')).toBeInTheDocument()
  })
})