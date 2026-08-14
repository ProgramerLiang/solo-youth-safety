import { Stack, Typography, Box, IconButton, Divider, List, ListItemButton, ListItemText } from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import { useSosStore } from '../stores/useSosStore'
import { useTrackingStore } from '../stores/useTrackingStore'
import { useGeofenceStore } from '../stores/useGeofenceStore'
import { useRuleEngineStore } from '../stores/useRuleEngineStore'
import { routeGeofenceEvents } from '../domain/geofence'
import type { PageId } from '../types'

interface MessagesPanelProps {
  onNavigate: (pageId: PageId) => void
  onClose: () => void
}

interface MessageItem {
  id: string
  title: string
  detail: string
  target: PageId
}

export function MessagesPanel({ onNavigate, onClose }: MessagesPanelProps) {
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

  return (
    <Stack sx={{ p: 2, minWidth: 280, maxWidth: 360 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
        <Typography variant="subtitle1">消息</Typography>
        <IconButton size="small" onClick={onClose} aria-label="关闭消息面板"><CloseIcon fontSize="small" /></IconButton>
      </Box>
      <Divider />
      {items.length === 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ py: 3, textAlign: 'center' }}>暂无消息</Typography>
      ) : (
        <List dense>
          {items.map((item) => (
            <ListItemButton key={item.id} onClick={() => { onNavigate(item.target); onClose() }}>
              <ListItemText primary={item.title} secondary={item.detail} />
            </ListItemButton>
          ))}
        </List>
      )}
    </Stack>
  )
}