import { Stack, Typography, Box, IconButton, Divider, Paper, FormControl, InputLabel, Select, MenuItem } from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import ShieldIcon from '@mui/icons-material/Shield'
import PeopleIcon from '@mui/icons-material/People'
import PaletteIcon from '@mui/icons-material/Palette'
import LockIcon from '@mui/icons-material/Lock'
import BuildIcon from '@mui/icons-material/Build'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import { useDevModeStore } from '../stores/useDevModeStore'
import { useHomeStore } from '../stores/useHomeStore'
import { useUiStore } from '../stores/useUiStore'
import { HOME_SLOT_CANDIDATES } from '../types/home'
import type { HomeSlotKey } from '../types/home'
import type { PageId } from '../types'

interface ProfilePanelProps {
  onNavigate: (pageId: PageId) => void
  onClose: () => void
}

interface ProfileEntry {
  label: string
  icon: React.ReactNode
  target: PageId
  anchor?: string
  devOnly?: boolean
}

export function ProfilePanel({ onNavigate, onClose }: ProfilePanelProps) {
  const devEnabled = useDevModeStore((s) => s.enabled)
  const slots = useHomeStore((s) => s.slots)
  const setSlot = useHomeStore((s) => s.setSlot)
  const setScrollAnchor = useUiStore((s) => s.setScrollAnchor)

  const entries: ProfileEntry[] = [
    { label: '紧急配置', icon: <ShieldIcon color="error" />, target: 'config' },
    { label: '联系人', icon: <PeopleIcon color="primary" />, target: 'contacts' },
    { label: '主题', icon: <PaletteIcon color="secondary" />, target: 'theme' },
    { label: '隐私锁屏', icon: <LockIcon sx={{ color: 'warning.main' }} />, target: 'config', anchor: 'privacy' },
    { label: '数据工具', icon: <BuildIcon color="action" />, target: 'tools', devOnly: true },
  ]

  const handle = (entry: { target: PageId; anchor?: string }) => {
    if (entry.anchor) setScrollAnchor(entry.anchor)
    onNavigate(entry.target)
    onClose()
  }

  return (
    <Stack sx={{ p: 2, minWidth: 280, maxWidth: 380 }} spacing={1.5}>
      {/* header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="subtitle1">我的</Typography>
        <IconButton size="small" onClick={onClose} aria-label="关闭我的面板"><CloseIcon fontSize="small" /></IconButton>
      </Box>
      <Divider />

      {/* nav entries as paper cards */}
      <Stack spacing={0.5}>
        {entries.filter((e) => !e.devOnly || devEnabled).map((entry) => (
          <Paper
            key={entry.label}
            elevation={0}
            role="button"
            tabIndex={0}
            sx={(theme) => ({
              display: 'flex',
              alignItems: 'center',
              gap: 1.5,
              px: 2,
              py: 1.5,
              borderRadius: 2,
              cursor: 'pointer',
              bgcolor: theme.palette.mode === 'dark' ? 'grey.900' : 'grey.50',
              transition: 'all 0.15s',
              '&:hover': { bgcolor: 'action.hover', transform: 'translateX(4px)' },
              '&:active': { bgcolor: 'action.selected' },
              outline: 'none',
            })}
            onClick={() => handle(entry)}
            onKeyDown={(e: React.KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') handle(entry) }}
            aria-label={entry.label}
          >
            {entry.icon}
            <Typography variant="body2" sx={{ flex: 1, fontWeight: 500 }}>
              {entry.label}
            </Typography>
            <ChevronRightIcon fontSize="small" color="disabled" />
          </Paper>
        ))}
      </Stack>
      <Divider />

      {/* slot customizer */}
      <Typography variant="overline" sx={{ fontSize: '0.7rem', letterSpacing: 0.5, color: 'text.secondary' }}>首页栏目</Typography>
      <Stack spacing={1}>
        {slots.map((current, idx) => (
          <FormControl key={idx} size="small" fullWidth>
            <InputLabel>{`栏目 ${idx + 1}`}</InputLabel>
            <Select
              value={current}
              label={`栏目 ${idx + 1}`}
              onChange={(e) => setSlot(idx, e.target.value as HomeSlotKey)}
              sx={(theme) => ({ borderRadius: 2, bgcolor: theme.palette.mode === 'dark' ? 'grey.900' : 'grey.50' })}
            >
              {HOME_SLOT_CANDIDATES.map((c) => (
                <MenuItem key={c.key} value={c.key}>{c.label}</MenuItem>
              ))}
            </Select>
          </FormControl>
        ))}
      </Stack>
    </Stack>
  )
}