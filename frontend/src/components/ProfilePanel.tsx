import { Stack, Typography, Box, IconButton, Divider, List, ListItemButton, ListItemText, Switch, FormControl, InputLabel, Select, MenuItem } from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import { useDevModeStore } from '../stores/useDevModeStore'
import { useHomeStore } from '../stores/useHomeStore'
import { useUiStore } from '../stores/useUiStore'
import { useAiConfigStore } from '../ai/aiConfigStore'
import { HOME_SLOT_CANDIDATES } from '../types/home'
import type { HomeSlotKey } from '../types/home'
import type { PageId } from '../types'

interface ProfilePanelProps {
  onNavigate: (pageId: PageId) => void
  onClose: () => void
}

export function ProfilePanel({ onNavigate, onClose }: ProfilePanelProps) {
  const devEnabled = useDevModeStore((s) => s.enabled)
  const slots = useHomeStore((s) => s.slots)
  const setSlot = useHomeStore((s) => s.setSlot)
  const setScrollAnchor = useUiStore((s) => s.setScrollAnchor)
  const config = useAiConfigStore((s) => s.config)
  const toggleAi = useAiConfigStore((s) => s.toggle)

  const entries: { label: string; target: PageId; anchor?: string; devOnly?: boolean }[] = [
    { label: '紧急配置', target: 'config' },
    { label: '联系人', target: 'contacts' },
    { label: '主题', target: 'theme' },
    { label: '隐私锁屏', target: 'config', anchor: 'privacy' },
    { label: 'AI 助手设置', target: 'ai-config' },
    { label: '数据工具', target: 'tools', devOnly: true },
  ]

  const handle = (entry: { target: PageId; anchor?: string }) => {
    if (entry.anchor) setScrollAnchor(entry.anchor)
    onNavigate(entry.target)
    onClose()
  }

  return (
    <Stack sx={{ p: 2, minWidth: 280, maxWidth: 360 }} spacing={2}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="subtitle1">我的</Typography>
        <IconButton size="small" onClick={onClose} aria-label="关闭我的面板"><CloseIcon fontSize="small" /></IconButton>
      </Box>
      <Divider />
      <List dense>
        {entries.filter((e) => !e.devOnly || devEnabled).map((entry) => (
          <ListItemButton key={entry.label} onClick={() => handle(entry)} aria-label={entry.label}>
            <ListItemText primary={entry.label} />
          </ListItemButton>
        ))}
      </List>
      <Divider />
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', px: 0.5 }}>
        <Typography variant="body2">AI 助手</Typography>
        <Switch size="small" checked={config.enabled} onChange={toggleAi} />
      </Box>
      <Divider />
      <Typography variant="overline">首页栏目自定义</Typography>
      <Stack spacing={1}>
        {slots.map((current, idx) => (
          <FormControl key={idx} size="small" fullWidth>
            <InputLabel>{`首页栏目 ${idx + 1}`}</InputLabel>
            <Select
              value={current}
              label={`首页栏目 ${idx + 1}`}
              onChange={(e) => setSlot(idx, e.target.value as HomeSlotKey)}
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