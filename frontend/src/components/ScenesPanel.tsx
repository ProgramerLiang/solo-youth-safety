import { Typography, Box, IconButton, Divider, Paper } from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'
import MapIcon from '@mui/icons-material/Map'
import RouteIcon from '@mui/icons-material/Route'
import BookmarkIcon from '@mui/icons-material/Bookmark'
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
    <Box sx={{ p: 2, width: '100%', boxSizing: 'border-box' }}>
      {/* header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
        <Typography variant="subtitle1">场景</Typography>
        <IconButton size="small" onClick={onClose} aria-label="关闭场景面板"><CloseIcon fontSize="small" /></IconButton>
      </Box>
      <Divider sx={{ mb: 2 }} />

      {/* 2x2 grid layout */}
      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
        {SCENE_ENTRIES.map((entry) => (
          <Paper
            key={entry.label}
            elevation={0}
            role="button"
            tabIndex={0}
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 1,
              p: 2,
              borderRadius: 3,
              cursor: 'pointer',
              bgcolor: 'grey.50',
              minHeight: 120,
              transition: 'all 0.15s',
              '&:hover': { bgcolor: 'action.hover', transform: 'translateY(-2px)', boxShadow: 1 },
              '&:active': { bgcolor: 'action.selected' },
              outline: 'none',
            }}
            onClick={() => handle(entry)}
            onKeyDown={(e: React.KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') handle(entry) }}
            aria-label={entry.label}
          >
            <Box sx={{ '& .MuiSvgIcon-root': { fontSize: 36 } }}>
              {entry.icon}
            </Box>
            <Typography variant="body2" sx={{ fontWeight: 600, textAlign: 'center' }}>
              {entry.label}
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'center', lineHeight: 1.3 }}>
              {entry.desc}
            </Typography>
          </Paper>
        ))}
      </Box>
    </Box>
  )
}