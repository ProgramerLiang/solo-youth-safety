import { useEffect, useMemo, useRef, useState } from 'react'
import { Stack, Typography, Card, CardContent, Chip, Box, Button, Dialog, DialogTitle, DialogContent, DialogActions, TextField } from '@mui/material'
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
import { useNotificationConfigStore } from '../stores/useNotificationConfigStore'
import { deriveSafetyTripStatus } from '../domain/safetyTrip'
import { useLocationFreshness } from '../hooks/useLocationFreshness'
import { aggregateRiskData } from '../domain/riskAssessment'
import type { RiskItem, RiskLevel } from '../domain/riskAssessment'
import { routeGeofenceEvents } from '../domain/geofence'
import { DEFAULT_RISK_RULE_CONFIG } from '../domain/riskRules'
import { loadRiskRuleConfig } from '../data/riskRuleRepo'
import type { RiskRuleConfig } from '../domain/riskRules'
import { scheduleRiskNotification } from '../data/localNotificationRepo'
import { RiskLevelIndicator } from '../components/RiskLevelIndicator'
import { RiskGroupCard } from '../components/RiskGroupCard'
import { EmptyRiskGroup } from '../components/EmptyRiskGroup'
import { DashboardDisclaimer } from '../components/DashboardDisclaimer'
import { zhCN } from '../i18n/zh-CN'

const RISK_LEVEL_SEVERITY: Record<RiskLevel, number> = { ok: 0, attention: 1, warning: 2 }

interface RiskGroup {
  key: string
  title: string
  icon: string
  emptyMessage: string
  items: RiskItem[]
}

function riskGroupKey(rule: string | undefined): string {
  if (rule === 'geofence') return 'geofence'
  if (rule === 'safetyTrip') return 'safetyTrip'
  if (rule === 'configCompleteness' || rule === 'locationFreshness') return 'config'
  if (rule === 'staleTrack' || rule === 'longGap' || rule === 'suspiciousPause' || rule === 'highSpeed' || rule === 'sosNearbyTrack') return 'trace'
  return 'other'
}

function groupRiskItems(items: RiskItem[]): RiskGroup[] {
  const groups: Record<string, RiskGroup> = {
    trace: { key: 'trace', title: '轨迹风险', icon: '轨', emptyMessage: '轨迹追踪正常', items: [] },
    config: { key: 'config', title: '配置风险', icon: '配', emptyMessage: '配置完整', items: [] },
    geofence: { key: 'geofence', title: '围栏风险', icon: '围', emptyMessage: '暂无围栏事件', items: [] },
    safetyTrip: { key: 'safetyTrip', title: '行程风险', icon: '行', emptyMessage: '无进行中行程', items: [] },
    other: { key: 'other', title: '其他提示', icon: '其', emptyMessage: '无其他提示', items: [] },
  }
  for (const item of items) groups[riskGroupKey(item.rule)].items.push(item)
  return Object.values(groups)
}

function tripTimeLabel(expectedArrivalAt: string, now = Date.now()): string {
  const diffMinutes = Math.ceil((new Date(expectedArrivalAt).getTime() - now) / 60_000)
  if (diffMinutes <= 0) return `已超时约 ${Math.abs(diffMinutes)} 分钟`
  return `剩余约 ${diffMinutes} 分钟 · 预计到达：${new Date(expectedArrivalAt).toLocaleTimeString('zh-CN')}`
}

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
  const tripLoaded = useSafetyTripStore((s) => s.loaded)
  const tripInitialize = useSafetyTripStore((s) => s.initialize)
  const tripCreate = useSafetyTripStore((s) => s.createTrip)
  const tripArrive = useSafetyTripStore((s) => s.arrive)
  const tripExtend = useSafetyTripStore((s) => s.extend)
  const tripCancel = useSafetyTripStore((s) => s.cancel)
  const notificationConfig = useNotificationConfigStore((s) => s.config)
  const notificationLoaded = useNotificationConfigStore((s) => s.loaded)
  const notificationInitialize = useNotificationConfigStore((s) => s.initialize)
  const previousRiskLevel = useRef<RiskLevel | null>(null)
  const [tripDialogOpen, setTripDialogOpen] = useState(false)
  const [tripDest, setTripDest] = useState('')
  const [tripMinutes, setTripMinutes] = useState(30)
  const [tripNote, setTripNote] = useState('')

  useEffect(() => {
    loadRiskRuleConfig().then(setRiskRules)
  }, [])

  useEffect(() => {
    if (!tripLoaded) tripInitialize()
  }, [tripLoaded, tripInitialize])

  useEffect(() => {
    if (!notificationLoaded) notificationInitialize()
  }, [notificationLoaded, notificationInitialize])

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
  const riskGroups = useMemo(() => groupRiskItems(sortedItems), [sortedItems])

  useEffect(() => {
    if (previousRiskLevel.current === null) {
      previousRiskLevel.current = risk.level
      return
    }
    const previous = RISK_LEVEL_SEVERITY[previousRiskLevel.current]
    const current = RISK_LEVEL_SEVERITY[risk.level]
    previousRiskLevel.current = risk.level
    if (!notificationConfig?.enabled || !notificationConfig.riskElevated.enabled) return
    if (current > previous) void scheduleRiskNotification()
  }, [risk.level, notificationConfig])

  return (
    <Stack spacing={2}>
      <Typography variant="h5">{zhCN.pages.overview.label}</Typography>
      <DashboardDisclaimer />

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
                        : tripTimeLabel(tripCurrent.expectedArrivalAt)}
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
          <Stack spacing={1.5}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="overline">风险提示</Typography>
              <Chip label={`${sortedItems.length} 项`} size="small" color={sortedItems.length > 0 ? 'warning' : 'success'} />
            </Box>
            <Typography variant="caption" color="text.secondary">
              {zhCN.overview.risk.localOnly}
            </Typography>
            <RiskLevelIndicator level={risk.level} />
            <Stack spacing={1}>
              {riskGroups.map((group) => (
                <Box key={group.key}>
                  <RiskGroupCard title={group.title} icon={group.icon} items={group.items} />
                  {group.items.length === 0 && <EmptyRiskGroup message={group.emptyMessage} />}
                </Box>
              ))}
            </Stack>
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
            <TextField
              label="目的地名称"
              value={tripDest}
              onChange={(e) => setTripDest(e.target.value.slice(0, 40))}
              size="small"
              fullWidth
              inputProps={{ maxLength: 40 }}
            />
            <TextField
              label="预计时长（分钟）"
              type="number"
              value={tripMinutes}
              onChange={(e) => setTripMinutes(Number(e.target.value))}
              size="small"
              fullWidth
              inputProps={{ min: 5, max: 240 }}
            />
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              {[15, 30, 45, 60].map((minutes) => (
                <Button key={minutes} size="small" variant={tripMinutes === minutes ? 'contained' : 'outlined'} onClick={() => setTripMinutes(minutes)}>{minutes} 分钟</Button>
              ))}
            </Box>
            <TextField
              label="备注（可选）"
              value={tripNote}
              onChange={(e) => setTripNote(e.target.value.slice(0, 120))}
              size="small"
              fullWidth
              multiline
              maxRows={2}
              inputProps={{ maxLength: 120 }}
            />
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