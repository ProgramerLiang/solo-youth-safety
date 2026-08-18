import { useState } from 'react'
import { Stack, Typography, Box, IconButton, Divider, List, ListItemButton, ListItemText, Tab, Tabs } from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import { useUiStore } from '../stores/useUiStore'
import { useSosStore } from '../stores/useSosStore'
import { useTrackingStore } from '../stores/useTrackingStore'
import { useGeofenceStore } from '../stores/useGeofenceStore'
import { useRuleEngineStore } from '../stores/useRuleEngineStore'
import { routeGeofenceEvents } from '../domain/geofence'
import type { PageId } from '../types'

interface ScenesPanelProps {
  onNavigate: (pageId: PageId) => void
  onClose: () => void
}

interface MessageItem {
  id: string
  title: string
  detail: string
  target: PageId
}

const SCENE_ENTRIES: { label: string; target: PageId; anchor?: string }[] = [
  { label: '智能规则', target: 'smartRules' },
  { label: '地理围栏', target: 'config', anchor: 'geofence' },
  { label: '安全行程', target: 'smartRules' },
  { label: '行程预设', target: 'config', anchor: 'presets' },
]

function MessagesContent({ onNavigate, onClose }: { onNavigate: (pageId: PageId) => void; onClose: () => void }) {
  const sosHistory = useSosStore((s) => s.history)
  const trackHistory = useTrackingStore((s) => s.history)
  const zones = useGeofenceStore((s) => s.zones)
  const rules = useRuleEngineStore((s) => s.rules)

  const items: MessageItem[] = []

  for (const record of [...sosHistory].reverse().slice(0, 5)) {
    const at = record.triggeredAt ? new Date(record.triggeredAt).toLocaleString('zh-CN') : '未知时间'
    items.push({ id: `sos-${record.triggeredAt ?? Math.random()}`, title: `SOS ${record.finalLabel}`, detail: at, target: 'history' })
  }

  const geofenceEvents = routeGeofenceEvents(zones, trackHistory)
  for (const ev of [...geofenceEvents].reverse().slice(0, 5)) {
    const label = ev.event === 'exit' ? `离开${ev.zoneLabel}` : `进入${ev.zoneLabel}`
    items.push({ id: `geo-${ev.at}-${ev.zoneId}`, title: label, detail: new Date(ev.at).toLocaleString('zh-CN'), target: 'playback' })
  }

  const firedRules = rules.filter((r) => r.lastFiredAt).sort((a, b) => (b.lastFiredAt! - a.lastFiredAt!)).slice(0, 5)
  for (const rule of firedRules) {
    items.push({ id: `rule-${rule.id}-${rule.lastFiredAt}`, title: `规则「${rule.name}」已触发`, detail: new Date(rule.lastFiredAt!).toLocaleString('zh-CN'), target: 'smartRules' })
  }

  if (items.length === 0) {
    return <Typography variant="body2" color="text.secondary" sx={{ py: 3, textAlign: 'center' }}>暂无消息</Typography>
  }

  return (
    <List dense disablePadding>
      {items.map((item) => (
        <ListItemButton key={item.id} onClick={() => { onNavigate(item.target); onClose() }}>
          <ListItemText primary={item.title} secondary={item.detail} />
        </ListItemButton>
      ))}
    </List>
  )
}

function ScenesContent({ onNavigate, onClose }: { onNavigate: (pageId: PageId) => void; onClose: () => void }) {
  const setScrollAnchor = useUiStore((s) => s.setScrollAnchor)

  const handle = (entry: { target: PageId; anchor?: string }) => {
    if (entry.anchor) setScrollAnchor(entry.anchor)
    onNavigate(entry.target)
    onClose()
  }

  return (
    <List dense disablePadding>
      {SCENE_ENTRIES.map((entry) => (
        <ListItemButton key={entry.label} onClick={() => handle(entry)} aria-label={entry.label}>
          <ListItemText primary={entry.label} />
        </ListItemButton>
      ))}
    </List>
  )
}

export function ScenesPanel({ onNavigate, onClose }: ScenesPanelProps) {
  const [tab, setTab] = useState(0)

  return (
    <Stack sx={{ p: 2, minWidth: 260, maxWidth: 380 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
        <Typography variant="subtitle1">场景</Typography>
        <IconButton size="small" onClick={onClose} aria-label="关闭场景面板"><CloseIcon fontSize="small" /></IconButton>
      </Box>
      <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="fullWidth" sx={{ minHeight: 36, '& .MuiTab-root': { minHeight: 36, py: 0.5 } }}>
        <Tab label="事件" />
        <Tab label="功能" />
      </Tabs>
      <Divider sx={{ mb: 1 }} />
      {tab === 0 ? <MessagesContent onNavigate={onNavigate} onClose={onClose} /> : <ScenesContent onNavigate={onNavigate} onClose={onClose} />}
    </Stack>
  )
}