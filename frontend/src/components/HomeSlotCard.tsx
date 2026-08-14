import { Card, CardActionArea, CardContent, Typography, Box, Chip } from '@mui/material'
import { useContactsStore } from '../stores/useContactsStore'
import { useSafetyTripStore } from '../stores/useSafetyTripStore'
import { useTrackingStore } from '../stores/useTrackingStore'
import { useSosStore } from '../stores/useSosStore'
import { useGeofenceStore } from '../stores/useGeofenceStore'
import { useLocationFreshness } from '../hooks/useLocationFreshness'
import { deriveSafetyTripStatus } from '../domain/safetyTrip'
import { HOME_SLOT_CANDIDATES, type HomeSlotKey } from '../types/home'
import type { PageId } from '../types'

interface HomeSlotCardProps {
  slotKey: HomeSlotKey
  onNavigate: (pageId: PageId) => void
}

const SLOT_TARGET: Record<HomeSlotKey, PageId> = {
  safetyTrip: 'smartRules',
  contacts: 'contacts',
  trackingFreshness: 'tracking',
  smartRisk: 'smartRules',
  recentSos: 'history',
  geofence: 'config',
  membership: 'membership',
}

function useSlotBody(slotKey: HomeSlotKey, onNavigate: (pageId: PageId) => void): { label: string; body: JSX.Element } {
  const label = HOME_SLOT_CANDIDATES.find((c) => c.key === slotKey)?.label ?? slotKey

  switch (slotKey) {
    case 'safetyTrip': {
      const trip = useSafetyTripStore((s) => s.current)
      if (!trip) return { label, body: <Typography variant="body2" color="text.secondary">无进行中行程</Typography> }
      const status = deriveSafetyTripStatus(trip, Date.now())
      return {
        label,
        body: (
          <Box>
            <Typography variant="body2">{trip.destination}</Typography>
            <Chip size="small" color={status === 'overdue' ? 'error' : 'success'} label={status === 'overdue' ? '超时' : '进行中'} sx={{ mt: 0.5 }} />
          </Box>
        ),
      }
    }
    case 'contacts': {
      const list = useContactsStore((s) => s.list)
      if (list.length === 0) return { label, body: <Typography variant="body2" color="text.secondary">暂无联系人,点击添加</Typography> }
      return { label, body: <Typography variant="body2">{list.length} 人 · {list[0]?.name}</Typography> }
    }
    case 'trackingFreshness': {
      const lastCapturedAt = useTrackingStore((s) => s.lastCapturedAt)
      const freshness = useLocationFreshness(lastCapturedAt ? new Date(lastCapturedAt).getTime() : null)
      return { label, body: <Typography variant="body2">{freshness.level === 'fresh' ? '新鲜' : freshness.level === 'stale' ? '过期' : '未知'}</Typography> }
    }
    case 'smartRisk': {
      return { label, body: <Typography variant="body2" color="text.secondary">查看当前风险项</Typography> }
    }
    case 'recentSos': {
      const sosHistory = useSosStore((s) => s.history)
      if (!sosHistory || sosHistory.length === 0) return { label, body: <Typography variant="body2" color="text.secondary">暂无 SOS 记录</Typography> }
      return { label, body: <Typography variant="body2">{sosHistory.length} 条记录</Typography> }
    }
    case 'geofence': {
      const zones = useGeofenceStore((s) => s.zones)
      return { label, body: <Typography variant="body2">{zones.length} 个围栏</Typography> }
    }
    case 'membership': {
      return { label, body: <Typography variant="body2" color="text.secondary">查看会员权益</Typography> }
    }
  }
}

export function HomeSlotCard({ slotKey, onNavigate }: HomeSlotCardProps) {
  const { label, body } = useSlotBody(slotKey, onNavigate)
  const target = SLOT_TARGET[slotKey]

  return (
    <Card variant="outlined" sx={{ borderRadius: 3, height: '100%' }}>
      <CardActionArea
        onClick={() => onNavigate(target)}
        aria-label={label}
        sx={{ height: '100%' }}
      >
        <CardContent>
          <Typography variant="subtitle2" gutterBottom>{label}</Typography>
          {body}
        </CardContent>
      </CardActionArea>
    </Card>
  )
}