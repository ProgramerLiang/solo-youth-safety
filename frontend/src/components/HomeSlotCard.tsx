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

export function HomeSlotCard({ slotKey, onNavigate }: HomeSlotCardProps) {
  const label = HOME_SLOT_CANDIDATES.find((c) => c.key === slotKey)?.label ?? slotKey
  const target = SLOT_TARGET[slotKey]

  // 所有 hooks 在顶层调用,不能有条件
  const safetyTripCurrent = useSafetyTripStore((s) => s.current)
  const contactsList = useContactsStore((s) => s.list)
  const lastCapturedAt = useTrackingStore((s) => s.lastCapturedAt)
  const sosHistory = useSosStore((s) => s.history)
  const geofenceZones = useGeofenceStore((s) => s.zones)
  const freshness = useLocationFreshness(lastCapturedAt ? new Date(lastCapturedAt).getTime() : null)

  const body = renderBody(slotKey, {
    safetyTripCurrent,
    contactsList,
    lastCapturedAt,
    freshness,
    sosHistory,
    geofenceZones,
  })

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

interface SlotData {
  safetyTripCurrent: ReturnType<typeof useSafetyTripStore.getState>['current']
  contactsList: ReturnType<typeof useContactsStore.getState>['list']
  lastCapturedAt: ReturnType<typeof useTrackingStore.getState>['lastCapturedAt']
  freshness: ReturnType<typeof useLocationFreshness>
  sosHistory: ReturnType<typeof useSosStore.getState>['history']
  geofenceZones: ReturnType<typeof useGeofenceStore.getState>['zones']
}

function renderBody(slotKey: HomeSlotKey, data: SlotData): React.ReactElement {
  switch (slotKey) {
    case 'safetyTrip': {
      const trip = data.safetyTripCurrent
      if (!trip) return <Typography variant="body2" color="text.secondary">无进行中行程</Typography>
      const status = deriveSafetyTripStatus(trip, Date.now())
      return (
        <Box>
          <Typography variant="body2">{trip.destination}</Typography>
          <Chip size="small" color={status === 'overdue' ? 'error' : 'success'} label={status === 'overdue' ? '超时' : '进行中'} sx={{ mt: 0.5 }} />
        </Box>
      )
    }
    case 'contacts': {
      if (data.contactsList.length === 0) return <Typography variant="body2" color="text.secondary">暂无联系人,点击添加</Typography>
      return <Typography variant="body2">{data.contactsList.length} 人 · {data.contactsList[0]?.name}</Typography>
    }
    case 'trackingFreshness': {
      return <Typography variant="body2">{data.freshness.level === 'fresh' ? '新鲜' : data.freshness.level === 'stale' ? '过期' : '未知'}</Typography>
    }
    case 'smartRisk': {
      return <Typography variant="body2" color="text.secondary">查看当前风险项</Typography>
    }
    case 'recentSos': {
      if (!data.sosHistory || data.sosHistory.length === 0) return <Typography variant="body2" color="text.secondary">暂无 SOS 记录</Typography>
      return <Typography variant="body2">{data.sosHistory.length} 条记录</Typography>
    }
    case 'geofence': {
      return <Typography variant="body2">{data.geofenceZones.length} 个围栏</Typography>
    }
    case 'membership': {
      return <Typography variant="body2" color="text.secondary">查看会员权益</Typography>
    }
  }
}