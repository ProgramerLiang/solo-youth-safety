import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { AiPage } from '../pages/AiPage'
import { useAiConfigStore } from '../ai/aiConfigStore'
import { useAiConversationStore } from '../ai/aiConversationStore'

beforeEach(() => {
  localStorage.clear()
  useAiConfigStore.setState({ config: { baseUrl: 'https://api.openai.com/v1', key: 'sk-test', model: 'gpt-4o-mini', enabled: true }, loaded: true })
  useAiConversationStore.setState({ conversations: [], activeConversationId: null, loaded: false })
})

describe('AiPage', () => {
  it('renders title and config button', async () => {
    render(<AiPage onNavigate={vi.fn()} />)
    expect(screen.getByText('AI 陪伴助手')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /对话列表/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /AI 设置/ })).toBeInTheDocument()
  })

  it('navigates to ai-config when clicking settings gear', () => {
    const onNavigate = vi.fn()
    render(<AiPage onNavigate={onNavigate} />)
    fireEvent.click(screen.getByRole('button', { name: /AI 设置/ }))
    expect(onNavigate).toHaveBeenCalledWith('ai-config')
  })

  it('shows conversation list drawer when clicking list button', async () => {
    // Init so there's a conversation
    await useAiConversationStore.getState().initialize()
    render(<AiPage onNavigate={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /对话列表/ }))
    expect(screen.getByText('对话列表')).toBeInTheDocument()
  })

  it('allows creating a new conversation from drawer', async () => {
    await useAiConversationStore.getState().initialize()
    const initialCount = useAiConversationStore.getState().conversations.length
    render(<AiPage onNavigate={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /对话列表/ }))
    fireEvent.click(screen.getByRole('button', { name: /新建对话/ }))
    expect(useAiConversationStore.getState().conversations.length).toBe(initialCount + 1)
  })
})