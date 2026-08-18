import { describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ScenesPanel } from '../components/ScenesPanel'
import { useUiStore } from '../stores/useUiStore'

describe('ScenesPanel', () => {
  it('renders four scene entries and navigates on click', () => {
    const onNavigate = vi.fn()
    useUiStore.setState({ scrollAnchor: null })
    render(<ScenesPanel onNavigate={onNavigate} onClose={vi.fn()} />)

    // 先切到「功能」Tab
    fireEvent.click(screen.getByRole('tab', { name: '功能' }))

    fireEvent.click(screen.getByRole('button', { name: '智能规则' }))
    expect(onNavigate).toHaveBeenCalledWith('smartRules')

    fireEvent.click(screen.getByRole('button', { name: '地理围栏' }))
    expect(useUiStore.getState().scrollAnchor).toBe('geofence')
    expect(onNavigate).toHaveBeenCalledWith('config')
  })
})