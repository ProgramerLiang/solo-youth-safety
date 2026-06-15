import { useEffect, useMemo, useState } from 'react'
import { Stack, Typography, Card, CardContent, Chip, Box, Button, Dialog, DialogTitle, DialogContent, DialogActions, TextField, MenuItem } from '@mui/material'
import SecurityIcon from '@mui/icons-material/Security'
import PeopleIcon from '@mui/icons-material/People'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import TimelineIcon from '@mui/icons-material/Timeline'
import { useConfigStore } from '../stores/useConfigStore'
import { useSosStore } from '../stores/useSosStore'
import { useContactsStore } from '../stores/useContactsStore'
import { useTrackingStore } from '../stores/useTrackingStore'
import { useGeofenceStore } from '../stores/useGeofenceStore'
import { useSafetyTripStore } from '../stores/useSafetyTripStore'
import { deriveSafetyTripStatus } from '../domain/safetyTrip'
import { useLocationFreshness } from '../hooks/useLocationFreshness'
import { aggregateRiskData } from '../domain/riskAssessment'
import type { RiskLevel } from '../domain/riskAssessment'
import { routeGeofenceEvents } from '../domain/geofence'
import { DEFAULT_RISK_RULE_CONFIG } from '../domain/riskRules'
import { loadRiskRuleConfig } from '../data/riskRuleRepo'
import type { RiskRuleConfig } from '../domain/riskRules'
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

function riskRuleLabel(rule: string | undefined): string | null {
  if (!rule) return null
  const labels: Record<string, string> = {
    staleTrack: '轨迹数据过旧',
    longGap: '轨迹长时间间断',
    suspiciousPause: '可疑长停',
    highSpeed: '高速移动',
    sosNearbyTrack: 'SOS 附近轨迹',
    locationFreshness: '位置新鲜度',
    geofence: '地理围栏事件',
    configCompleteness: '配置完整性检查',
  }
  return labels[rule] ?? rule
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
  const [riskRules, setRiskRules] = useState<RiskRuleConfig>(DEFAULT_RISK_RULE_CONFIG)
  const tripCurrent = useSafetyTripStore((s) => s.current)
  const tripCreate = useSafetyTripStore((s) => s.createTrip)
  const tripArrive = useSafetyTripStore((s) => s.arrive)
  const tripExtend = useSafetyTripStore((s) => s.extend)
  const tripCancel = useSafetyTripStore((s) => s.cancel)
  const [tripDialogOpen, setTripDialogOpen] = useState(false)
  const [tripDest, setTripDest] = useState('')
  const [tripMinutes, setTripMinutes] = useState(30)
  const [tripNote, setTripNote] = useState('')

  useEffect(() => {
    loadRiskRuleConfig().then(setRiskRules)
  }, [])

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
      riskRules,
      safetyTrip: tripCurrent ?? undefined,
    })
  }, [trackHistory, sosHistory, callNumber, smsNumber, contacts, timestampMs, geofenceEvents, riskRules, tripCurrent])
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
            <Typography variant="overline">安全行程</Typography>
            <Typography variant="caption" color="text.secondary">
              安全行程只在本机记录和提醒，不会自动通知联系人。
            </Typography>
            {tripCurrent ? (
              (() => {
                const tripStatus = deriveSafetyTripStatus(tripCurrent, Date.now())
                return (
                  <Stack spacing={1}>
                    <Typography variant="h6">{tripCurrent.destination}</Typography>
                    <Typography variant="body2" color={tripStatus === 'overdue' ? 'error' : 'text.secondary'}>
                      {tripStatus === 'overdue'
                        ? '超时未确认。请手动确认状态；当前版本不会自动发送 SOS。'
                        : `预计到达：${new Date(tripCurrent.expectedArrivalAt).toLocaleTimeString('zh-CN')}`}
                    </Typography>
                    {tripCurrent.note && (
                      <Typography variant="caption" color="text.secondary">{tripCurrent.note}</Typography>
                    )}
                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                      <Button size="small" variant="contained" color="success" onClick={() => tripArrive()}>已到达</Button>
                      <Button size="small" variant="outlined" onClick={() => tripExtend(10)}>延长 10 分钟</Button>
                      <Button size="small" variant="outlined" color="error" onClick={() => tripCancel()}>取消</Button>
                    </Box>
                  </Stack>
                )
              })()
            ) : (
              <Button variant="outlined" size="small" onClick={() => setTripDialogOpen(true)}>创建安全行程</Button>
            )}
          </Stack>
        </CardContent>
      </Card>

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
                      {riskRuleLabel(item.rule) ? `规则：${riskRuleLabel(item.rule)} · ${item.detail}` : item.detail}
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

      <Dialog open={tripDialogOpen} onClose={() => setTripDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>创建安全行程</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField label="目的地名称" value={tripDest} onChange={(e) => setTripDest(e.target.value)} size="small" fullWidth />
            <TextField select label="预计时长（分钟）" value={tripMinutes} onChange={(e) => setTripMinutes(Number(e.target.value))} size="small" fullWidth>
              <MenuItem value={15}>15</MenuItem>
              <MenuItem value={30}>30</MenuItem>
              <MenuItem value={45}>45</MenuItem>
              <MenuItem value={60}>60</MenuItem>
            </TextField>
            <TextField label="备注（可选）" value={tripNote} onChange={(e) => setTripNote(e.target.value)} size="small" fullWidth multiline maxRows={2} />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTripDialogOpen(false)}>取消</Button>
          <Button
            variant="contained"
            disabled={!tripDest.trim() || tripMinutes < 5 || tripMinutes > 240}
            onClick={async () => {
              await tripCreate({ destination: tripDest.trim(), durationMinutes: tripMinutes, note: tripNote.trim() || undefined })
              setTripDest('')
              setTripMinutes(30)
              setTripNote('')
              setTripDialogOpen(false)
            }}
          >创建</Button>
        </DialogActions>
      </Dialog>
    </Stack>
  )
}