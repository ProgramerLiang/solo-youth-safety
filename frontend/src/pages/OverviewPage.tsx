import { useMemo } from 'react'
import { Stack, Typography, Card, CardContent, Chip, Box } from '@mui/material'
import SecurityIcon from '@mui/icons-material/Security'
import PeopleIcon from '@mui/icons-material/People'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import TimelineIcon from '@mui/icons-material/Timeline'
import { useConfigStore } from '../stores/useConfigStore'
import { useSosStore } from '../stores/useSosStore'
import { useContactsStore } from '../stores/useContactsStore'
import { useTrackingStore } from '../stores/useTrackingStore'
import { useGeofenceStore } from '../stores/useGeofenceStore'
import { useLocationFreshness } from '../hooks/useLocationFreshness'
import { aggregateRiskData } from '../domain/riskAssessment'
import type { RiskLevel } from '../domain/riskAssessment'
import { routeGeofenceEvents } from '../domain/geofence'
import { zhCN } from '../i18n/zh-CN'

function riskColor(level: RiskLevel): 'success' | 'warning' | 'error' {
  if (level === 'ok') return 'success'
  if (level === 'attention') return 'warning'
  return 'error'
}

function riskLabel(level: RiskLevel): string {
  const labels: Record<RiskLevel, string> = {
    ok: zhCN.overview.risk.ok,
    attention: zhCN.overview.risk.attention,
    warning: zhCN.overview.risk.warning,
  }
  return labels[level]
}

const RISK_LEVEL_SEVERITY: Record<RiskLevel, number> = { ok: 0, attention: 1, warning: 2 }

export function OverviewPage() {
  const callNumber = useConfigStore((s) => s.callNumber)
  const smsNumber = useConfigStore((s) => s.smsNumber)
  const sosHistory = useSosStore((s) => s.history)
  const contacts = useContactsStore((s) => s.list)
  const trackHistory = useTrackingStore((s) => s.history)
  const geofenceZones = useGeofenceStore((s) => s.zones)
  const freshness = useLocationFreshness(Date.now() - 30_000)
  const timestampMs = freshness.timestamp
  const geofenceEvents = useMemo(() => routeGeofenceEvents(geofenceZones, trackHistory), [geofenceZones, trackHistory])

  const risk = useMemo(() => {
    const ageMs = timestampMs ? Date.now() - timestampMs : 999_999_999
    return aggregateRiskData({
      points: trackHistory,
      sosHistory,
      config: { callNumber, smsNumber },
      contacts,
      locationAgeMs: ageMs,
      geofenceEvents,
    })
  }, [trackHistory, sosHistory, callNumber, smsNumber, contacts, timestampMs, geofenceEvents])
  const sortedItems = useMemo(
    () => [...risk.items].sort((a, b) => (RISK_LEVEL_SEVERITY[b.severity] ?? 0) - (RISK_LEVEL_SEVERITY[a.severity] ?? 0)),
    [risk.items],
  )

  return (
    <Stack spacing={2}>
      <Typography variant="h5">{zhCN.pages.overview.label}</Typography>

      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
        <Card variant="outlined" sx={{ borderRadius: 3 }}>
          <CardContent>
            <SecurityIcon color={callNumber ? 'success' : 'warning'} fontSize="small" />
            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
              {zhCN.overview.configCard}
            </Typography>
            <Typography variant="h6">{callNumber ? '已配置' : '未配置'}</Typography>
            {callNumber && <Chip label={callNumber} size="small" variant="outlined" sx={{ mt: 0.5 }} />}
          </CardContent>
        </Card>
        <Card variant="outlined" sx={{ borderRadius: 3 }}>
          <CardContent>
            <WarningAmberIcon color={sosHistory.length > 0 ? 'error' : 'disabled'} fontSize="small" />
            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
              {zhCN.overview.sosCard}
            </Typography>
            <Typography variant="h6">{sosHistory.length} 条</Typography>
          </CardContent>
        </Card>
        <Card variant="outlined" sx={{ borderRadius: 3 }}>
          <CardContent>
            <PeopleIcon fontSize="small" />
            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
              {zhCN.pages.contacts.label}
            </Typography>
            <Typography variant="h6">{contacts.length} 人</Typography>
          </CardContent>
        </Card>
        <Card variant="outlined" sx={{ borderRadius: 3 }}>
          <CardContent>
            <TimelineIcon color={freshness.level === 'fresh' ? 'success' : 'warning'} fontSize="small" />
            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
              位置
            </Typography>
            <Typography variant="h6">{freshness.level === 'fresh' ? '新鲜' : freshness.level === 'stale' ? '过期' : '未知'}</Typography>
          </CardContent>
        </Card>
      </Box>

      <Card variant="outlined" sx={{ borderRadius: 3 }}>
        <CardContent>
          <Stack spacing={1}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="overline">风险提示</Typography>
              <Chip
                label={riskLabel(risk.level)}
                size="small"
                color={riskColor(risk.level)}
              />
            </Box>
            <Typography variant="caption" color="text.secondary">
              {zhCN.overview.risk.localOnly}
            </Typography>
            {sortedItems.length > 0 && (
              <Stack spacing={0.5}>
                {sortedItems.map((item, idx) => (
                  <Box key={idx} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 1 }}>
                    <Typography variant="body2" sx={{ flex: 1 }}>{item.title}</Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ flex: 2, textAlign: 'right' }}>
                      {item.detail}
                    </Typography>
                  </Box>
                ))}
              </Stack>
            )}
          </Stack>
        </CardContent>
      </Card>

      <Card variant="outlined" sx={{ borderRadius: 3 }}>
        <CardContent>
          <Typography variant="overline">{zhCN.overview.statusCard}</Typography>
          <Stack spacing={1} mt={1}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="body2">{zhCN.config.callNumber}</Typography>
              <Chip label={callNumber || zhCN.overview.notConfigured} size="small"
                color={callNumber ? 'success' : 'warning'} variant="outlined" />
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="body2">{zhCN.config.smsNumber}</Typography>
              <Chip label={smsNumber || zhCN.overview.notConfigured} size="small"
                color={smsNumber ? 'success' : 'warning'} variant="outlined" />
            </Box>
          </Stack>
        </CardContent>
      </Card>
    </Stack>
  )
}