import { Stack, Typography, Box, IconButton, Divider, List, ListItemButton, ListItemText } from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import { useUiStore } from '../stores/useUiStore'
import type { PageId } from '../types'

interface ScenesPanelProps {
  onNavigate: (pageId: PageId) => void
  onClose: () => void
}

const SCENE_ENTRIES: { label: string; target: PageId; anchor?: string }[] = [
  { label: '智能规则', target: 'smartRules' },
  { label: '地理围栏', target: 'config', anchor: 'geofence' },
  { label: '安全行程', target: 'smartRules' },
  { label: '行程预设', target: 'config', anchor: 'presets' },
]

export function ScenesPanel({ onNavigate, onClose }: ScenesPanelProps) {
  const setScrollAnchor = useUiStore((s) => s.setScrollAnchor)

  const handle = (entry: { target: PageId; anchor?: string }) => {
    if (entry.anchor) setScrollAnchor(entry.anchor)
    onNavigate(entry.target)
    onClose()
  }

  return (
    <Stack sx={{ p: 2, minWidth: 260, maxWidth: 320 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
        <Typography variant="subtitle1">场景</Typography>
        <IconButton size="small" onClick={onClose} aria-label="关闭场景面板"><CloseIcon fontSize="small" /></IconButton>
      </Box>
      <Divider />
      <List dense>
        {SCENE_ENTRIES.map((entry) => (
          <ListItemButton key={entry.label} onClick={() => handle(entry)} aria-label={entry.label}>
            <ListItemText primary={entry.label} />
          </ListItemButton>
        ))}
      </List>
    </Stack>
  )
}