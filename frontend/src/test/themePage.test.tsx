import { beforeEach, describe, expect, it } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import { ThemeProvider as MuiThemeProvider } from '@mui/material/styles'
import { ThemePage } from '../pages/ThemePage'
import { useThemeStore } from '../stores/useThemeStore'
import { buildTheme } from '../theme/createTheme'

function emotionStyleText(): string {
  return Array.from(document.querySelectorAll('style[data-emotion]'))
    .map((style) => style.textContent ?? '')
    .join('\n')
}

function generatedClassNames(element: HTMLElement): string[] {
  return Array.from(element.classList).filter((className) => className.startsWith('css-'))
}

function hasHoverContrastRule(element: HTMLElement, backgroundColor: string, textColor: string): boolean {
  const styleText = emotionStyleText()
  const rules = styleText.split('}')
  return generatedClassNames(element).some((className) => rules.some((rule) => (
    rule.includes(`.${className}`)
    && rule.includes(':hover{')
    && rule.includes(`background-color:${backgroundColor};`)
    && rule.includes(`color:${textColor}`)
  )))
}
beforeEach(() => {
  useThemeStore.setState({
    mode: 'auto',
    paletteMode: 'dynamic',
    presetId: 'purple',
    customSeed: null,
    dynamicInfo: null,
    initialized: false,
  })
})

function renderThemePage(paletteMode: 'light' | 'dark') {
  act(() => {
    useThemeStore.setState({
      mode: paletteMode,
      paletteMode: 'preset',
      presetId: 'purple',
      customSeed: null,
      dynamicInfo: null,
      initialized: true,
    })
  })
  const theme = buildTheme(paletteMode, 'purple', null, null)

  render(
    <MuiThemeProvider theme={theme}>
      <ThemePage />
    </MuiThemeProvider>,
  )

  return theme
}

describe('ThemePage contrast', () => {
  it('keeps selected theme chips readable on hover in light mode', () => {
    const theme = renderThemePage('light')

    for (const chipName of ['浅色', '预设配色']) {
      const chip = screen.getByRole('button', { name: chipName })
      expect(hasHoverContrastRule(
        chip,
        theme.palette.primary.dark,
        theme.palette.getContrastText(theme.palette.primary.dark),
      )).toBe(true)
    }
  })

  it('keeps selected theme chips readable on hover in dark mode', () => {
    const theme = renderThemePage('dark')

    for (const chipName of ['深色', '预设配色']) {
      const chip = screen.getByRole('button', { name: chipName })
      expect(hasHoverContrastRule(
        chip,
        theme.palette.primary.dark,
        theme.palette.getContrastText(theme.palette.primary.dark),
      )).toBe(true)
    }
  })
})
