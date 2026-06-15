import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DashboardDisclaimer } from '../components/DashboardDisclaimer'

describe('DashboardDisclaimer', () => {
  it('renders local-only disclaimer text', () => {
    render(<DashboardDisclaimer />)
    expect(screen.getByText(/仅本地/)).toBeTruthy()
    expect(screen.getByText(/不会自动通知/)).toBeTruthy()
  })
})