import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { App } from '../App'
import { hashPin } from '../domain/privacyLock'
import { usePrivacyLockStore } from '../stores/usePrivacyLockStore'

beforeEach(() => {
  localStorage.clear()
  usePrivacyLockStore.setState({ locked: false, loaded: false, config: null, lockTimer: null })
})

describe('App privacy lock startup gate', () => {
  it('does not render app shell before privacy lock config is loaded', async () => {
    localStorage.setItem('safety_v2_privacy_lock', JSON.stringify({ enabled: true, pinHash: hashPin('1234') }))

    render(<App />)

    expect(screen.getByLabelText('正在加载隐私设置')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByText('Privacy Lock')).toBeInTheDocument())
    expect(screen.queryByLabelText('正在加载隐私设置')).not.toBeInTheDocument()
  })
})
