import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MembershipPage } from '../pages/MembershipPage'

describe('MembershipPage', () => {
  it('renders four benefit cards and a coming-soon notice', () => {
    render(<MembershipPage />)
    expect(screen.getByText('会员')).toBeInTheDocument()
    expect(screen.getByText('本地优先守护')).toBeInTheDocument()
    expect(screen.getByText('智能场景扩展')).toBeInTheDocument()
    expect(screen.getByText('陪伴助手抢先体验')).toBeInTheDocument()
    expect(screen.getByText('数据加密与备份')).toBeInTheDocument()
  })
})