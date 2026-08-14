import { describe, expect, it, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { AiCompanionPlaceholder } from '../components/AiCompanionPlaceholder'
import { useHomeStore } from '../stores/useHomeStore'

beforeEach(() => {
  useHomeStore.setState({ companionEnabled: true })
})

describe('AiCompanionPlaceholder', () => {
  it('renders the coming-soon placeholder when enabled', () => {
    render(<AiCompanionPlaceholder />)
    expect(screen.getByText(/AI 陪伴助手/)).toBeInTheDocument()
    expect(screen.getByText(/即将上线/)).toBeInTheDocument()
  })

  it('collapses to a single line when disabled via the toggle', () => {
    render(<AiCompanionPlaceholder />)
    fireEvent.click(screen.getByRole('button', { name: '禁用陪伴占位' }))
    expect(useHomeStore.getState().companionEnabled).toBe(false)
    expect(screen.getByText(/已禁用/)).toBeInTheDocument()
  })
})