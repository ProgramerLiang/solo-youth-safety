import { useEffect, useState } from 'react'
import { Box, Chip, List, ListItem, ListItemText, Stack, Typography } from '@mui/material'
import { EmptyState } from '../components/EmptyState'
import { loadSafetyTripHistory } from '../data/safetyTripRepo'
import type { SafetyTrip, SafetyTripStatus } from '../domain/safetyTrip'

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

function formatTime(iso: string): string {
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export function TripHistoryPage() {
  const [trips, setTrips] = useState<SafetyTrip[]>([])
  const [loaded, setLoaded] = useState(false)

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
      <List>
        {trips.map((trip) => (
          <ListItem key={trip.id} divider sx={{ flexDirection: 'column', alignItems: 'flex-start' }}>
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
          </ListItem>
        ))}
      </List>
    </Box>
  )
}