import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { EmptyRiskGroup } from '../components/EmptyRiskGroup'

describe('EmptyRiskGroup', () => {
  it('renders positive message', () => {
    render(<EmptyRiskGroup message="轨迹追踪正常" />)
    expect(screen.getByText('轨迹追踪正常')).toBeTruthy()
  })

  it('renders with check icon', () => {
    const { container } = render(<EmptyRiskGroup message="配置完整" />)
    expect(container.querySelector('[data-testid="CheckCircleIcon"]')).toBeTruthy()
  })
})