import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { RiskLevelIndicator } from '../components/RiskLevelIndicator'

describe('RiskLevelIndicator', () => {
  it('renders ok (safe) with green color', () => {
    const { container } = render(<RiskLevelIndicator level="ok" />)
    expect(screen.getByText(/安全/)).toBeTruthy()
    expect(screen.getByText(/所有检查正常/)).toBeTruthy()
    expect(container.querySelector('[data-level="ok"]')).toBeTruthy()
  })

  it('renders attention (caution) with yellow color', () => {
    render(<RiskLevelIndicator level="attention" />)
    const headings = screen.getAllByText(/注意/)
    expect(headings.length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText(/需要注意/)).toBeTruthy()
  })

  it('renders warning (danger) with red color', () => {
    render(<RiskLevelIndicator level="warning" />)
    expect(screen.getByText(/警告/)).toBeTruthy()
    expect(screen.getByText(/立即关注/)).toBeTruthy()
  })
})