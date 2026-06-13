import { Chip, Drawer, List, ListItemButton, ListItemText, Box, Typography, Divider } from '@mui/material'
import { useUiStore } from '../stores/useUiStore'
import { useDevModeStore } from '../stores/useDevModeStore'
import { ALL_PAGE_IDS, type PageId } from '../types'
import { zhCN } from '../i18n/zh-CN'
interface NavigationDrawerProps {
  activePageId: PageId
  onNavigate: (pageId: PageId) => void
}

const pageLabel: Record<PageId, string> = {
  overview: zhCN.pages.overview.label,
  sos: zhCN.pages.sos.label,
  history: zhCN.pages.history.label,
  playback: zhCN.pages.playback.label,
  tracking: zhCN.pages.tracking.label,
  config: zhCN.pages.config.label,
  contacts: zhCN.pages.contacts.label,
  theme: zhCN.pages.theme.label,
  tools: zhCN.pages.tools.label,
}

export function NavigationDrawer({ activePageId, onNavigate }: NavigationDrawerProps) {
  const drawerOpen = useUiStore((s) => s.drawerOpen)
  const closeDrawer = useUiStore((s) => s.closeDrawer)
  const devEnabled = useDevModeStore((s) => s.enabled)
  const tapVersion = useDevModeStore((s) => s.tap)
  const handleClick = (pageId: PageId) => {
    onNavigate(pageId)
    closeDrawer()
  }

  return (
    <Drawer
      anchor="left"
      open={drawerOpen}
      onClose={closeDrawer}
      slotProps={{ backdrop: { sx: { bgcolor: 'rgba(0,0,0,0.32)' } } }}
    >
      <Box sx={{ width: 280, pt: 2 }}>
        <Typography variant="h6" sx={{ px: 2, mb: 1, fontWeight: 600 }}>
          {zhCN.appName}
        </Typography>
        <Typography variant="caption" sx={{ px: 2, mb: 2, display: 'block', color: 'text.secondary' }}>
          {zhCN.tagline}
        </Typography>
        <Divider sx={{ mb: 1 }} />
        <List>
          {ALL_PAGE_IDS.map((pageId) => (
            <ListItemButton
              key={pageId}
              selected={activePageId === pageId}
              onClick={() => handleClick(pageId)}
              sx={{ mx: 1, borderRadius: 2 }}
            >
              <ListItemText
                primary={pageLabel[pageId]}
                primaryTypographyProps={{
                  fontWeight: activePageId === pageId ? 600 : 400,
                }}
              />
            </ListItemButton>
          ))}
        </List>
        <Divider sx={{ mt: 'auto', mb: 1 }} />
        <Box sx={{ px: 2, pb: 2 }}>
          <Chip
            label={`v${__APP_VERSION__}`}
            size="small"
            variant="outlined"
            onClick={() => { tapVersion() }}
            sx={{ mr: 1 }}
          />
          {devEnabled && (
            <Chip label="开发者" size="small" color="warning" />
          )}
        </Box>
      </Box>
    </Drawer>
  )
}