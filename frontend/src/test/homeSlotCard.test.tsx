import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { HomeSlotCard } from '../components/HomeSlotCard'
import { useContactsStore } from '../stores/useContactsStore'

beforeEach(() => {
  useContactsStore.setState({ list: [], editingId: null, draft: { name: '', phone: '' }, loaded: true })
})

describe('HomeSlotCard', () => {
  it('renders the contacts slot title and jumps to contacts on click', () => {
    const onNavigate = vi.fn()
    render(<HomeSlotCard slotKey="contacts" onNavigate={onNavigate} />)
    expect(screen.getByText('紧急联系人')).toBeInTheDocument()
    fireEvent.click(screen.getByText('紧急联系人'))
    expect(onNavigate).toHaveBeenCalledWith('contacts')
  })

  it('shows an add-contact shortcut when the contacts list is empty', () => {
    useContactsStore.setState({ list: [] })
    const onNavigate = vi.fn()
    render(<HomeSlotCard slotKey="contacts" onNavigate={onNavigate} />)
    expect(screen.getByText('暂无联系人,点击添加')).toBeInTheDocument()
  })

  it('renders the safety trip slot', () => {
    render(<HomeSlotCard slotKey="safetyTrip" onNavigate={vi.fn()} />)
    expect(screen.getByText('安全行程')).toBeInTheDocument()
  })
})