import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { AiConfigPage } from '../pages/AiConfigPage'
import { useAiConfigStore } from '../ai/aiConfigStore'

beforeEach(() => {
  useAiConfigStore.setState({ config: { baseUrl: 'https://api.openai.com/v1', key: 'sk-test', model: 'gpt-4o-mini', enabled: false }, loaded: true })
})

describe('AiConfigPage', () => {
  it('renders config fields and back button', () => {
    render(<AiConfigPage onNavigate={vi.fn()} />)
    expect(screen.getByText('AI 助手设置')).toBeInTheDocument()
    expect(screen.getByLabelText(/启用 AI 助手/)).toBeInTheDocument()
    expect(screen.getByLabelText(/API 地址/)).toBeInTheDocument()
    expect(screen.getByLabelText(/API Key/)).toBeInTheDocument()
    expect(screen.getByLabelText(/模型/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /返回/ })).toBeInTheDocument()
  })

  it('toggles AI enabled when clicking switch', () => {
    render(<AiConfigPage onNavigate={vi.fn()} />)
    const toggle = screen.getByLabelText(/启用 AI 助手/)
    expect(toggle).not.toBeChecked()
    fireEvent.click(toggle)
    expect(toggle).toBeChecked()
  })

  it('navigates back when clicking back button', () => {
    const onNavigate = vi.fn()
    render(<AiConfigPage onNavigate={onNavigate} />)
    fireEvent.click(screen.getByRole('button', { name: /返回/ }))
    expect(onNavigate).toHaveBeenCalledWith('profile')
  })
})