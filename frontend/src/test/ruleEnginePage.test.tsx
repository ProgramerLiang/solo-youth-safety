import { describe, expect, it, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { RuleEnginePage } from '../pages/RuleEnginePage'
import { useRuleEngineStore } from '../stores/useRuleEngineStore'

beforeEach(async () => {
  useRuleEngineStore.setState({ rules: [], loaded: true })
})

describe('RuleEnginePage', () => {
  it('shows empty state when no rules exist', async () => {
    render(<RuleEnginePage />)
    expect(screen.getByText('暂无智能规则')).toBeInTheDocument()
    expect(screen.getByText('创建一条规则，让应用在满足条件时自动提醒你')).toBeInTheDocument()
  })

  it('renders rule cards with name, conditions, actions', async () => {
    useRuleEngineStore.setState({
      rules: [{
        id: 'r1', name: '测试规则', enabled: true,
        conditions: [{ signal: 'riskLevel', operator: 'gte', value: 'attention', label: '风险 ≥ attention' }],
        actions: [{ type: 'localNotification', config: { title: '通知', body: '触发' }, label: '通知' }],
        cooldownMinutes: 5, lastFiredAt: null,
      }],
      loaded: true,
    })
    render(<RuleEnginePage />)
    expect(screen.getByText('测试规则')).toBeInTheDocument()
    expect(screen.getByText('风险 ≥ attention')).toBeInTheDocument()
  })

  it('shows create dialog on button click', async () => {
    render(<RuleEnginePage />)
    fireEvent.click(screen.getByText('创建规则'))
    expect(screen.getByText('新建智能规则')).toBeInTheDocument()
  })
})
