import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { OverviewPage } from '../pages/OverviewPage'

describe('OverviewPage', () => {
  it('does not render page shortcut navigation inside the overview content', () => {
    render(<OverviewPage />)

    expect(screen.queryByRole('button', { name: 'SOS' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '配置' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '联系人' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '历史' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '轨迹' })).not.toBeInTheDocument()
  })

  it('renders the risk card section', () => {
    render(<OverviewPage />)
    expect(screen.getByText('风险提示')).toBeInTheDocument()
    expect(screen.getByText('仅基于本机数据提示，不会自动触发 SOS。')).toBeInTheDocument()
  })
})