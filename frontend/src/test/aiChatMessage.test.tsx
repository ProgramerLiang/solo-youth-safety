import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AiChatMessage } from '../components/AiChatMessage'

describe('AiChatMessage', () => {
  it('renders user message', () => {
    render(<AiChatMessage role="user" content="你好" />)
    expect(screen.getByText('你好')).toBeInTheDocument()
  })

  it('renders assistant message with avatar', () => {
    render(<AiChatMessage role="assistant" content="我是助手" />)
    expect(screen.getByText('我是助手')).toBeInTheDocument()
    expect(screen.getByText(/🤖/)).toBeInTheDocument()
  })

  it('renders tool call in progress state', () => {
    render(<AiChatMessage role="tool" toolName="get_location" isRunning />)
    expect(screen.getByText(/获取位置/)).toBeInTheDocument()
  })

  it('renders tool result', () => {
    render(<AiChatMessage role="tool" toolName="get_location" content='{"lat":31.23,"lng":121.47}' />)
    expect(screen.getByText(/31.23/)).toBeInTheDocument()
  })
})