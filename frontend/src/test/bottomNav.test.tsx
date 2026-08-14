import { describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { BottomNav } from '../components/BottomNav'

describe('BottomNav', () => {
  it('renders five navigation buttons', () => {
    render(<BottomNav activePageId="home" onNavigate={vi.fn()} />)
    expect(screen.getByRole('button', { name: /首页/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /消息/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /场景/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /会员/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /我的/ })).toBeInTheDocument()
  })

  it('navigates directly when tapping home tab', () => {
    const onNavigate = vi.fn()
    render(<BottomNav activePageId="history" onNavigate={onNavigate} />)
    fireEvent.click(screen.getByRole('button', { name: /首页/ }))
    expect(onNavigate).toHaveBeenCalledWith('home')
  })
})