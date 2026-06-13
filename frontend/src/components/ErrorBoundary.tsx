import { Component } from 'react'
import type { ReactNode, ErrorInfo } from 'react'
import { Box, Typography, Button } from '@mui/material'

interface Props { children?: ReactNode }
interface State { hasError: boolean }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info)
  }

  render() {
    if (this.state.hasError) {
      return (
        <Box sx={{ p: 4, textAlign: 'center' }}>
          <Typography variant="h5" gutterBottom>
            出现了一些问题
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
            应用遇到了意外错误，请尝试刷新页面。
          </Typography>
          <Button variant="contained" onClick={() => window.location.reload()}>
            刷新页面
          </Button>
        </Box>
      )
    }
    return this.props.children
  }
}