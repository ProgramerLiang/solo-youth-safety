import { Stack, Typography, Box, IconButton, Divider, Paper } from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'
import MapIcon from '@mui/icons-material/Map'
import RouteIcon from '@mui/icons-material/Route'
import BookmarkIcon from '@mui/icons-material/Bookmark'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import { useUiStore } from '../stores/useUiStore'
import type { PageId } from '../types'

interface ScenesPanelProps {
  onNavigate: (pageId: PageId) => void
  onClose: () => void
}

interface SceneEntry {
  label: string
  desc: string
  icon: React.ReactNode
  target: PageId
  anchor?: string
}

const SCENE_ENTRIES: SceneEntry[] = [
  { label: '智能规则', desc: '条件触发 · 自动动作', icon: <AutoAwesomeIcon color="warning" />, target: 'smartRules' },
  { label: '地理围栏', desc: '进出提醒 · 区域管理', icon: <MapIcon color="primary" />, target: 'config', anchor: 'geofence' },
  { label: '安全行程', desc: '历史记录 · 状态追踪', icon: <RouteIcon color="success" />, target: 'trip' },
  { label: '行程预设', desc: '快速创建 · 模板管理', icon: <BookmarkIcon color="secondary" />, target: 'config', anchor: 'presets' },
]

export function ScenesPanel({ onNavigate, onClose }: ScenesPanelProps) {
  const setScrollAnchor = useUiStore((s) => s.setScrollAnchor)

  const handle = (entry: { target: PageId; anchor?: string }) => {
    if (entry.anchor) setScrollAnchor(entry.anchor)
    onNavigate(entry.target)
    onClose()
  }

  return (
    <Stack sx={{ p: 2, minWidth: 260, maxWidth: 320 }} spacing={1.5}>
      {/* header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="subtitle1">场景</Typography>
        <IconButton size="small" onClick={onClose} aria-label="关闭场景面板"><CloseIcon fontSize="small" /></IconButton>
      </Box>
      <Divider />

      {/* scene entries as paper cards */}
      <Stack spacing={0.5}>
        {SCENE_ENTRIES.map((entry) => (
          <Paper
            key={entry.label}
            elevation={0}
            role="button"
            tabIndex={0}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1.5,
              px: 2,
              py: 1.5,
              borderRadius: 2,
              cursor: 'pointer',
              bgcolor: 'grey.50',
              transition: 'all 0.15s',
              '&:hover': { bgcolor: 'action.hover', transform: 'translateX(4px)' },
              '&:active': { bgcolor: 'action.selected' },
              outline: 'none',
            }}
            onClick={() => handle(entry)}
            onKeyDown={(e: React.KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') handle(entry) }}
            aria-label={entry.label}
          >
            {entry.icon}
            <Box sx={{ flex: 1 }}>
              <Typography variant="body2" sx={{ fontWeight: 500 }}>
                {entry.label}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {entry.desc}
              </Typography>
            </Box>
            <ChevronRightIcon fontSize="small" color="disabled" />
          </Paper>
        ))}
      </Stack>
    </Stack>
  )
}