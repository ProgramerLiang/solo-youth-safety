import { Box, AppBar, Toolbar, Typography, IconButton, Container } from '@mui/material'
import type { Theme } from '@mui/material/styles'
import MenuIcon from '@mui/icons-material/Menu'
import { useUiStore } from '../stores/useUiStore'
import { NavigationDrawer } from './NavigationDrawer'
import { zhCN } from '../i18n/zh-CN'
import type { PageId } from '../types'

interface AppShellProps {
  activePageId: PageId
  onNavigate: (pageId: PageId) => void
  children: React.ReactNode
}

function getShellChrome(theme: Theme): { backgroundColor: string; color: string } {
  const backgroundColor = theme.palette.mode === 'dark' ? '#121212' : '#f5f5f5'
  return { backgroundColor, color: theme.palette.getContrastText(backgroundColor) }
}

export function AppShell({ activePageId, onNavigate, children }: AppShellProps) {
  const openDrawer = useUiStore((s) => s.openDrawer)

  return (
    <Box sx={(theme) => {
      const shell = getShellChrome(theme)
      return {
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100dvh',
        color: shell.color,
        backgroundColor: shell.backgroundColor,
      }
    }}>
      <AppBar position="sticky" elevation={0} sx={(theme) => getShellChrome(theme)}>
        <Toolbar>
          <IconButton edge="start" aria-label="menu" onClick={openDrawer} color="inherit" sx={{ mr: 1 }}>
            <MenuIcon />
          </IconButton>
          <Typography variant="h6" noWrap sx={{ fontWeight: 600 }}>
            {zhCN.appName}
          </Typography>
        </Toolbar>
      </AppBar>

      <NavigationDrawer activePageId={activePageId} onNavigate={onNavigate} />

      <Container maxWidth="md" sx={{ py: 2, flex: 1 }}>
        {children}
      </Container>
    </Box>
  )
}