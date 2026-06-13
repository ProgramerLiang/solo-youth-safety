import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Button, ThemeProvider as MuiThemeProvider } from '@mui/material'
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
  return generatedClassNames(element).some((className) => {
    const selector = `.${className}:hover{`
    return styleText.includes(selector)
      && styleText.includes(`${selector}background-color:${backgroundColor};`)
      && styleText.includes(`color:${textColor}`)
  })
}

describe('button theme contrast', () => {
  it('keeps primary contained button hover contrast explicit in light and dark modes', () => {
    for (const mode of ['light', 'dark'] as const) {
      const theme = buildTheme(mode, 'purple', null, null)
      render(
        <MuiThemeProvider theme={theme}>
          <Button variant="contained">primary {mode}</Button>
        </MuiThemeProvider>,
      )

      const button = screen.getByRole('button', { name: `primary ${mode}` })
      expect(hasHoverContrastRule(
        button,
        theme.palette.primary.dark,
        theme.palette.getContrastText(theme.palette.primary.dark),
      )).toBe(true)
    }
  })

  it('keeps error contained button hover contrast explicit in light and dark modes', () => {
    for (const mode of ['light', 'dark'] as const) {
      const theme = buildTheme(mode, 'purple', null, null)
      render(
        <MuiThemeProvider theme={theme}>
          <Button variant="contained" color="error">danger {mode}</Button>
        </MuiThemeProvider>,
      )

      const button = screen.getByRole('button', { name: `danger ${mode}` })
      expect(hasHoverContrastRule(
        button,
        theme.palette.error.dark,
        theme.palette.getContrastText(theme.palette.error.dark),
      )).toBe(true)
    }
  })
})
