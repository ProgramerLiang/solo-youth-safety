import { useEffect, useState } from 'react'
import { Box, Card, Chip, Collapse, Grid, List, ListItem, ListItemText, Stack, Typography } from '@mui/material'
import { EmptyState } from '../components/EmptyState'
import { loadSafetyTripHistory } from '../data/safetyTripRepo'
import type { SafetyTrip, SafetyTripEventType, SafetyTripStatus } from '../domain/safetyTrip'
import { computeTripStats } from '../domain/tripStats'

const statusLabel: Record<SafetyTripStatus, string> = {
  active: '进行中',
  overdue: '已超时',
  arrived: '已完成',
  cancelled: '已取消',
}

const statusColor: Record<SafetyTripStatus, 'success' | 'error' | 'default'> = {
  active: 'success',
  overdue: 'error',
  arrived: 'success',
  cancelled: 'default',
}

const eventLabel: Record<SafetyTripEventType, string> = {
  created: '创建',
  extended: '延长',
  arrived: '到达',
  cancelled: '取消',
  overdue_seen: '超时记录',
}

const eventIcon: Record<SafetyTripEventType, string> = {
  created: '▶',
  extended: '⏱',
  arrived: '✓',
  cancelled: '✕',
  overdue_seen: '⚠',
}

function formatTime(iso: string): string {
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export function TripHistoryPage() {
  const [trips, setTrips] = useState<SafetyTrip[]>([])
  const [loaded, setLoaded] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  useEffect(() => {
    loadSafetyTripHistory().then((data) => {
      setTrips(data.slice().reverse())
      setLoaded(true)
    })
  }, [])

  if (!loaded) return null

  if (trips.length === 0) {
    return <EmptyState message="暂无安全行程记录" />
  }

  return (
    <Box sx={{ px: { xs: 2, sm: 3 }, py: 2 }}>
      <Typography variant="h5" fontWeight="bold" sx={{ mb: 2 }}>
        安全行程历史
      </Typography>
      {trips.length > 0 && (() => {
        const stats = computeTripStats(trips)
        return (
          <Card sx={{ p: 2, mb: 2 }}>
            <Grid container spacing={2}>
              <Grid item xs={6} sm={3}>
                <Stack alignItems="center">
                  <Typography variant="h6" fontWeight="bold">📊</Typography>
                  <Typography variant="h5" fontWeight="bold">{stats.total}</Typography>
                  <Typography variant="caption" color="text.secondary">总行程</Typography>
                </Stack>
              </Grid>
              <Grid item xs={6} sm={3}>
                <Stack alignItems="center">
                  <Typography variant="h6" fontWeight="bold">⏱️</Typography>
                  <Typography variant="h5" fontWeight="bold">{stats.avgDurationMinutes}</Typography>
                  <Typography variant="caption" color="text.secondary">平均时长（分）</Typography>
                </Stack>
              </Grid>
              <Grid item xs={6} sm={3}>
                <Stack alignItems="center">
                  <Typography variant="h6" fontWeight="bold">✓</Typography>
                  <Typography variant="h5" fontWeight="bold">{Math.round(stats.onTimeRate * 100)}%</Typography>
                  <Typography variant="caption" color="text.secondary">准时率</Typography>
                </Stack>
              </Grid>
              <Grid item xs={6} sm={3}>
                <Stack alignItems="center">
                  <Typography variant="h6" fontWeight="bold">📍</Typography>
                  <Typography variant="body2" fontWeight="bold" sx={{ textAlign: 'center' }}>
                    {stats.topDestinations.slice(0, 3).map(d => d.destination).join(', ') || '无'}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">热门目的地</Typography>
                </Stack>
              </Grid>
            </Grid>
          </Card>
        )
      })()}
      <List>
        {trips.map((trip) => (
          <ListItem
            key={trip.id}
            divider
            sx={{ flexDirection: 'column', alignItems: 'flex-start', cursor: 'pointer' }}
            onClick={() => setExpandedId(expandedId === trip.id ? null : trip.id)}
          >
            <Stack direction="row" alignItems="center" spacing={1} sx={{ width: '100%' }}>
              <ListItemText
                primary={trip.destination}
                secondary={`${formatTime(trip.createdAt)} → 预计 ${formatTime(trip.expectedArrivalAt)}`}
              />
              <Chip label={statusLabel[trip.status]} size="small" color={statusColor[trip.status]} />
            </Stack>
            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
              {trip.events.length} 条事件
            </Typography>
            <Collapse in={expandedId === trip.id} sx={{ width: '100%', mt: 1 }}>
              <Stack spacing={0.5} sx={{ pl: 1 }}>
                {trip.events.map((evt) => (
                  <Stack key={evt.id} direction="row" spacing={1} alignItems="center">
                    <Typography variant="caption" sx={{ minWidth: 16 }}>{eventIcon[evt.type]}</Typography>
                    <Typography variant="caption" fontWeight="bold">{eventLabel[evt.type]}</Typography>
                    <Typography variant="caption" color="text.secondary">{formatTime(evt.timestamp)}</Typography>
                    {evt.detail && (
                      <Typography variant="caption" color="text.disabled">{evt.detail}</Typography>
                    )}
                  </Stack>
                ))}
              </Stack>
            </Collapse>
          </ListItem>
        ))}
      </List>
    </Box>
  )
}