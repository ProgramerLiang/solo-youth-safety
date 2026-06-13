import { useState } from 'react'
import {
  Stack, Typography, Card, CardContent, Chip, List, ListItemButton, ListItemText,
} from '@mui/material'
import { useSosStore } from '../stores/useSosStore'
import { StatusStepStack } from '../components/StatusStepStack'
import { EmptyState } from '../components/EmptyState'
import { zhCN } from '../i18n/zh-CN'
import type { SosResult } from '../types'

export function HistoryPage() {
  const history = useSosStore((s) => s.history)
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)

  const selected: SosResult | null = selectedIndex !== null ? history[selectedIndex] ?? null : null

  return (
    <Stack spacing={2}>
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Typography variant="h5">{zhCN.pages.history.label}</Typography>
        <Chip label={`${history.length} 条`} size="small" />
      </Stack>

      {history.length === 0 ? (
        <EmptyState message={zhCN.history.empty} />
      ) : (
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
          <Card variant="outlined" sx={{ borderRadius: 3, flex: { md: 1 } }}>
            <CardContent sx={{ p: 0 }}>
              <List dense>
                {history.map((item, i) => (
                  <ListItemButton
                    key={i}
                    selected={selectedIndex === i}
                    onClick={() => setSelectedIndex(i)}
                  >
                    <ListItemText
                      primary={item.stage === 'done' ? 'SOS 事件' : '未完成'}
                      secondary={`${item.finalLabel} · ${item.finalStatus}`}
                    />
                  </ListItemButton>
                ))}
              </List>
            </CardContent>
          </Card>

          {selected && (
            <Card variant="outlined" sx={{ borderRadius: 3, flex: { md: 2 } }}>
              <CardContent>
                <Typography variant="overline">{zhCN.history.notificationTitle}</Typography>
                <Stack spacing={1} mt={1}>
                  <Typography variant="body2">
                    {zhCN.history.timeLabel}：{selected.triggeredAt ? new Date(selected.triggeredAt).toLocaleString() : '-'}
                  </Typography>
                  <StatusStepStack steps={Object.values(selected.steps)} />
                  <Typography variant="body2">状态：{selected.finalLabel}</Typography>
                  <Typography variant="body2">摘要：{selected.summary}</Typography>
                  {selected.note && (
                    <Typography variant="body2" color="text.secondary">
                      备注：{selected.note}
                    </Typography>
                  )}
                </Stack>
              </CardContent>
            </Card>
          )}
        </Stack>
      )}
    </Stack>
  )
}