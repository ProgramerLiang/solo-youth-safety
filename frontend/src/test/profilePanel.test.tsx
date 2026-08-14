import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ProfilePanel } from '../components/ProfilePanel'
import { useDevModeStore } from '../stores/useDevModeStore'
import { useHomeStore } from '../stores/useHomeStore'

beforeEach(() => {
  useDevModeStore.setState({ enabled: false, tapProgress: 0, loaded: true })
  useHomeStore.setState({ slots: ['safetyTrip', 'contacts', 'trackingFreshness', 'smartRisk'], companionEnabled: true, loaded: true })
})

describe('ProfilePanel', () => {
  it('navigates to config when tapping emergency config', () => {
    const onNavigate = vi.fn()
    render(<ProfilePanel onNavigate={onNavigate} onClose={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: '紧急配置' }))
    expect(onNavigate).toHaveBeenCalledWith('config')
  })

  it('hides the data tools entry when developer mode is off', () => {
    render(<ProfilePanel onNavigate={vi.fn()} onClose={vi.fn()} />)
    expect(screen.queryByRole('button', { name: '数据工具' })).not.toBeInTheDocument()
  })
})