import { describe, expect, it } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { RiskGroupCard } from '../components/RiskGroupCard'
import type { RiskItem } from '../domain/riskAssessment'

const items: RiskItem[] = [
  { title: '轨迹过旧', detail: '上次采样超过 30 分钟', severity: 'warning', rule: 'staleTrace' },
  { title: '长时间间断', detail: '轨迹有 2h 以上间断', severity: 'attention', rule: 'longGap' },
]

describe('RiskGroupCard', () => {
  it('renders group title and item count', () => {
    render(<RiskGroupCard title="轨迹风险" icon="📍" items={items} />)
    expect(screen.getByText('轨迹风险')).toBeTruthy()
    expect(screen.getByText('2')).toBeTruthy()
  })

  it('renders each risk item title when expanded', () => {
    render(<RiskGroupCard title="轨迹风险" icon="📍" items={items} />)
    expect(screen.getByText(/轨迹过旧/)).toBeTruthy()
    expect(screen.getByText(/长时间间断/)).toBeTruthy()
  })

  it('collapses and expands on click without crashing', () => {
    render(<RiskGroupCard title="轨迹风险" icon="📍" items={items} />)
    const button = screen.getByRole('button')
    fireEvent.click(button)
    // collapse — no crash
  })
})