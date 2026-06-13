import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { CssBaseline, ThemeProvider as MuiThemeProvider } from '@mui/material'
import { AppShell } from '../shell/AppShell'
import { useDevModeStore } from '../stores/useDevModeStore'
import { useUiStore } from '../stores/useUiStore'
import { buildTheme } from '../theme/createTheme'

function emotionStyleText(): string {
  return Array.from(document.querySelectorAll('style[data-emotion]'))
    .map((style) => style.textContent ?? '')
    .join('\n')
}

function generatedClassNames(element: Element): string[] {
  return Array.from(element.classList).filter((className) => className.startsWith('css-'))
}

function hasGeneratedRule(element: Element, declarations: string[]): boolean {
  const styleText = emotionStyleText()
  return generatedClassNames(element).some((className) => {
    const selector = `.${className}`
    return declarations.every((declaration) => styleText.includes(selector) && styleText.includes(declaration))
  })
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('AppShell navigation', () => {
  it('keeps page navigation out of the top bar', () => {
    const onNavigate = vi.fn()
    useUiStore.setState({ drawerOpen: false, drawerOffset: 0 })
    vi.stubGlobal('__APP_VERSION__', 'test')
    useDevModeStore.setState({ enabled: false, tapProgress: 0, loaded: true })

    render(
      <AppShell activePageId="sos" onNavigate={onNavigate}>
        <main>content</main>
      </AppShell>,
    )

    expect(screen.getByRole('button', { name: 'menu' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'SOS' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '轨迹' })).not.toBeInTheDocument()
  })

  it('uses the side drawer as the only page navigation surface', () => {
    const onNavigate = vi.fn()
    useUiStore.setState({ drawerOpen: true, drawerOffset: 0 })
    vi.stubGlobal('__APP_VERSION__', 'test')
    useDevModeStore.setState({ enabled: true, tapProgress: 0, loaded: true })

    render(
      <AppShell activePageId="sos" onNavigate={onNavigate}>
        <main>content</main>
      </AppShell>,
    )

    fireEvent.click(screen.getByRole('button', { name: '轨迹' }))

    expect(onNavigate).toHaveBeenCalledWith('tracking')
    expect(useUiStore.getState().drawerOpen).toBe(false)
  })
})

describe('AppShell theme surfaces', () => {
  function renderShellWithTheme(mode: 'light' | 'dark') {
    const theme = buildTheme(mode, 'green', null, null)
    vi.stubGlobal('__APP_VERSION__', 'test')
    useUiStore.setState({ drawerOpen: false, drawerOffset: 0 })
    useDevModeStore.setState({ enabled: false, tapProgress: 0, loaded: true })

    const result = render(
      <MuiThemeProvider theme={theme}>
        <CssBaseline />
        <AppShell activePageId="overview" onNavigate={vi.fn()}>
          <div>content</div>
        </AppShell>
      </MuiThemeProvider>,
    )

    return { theme, ...result }
  }

  it.each(['light', 'dark'] as const)('uses a pure neutral gray shell surface in %s mode', (mode) => {
    const { container, theme } = renderShellWithTheme(mode)
    const root = container.firstElementChild
    expect(root).not.toBeNull()

    const expectedSurface = mode === 'dark' ? '#121212' : '#f5f5f5'
    const expectedText = theme.palette.getContrastText(expectedSurface)

    expect(hasGeneratedRule(screen.getByRole('banner'), [
      `background-color:${expectedSurface};`,
      `color:${expectedText};`,
    ])).toBe(true)
    expect(hasGeneratedRule(root!, [
      `background-color:${expectedSurface};`,
      `color:${expectedText};`,
    ])).toBe(true)
    expect(emotionStyleText()).not.toContain('linear-gradient')
    expect(expectedSurface.toLowerCase()).not.toBe(theme.palette.primary.main.toLowerCase())
    expect(expectedSurface.toLowerCase()).not.toBe(theme.palette.primary.light.toLowerCase())
  })
})
