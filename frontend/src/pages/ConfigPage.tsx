import { useEffect, useState } from 'react'
import {
  Stack, Typography, Card, CardContent, TextField, Button, Chip, Box,
  Alert, Snackbar, Switch, FormControlLabel, Checkbox,
} from '@mui/material'
import { useConfigStore } from '../stores/useConfigStore'
import { useGeofenceStore } from '../stores/useGeofenceStore'
import { useNotificationConfigStore } from '../stores/useNotificationConfigStore'
import type { GeofenceZone } from '../domain/geofence'
import {
  renderTemplate, getDefaultTemplate, getSimpleTemplate,
  getAvailablePlaceholders, buildMapUrl,
} from '../domain/template'
import { zhCN } from '../i18n/zh-CN'
import { getStorageDriverLabel } from '../data/storage'
import {
  getStartupPermissionStatus,
  requestBackgroundRunPermission,
  requestStartupLocationPermission,
  requestStorageAccessPermission,
} from '../native/permissions'
import type { StartupPermissionEntry, StartupPermissionStatus } from '../native/permissions'
import { DEFAULT_RISK_RULE_CONFIG } from '../domain/riskRules'
import type { RiskRuleConfig } from '../domain/riskRules'
import { loadRiskRuleConfig, saveRiskRuleConfig } from '../data/riskRuleRepo'
import { DEFAULT_NOTIFICATION_CONFIG } from '../domain/notificationChannels'

function permissionChipColor(state: StartupPermissionEntry['state']): 'success' | 'warning' | 'default' | 'error' {
  if (state === 'granted' || state === 'notRequired') return 'success'
  if (state === 'manual' || state === 'unknown') return 'warning'
  if (state === 'denied') return 'error'
  return 'default'
}

function permissionStateLabel(state: StartupPermissionEntry['state']): string {
  const labels: Record<StartupPermissionEntry['state'], string> = {
    granted: '已授权',
    denied: '未授权',
    manual: '需手动设置',
    notRequired: '无需额外授权',
    unsupported: '不支持',
    unknown: '未知',
  }
  return labels[state]
}

function parseNotificationLeadMinutes(value: string): 1 | 5 | 10 | 15 {
  if (value === '1') return 1
  if (value === '10') return 10
  if (value === '15') return 15
  return 5
}

function PermissionRow({
  title,
  entry,
  actionLabel,
  onAction,
}: {
  title: string
  entry: StartupPermissionEntry | null
  actionLabel: string
  onAction: () => void
}) {
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: 'minmax(80px,1fr) auto', gap: 1, alignItems: 'center' }}>
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="body2">{title}</Typography>
        <Typography variant="caption" color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>
          {entry?.detail ?? '正在检查…'}
        </Typography>
      </Box>
      <Stack direction="row" spacing={1} alignItems="center" sx={{ justifySelf: 'end', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
        <Chip label={entry ? permissionStateLabel(entry.state) : '检查中'} size="small" color={entry ? permissionChipColor(entry.state) : 'default'} />
        <Button size="small" variant="outlined" onClick={onAction}>{actionLabel}</Button>
      </Stack>
    </Box>
  )
}

export function ConfigPage() {
  const callNumber = useConfigStore((s) => s.callNumber)
  const smsNumber = useConfigStore((s) => s.smsNumber)
  const smsTemplate = useConfigStore((s) => s.smsTemplate)
  const onboardingDone = useConfigStore((s) => s.onboardingDone)
  const pendingImport = useConfigStore((s) => s.pendingImport)
  const pendingDiffs = useConfigStore((s) => s.pendingDiffs)
  const importPending = useConfigStore((s) => s.importPending)

  const setField = useConfigStore((s) => s.setField)
  const save = useConfigStore((s) => s.save)
  const resetOnboarding = useConfigStore((s) => s.resetOnboarding)
  const startImport = useConfigStore((s) => s.startImport)
  const confirmImport = useConfigStore((s) => s.confirmImport)
  const cancelImport = useConfigStore((s) => s.cancelImport)
  const exportConfig = useConfigStore((s) => s.exportConfig)

  // Geofence
  const geofenceZones = useGeofenceStore((s) => s.zones)
  const addZone = useGeofenceStore((s) => s.addZone)
  const removeZone = useGeofenceStore((s) => s.removeZone)

  const notificationConfig = useNotificationConfigStore((s) => s.config)
  const notificationLoaded = useNotificationConfigStore((s) => s.loaded)
  const initializeNotificationConfig = useNotificationConfigStore((s) => s.initialize)
  const updateNotificationEnabled = useNotificationConfigStore((s) => s.updateEnabled)
  const updateTripExpiryEnabled = useNotificationConfigStore((s) => s.updateTripExpiryEnabled)
  const updateTripExpiryLeadMinutes = useNotificationConfigStore((s) => s.updateTripExpiryLeadMinutes)
  const updateRiskElevatedEnabled = useNotificationConfigStore((s) => s.updateRiskElevatedEnabled)

  const [showSaved, setShowSaved] = useState(false)
  const [newZoneLabel, setNewZoneLabel] = useState('')
  const [newZoneLat, setNewZoneLat] = useState('')
  const [newZoneLng, setNewZoneLng] = useState('')
  const [newZoneRadius, setNewZoneRadius] = useState('200')
  const [permissionStatus, setPermissionStatus] = useState<StartupPermissionStatus | null>(null)
  const [riskRules, setRiskRules] = useState<RiskRuleConfig>(DEFAULT_RISK_RULE_CONFIG)
  const [riskRulesSaved, setRiskRulesSaved] = useState(false)

  const refreshPermissionStatus = async () => {
    setPermissionStatus(await getStartupPermissionStatus())
  }

  useEffect(() => {
    refreshPermissionStatus()
  }, [])

  useEffect(() => {
    loadRiskRuleConfig().then(setRiskRules)
  }, [])

  useEffect(() => {
    if (!notificationLoaded) initializeNotificationConfig()
  }, [notificationLoaded, initializeNotificationConfig])

  const handleRequestLocationPermission = async () => {
    await requestStartupLocationPermission()
    await refreshPermissionStatus()
  }

  const handleRequestBackgroundRunPermission = async () => {
    await requestBackgroundRunPermission()
    await refreshPermissionStatus()
  }

  const handleRequestStorageAccessPermission = async () => {
    await requestStorageAccessPermission()
    await refreshPermissionStatus()
  }


  const handleSaveRiskRules = async () => {
    await saveRiskRuleConfig(riskRules)
    setRiskRulesSaved(true)
  }
  const handleSave = async () => {
    await save()
    setShowSaved(true)
  }

  const handleAddZone = async () => {
    const lat = parseFloat(newZoneLat)
    const lng = parseFloat(newZoneLng)
    const radiusM = parseInt(newZoneRadius, 10)
    if (!newZoneLabel.trim() || isNaN(lat) || isNaN(lng) || isNaN(radiusM) || radiusM <= 0) return
    await addZone({ id: '', label: newZoneLabel.trim(), lat, lng, radiusM })
    setNewZoneLabel('')
    setNewZoneLat('')
    setNewZoneLng('')
    setNewZoneRadius('200')
  }

  const effectiveNotificationConfig = notificationConfig ?? DEFAULT_NOTIFICATION_CONFIG

  const previewText = renderTemplate(smsTemplate, {
    userId: 'user_example',
    deviceId: 'device_example',
    lat: '31.2304',
    lng: '121.4737',
    time: '2026-05-23 14:30:00',
    mapUrl: buildMapUrl(31.2304, 121.4737),
  })

  const storageDriverLabel = getStorageDriverLabel()

  return (
    <Stack spacing={2}>
      <Typography variant="h5">{zhCN.pages.config.label}</Typography>

      <Card variant="outlined" sx={{ borderRadius: 3 }}>
        <CardContent>
          <Typography variant="overline">首次权限配置</Typography>
          <Alert severity="info" sx={{ mt: 1, mb: 1.5 }}>
            权限仅用于本地定位、SOS 与手动导出，不会自动上传数据。
          </Alert>
          <Stack spacing={1.25}>
            <PermissionRow
              title="定位权限"
              entry={permissionStatus?.location ?? null}
              actionLabel="申请定位权限"
              onAction={handleRequestLocationPermission}
            />
            <PermissionRow
              title="后台运行"
              entry={permissionStatus?.backgroundRun ?? null}
              actionLabel="打开后台运行设置"
              onAction={handleRequestBackgroundRunPermission}
            />
            <PermissionRow
              title="存储访问"
              entry={permissionStatus?.storage ?? null}
              actionLabel="检查存储访问"
              onAction={handleRequestStorageAccessPermission}
            />
          </Stack>
        </CardContent>
      </Card>

      <Card variant="outlined" sx={{ borderRadius: 3 }}>
        <CardContent>
          <Typography variant="overline">本地风险规则</Typography>
          <Alert severity="info" sx={{ mt: 1, mb: 1.5 }}>
            风险规则只影响本地提示，不会自动触发 SOS、短信或电话。
          </Alert>
          <Stack spacing={1.5}>
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 1 }} onChange={() => setRiskRulesSaved(false)}>
              <FormControlLabel
                control={<Switch checked={riskRules.staleTrack.enabled} onChange={(e) => setRiskRules((r) => ({ ...r, staleTrack: { ...r.staleTrack, enabled: e.target.checked } }))} />}
                label="轨迹数据过旧"
              />
              <TextField
                label="轨迹过旧阈值（分钟）"
                type="number"
                size="small"
                value={riskRules.staleTrack.maxAgeMinutes}
                onChange={(e) => setRiskRules((r) => ({ ...r, staleTrack: { ...r.staleTrack, maxAgeMinutes: Number(e.target.value) } }))}
              />
              <FormControlLabel
                control={<Switch checked={riskRules.longGap.enabled} onChange={(e) => setRiskRules((r) => ({ ...r, longGap: { ...r.longGap, enabled: e.target.checked } }))} />}
                label="轨迹长时间间断"
              />
              <TextField
                label="长间断阈值（分钟）"
                type="number"
                size="small"
                value={riskRules.longGap.maxGapMinutes}
                onChange={(e) => setRiskRules((r) => ({ ...r, longGap: { ...r.longGap, maxGapMinutes: Number(e.target.value) } }))}
              />
              <FormControlLabel
                control={<Switch checked={riskRules.suspiciousPause.enabled} onChange={(e) => setRiskRules((r) => ({ ...r, suspiciousPause: { ...r.suspiciousPause, enabled: e.target.checked } }))} />}
                label="可疑长停"
              />
              <TextField
                label="长停时长（分钟）"
                type="number"
                size="small"
                value={riskRules.suspiciousPause.minMinutes}
                onChange={(e) => setRiskRules((r) => ({ ...r, suspiciousPause: { ...r.suspiciousPause, minMinutes: Number(e.target.value) } }))}
              />
              <TextField
                label="长停半径（米）"
                type="number"
                size="small"
                value={riskRules.suspiciousPause.radiusM}
                onChange={(e) => setRiskRules((r) => ({ ...r, suspiciousPause: { ...r.suspiciousPause, radiusM: Number(e.target.value) } }))}
              />
              <FormControlLabel
                control={<Switch checked={riskRules.highSpeed.enabled} onChange={(e) => setRiskRules((r) => ({ ...r, highSpeed: { ...r.highSpeed, enabled: e.target.checked } }))} />}
                label="高速移动"
              />
              <TextField
                label="高速阈值（km/h）"
                type="number"
                size="small"
                value={riskRules.highSpeed.maxKmh}
                onChange={(e) => setRiskRules((r) => ({ ...r, highSpeed: { ...r.highSpeed, maxKmh: Number(e.target.value) } }))}
              />
              <FormControlLabel
                control={<Switch checked={riskRules.sosNearbyTrack.enabled} onChange={(e) => setRiskRules((r) => ({ ...r, sosNearbyTrack: { ...r.sosNearbyTrack, enabled: e.target.checked } }))} />}
                label="SOS 附近轨迹"
              />
              <TextField
                label="SOS 距离阈值（米）"
                type="number"
                size="small"
                value={riskRules.sosNearbyTrack.maxDistanceM}
                onChange={(e) => setRiskRules((r) => ({ ...r, sosNearbyTrack: { ...r.sosNearbyTrack, maxDistanceM: Number(e.target.value) } }))}
              />
              <FormControlLabel
                control={<Switch checked={riskRules.geofence.enabled} onChange={(e) => setRiskRules((r) => ({ ...r, geofence: { ...r.geofence, enabled: e.target.checked } }))} />}
                label="地理围栏事件"
              />
              <FormControlLabel
                control={<Switch checked={riskRules.configCompleteness.enabled} onChange={(e) => setRiskRules((r) => ({ ...r, configCompleteness: { enabled: e.target.checked } }))} />}
                label="配置完整性检查"
              />
              <FormControlLabel
                control={<Switch checked={riskRules.locationFreshness.enabled} onChange={(e) => setRiskRules((r) => ({ ...r, locationFreshness: { ...r.locationFreshness, enabled: e.target.checked } }))} />}
                label="位置新鲜度"
              />
              <TextField
                label="位置过期阈值（分钟）"
                type="number"
                size="small"
                value={riskRules.locationFreshness.maxAgeMinutes}
                onChange={(e) => setRiskRules((r) => ({ ...r, locationFreshness: { ...r.locationFreshness, maxAgeMinutes: Number(e.target.value) } }))}
              />
            </Box>
            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
              <Button size="small" variant="contained" onClick={handleSaveRiskRules}>保存风险规则</Button>
              {riskRulesSaved && <Chip label="风险规则已保存" size="small" color="success" />}
            </Stack>
          </Stack>
        </CardContent>
      </Card>

      <Card variant="outlined" sx={{ borderRadius: 3 }}>
        <CardContent>
          <Typography variant="overline">本地通知</Typography>
          <Alert severity="info" sx={{ mt: 1, mb: 1.5 }}>
            通知仅为本机提醒，不承诺后台、熄屏或 force-stop 后送达。
          </Alert>
          <Stack spacing={1.5}>
            <FormControlLabel
              control={(
                <Checkbox
                  checked={effectiveNotificationConfig.enabled}
                  onChange={(event) => void updateNotificationEnabled(event.target.checked)}
                />
              )}
              label="启用本地通知"
            />
            <FormControlLabel
              control={(
                <Checkbox
                  checked={effectiveNotificationConfig.tripExpiring.enabled}
                  onChange={(event) => void updateTripExpiryEnabled(event.target.checked)}
                />
              )}
              label="行程超时提醒"
            />
            <TextField
              select
              SelectProps={{ native: true }}
              label="行程通知提前时间（分钟）"
              size="small"
              value={String(effectiveNotificationConfig.tripExpiring.leadMinutes)}
              onChange={(e) => void updateTripExpiryLeadMinutes(parseNotificationLeadMinutes(e.target.value))}
              sx={{ maxWidth: 260 }}
            >
              <option value="1">1</option>
              <option value="5">5</option>
              <option value="10">10</option>
              <option value="15">15</option>
            </TextField>
            <FormControlLabel
              control={(
                <Checkbox
                  checked={effectiveNotificationConfig.riskElevated.enabled}
                  onChange={(event) => void updateRiskElevatedEnabled(event.target.checked)}
                />
              )}
              label="风险变化提醒"
            />
          </Stack>
        </CardContent>
      </Card>

      <Card variant="outlined" sx={{ borderRadius: 3 }}>
        <CardContent>
          <Typography variant="overline">版本与配置</Typography>
          <Stack spacing={1} mt={1}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2 }}>
              <Typography variant="body2">前端 / Android</Typography>
              <Chip label={`v${__APP_VERSION__}`} size="small" />
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2 }}>
              <Typography variant="body2">本地快照</Typography>
              <Chip label="跟随当前应用版本" size="small" />
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2 }}>
              <Typography variant="body2">持久化</Typography>
              <Chip label={storageDriverLabel} size="small" />
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2 }}>
              <Typography variant="body2">远端后端</Typography>
              <Chip label="未接入当前前端主线" size="small" color="default" />
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2 }}>
              <Typography variant="body2">能力边界</Typography>
              <Chip label="仅前台 / 应用存活期间" size="small" color="warning" />
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2 }}>
              <Typography variant="body2">后台 / 熄屏 / force-stop</Typography>
              <Chip label="本轮真机正常，不承诺持续运行" size="small" color="default" />
            </Box>
          </Stack>
        </CardContent>
      </Card>

      <Card variant="outlined" sx={{ borderRadius: 3 }}>
        <CardContent>
          <Typography variant="overline">{zhCN.pages.config.label}</Typography>
          <Stack direction="row" spacing={1} mt={1}>
            <Button size="small" variant="outlined" component="label">
              {zhCN.config.importConfig}
              <input type="file" accept=".json" hidden onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) file.text().then(startImport)
              }} />
            </Button>
            <Button size="small" variant="outlined" onClick={exportConfig}>
              {zhCN.config.exportConfig}
            </Button>
            <Button size="small" variant="text" color="warning" onClick={resetOnboarding}>
              {zhCN.config.resetOnboarding}
            </Button>
          </Stack>
          {!onboardingDone && <Chip label="首屏引导模式" size="small" color="warning" sx={{ mt: 1 }} />}
        </CardContent>
      </Card>

      {importPending && pendingImport && (
        <Card variant="outlined" sx={{ borderRadius: 3, borderColor: 'warning.main' }}>
          <CardContent>
            <Typography variant="overline">{zhCN.config.importTitle}</Typography>
            <Typography variant="body2" mt={1}>{zhCN.config.callNumber}：{pendingImport.callNumber || '（留空）'}</Typography>
            <Typography variant="body2">{zhCN.config.smsNumber}：{pendingImport.smsNumber || '（留空）'}</Typography>
            <Typography variant="body2">模板长度：{pendingImport.smsTemplate.length} 字符</Typography>
            {pendingDiffs.length > 0 && (
              <>
                <Typography variant="overline" mt={1}>{zhCN.config.diffFields}：</Typography>
                {pendingDiffs.map((d, i) => (
                  <Alert key={i} severity="info" sx={{ mt: 0.5 }}>
                    {d.field}：当前"{d.current}" → 导入"{d.imported}"
                  </Alert>
                ))}
              </>
            )}
            <Stack direction="row" spacing={1} mt={2}>
              <Button size="small" variant="contained" onClick={confirmImport}>{zhCN.config.importConfirm}</Button>
              <Button size="small" variant="text" onClick={cancelImport}>{zhCN.config.importCancel}</Button>
            </Stack>
          </CardContent>
        </Card>
      )}

      {/* Geofence zones */}
      <Card variant="outlined" sx={{ borderRadius: 3 }}>
        <CardContent>
          <Typography variant="overline">{zhCN.geofence.title}</Typography>
          <Stack spacing={1} mt={1}>
            <Box
              data-testid="geofence-form"
              sx={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit,minmax(148px,1fr))',
                gap: 1,
                alignItems: 'stretch',
              }}
            >
              <TextField
                label={zhCN.geofence.labelLabel}
                value={newZoneLabel}
                onChange={(e) => setNewZoneLabel(e.target.value)}
                size="small"
                fullWidth
                sx={{ minWidth: 0 }}
              />
              <TextField
                label={zhCN.geofence.latitudeLabel}
                value={newZoneLat}
                onChange={(e) => setNewZoneLat(e.target.value)}
                size="small"
                type="number"
                inputProps={{ step: 'any' }}
                fullWidth
                sx={{ minWidth: 0 }}
              />
              <TextField
                label={zhCN.geofence.longitudeLabel}
                value={newZoneLng}
                onChange={(e) => setNewZoneLng(e.target.value)}
                size="small"
                type="number"
                inputProps={{ step: 'any' }}
                fullWidth
                sx={{ minWidth: 0 }}
              />
              <TextField
                label={zhCN.geofence.radiusLabel}
                value={newZoneRadius}
                onChange={(e) => setNewZoneRadius(e.target.value)}
                size="small"
                type="number"
                inputProps={{ min: 1 }}
                fullWidth
                sx={{ minWidth: 0 }}
              />
              <Button size="small" variant="contained" onClick={handleAddZone} sx={{ minHeight: 40, whiteSpace: 'nowrap' }}>
                {zhCN.geofence.add}
              </Button>
            </Box>
            {geofenceZones.length === 0 ? (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                {zhCN.geofence.noZones}
              </Typography>
            ) : (
              geofenceZones.map((z: GeofenceZone) => (
                <Stack
                  key={z.id}
                  data-testid={`geofence-zone-row-${z.id}`}
                  direction="row"
                  justifyContent="space-between"
                  alignItems="center"
                  sx={{ mt: 1, gap: 1, flexWrap: 'wrap' }}
                >
                  <Typography variant="body2" sx={{ flex: '1 1 180px', minWidth: 0, overflowWrap: 'anywhere' }}>
                    {z.label} ({z.lat.toFixed(5)}, {z.lng.toFixed(5)}) · {z.radiusM}m
                  </Typography>
                  <Button size="small" variant="text" color="error" onClick={() => removeZone(z.id)} sx={{ flexShrink: 0 }}>
                    {zhCN.geofence.remove}
                  </Button>
                </Stack>
              ))
            )}
          </Stack>
        </CardContent>
      </Card>

      <Card variant="outlined" sx={{ borderRadius: 3 }}>
        <CardContent>
          <Typography variant="overline">{zhCN.config.callNumber}</Typography>
          <Stack spacing={2} mt={2}>
            <TextField label={zhCN.config.callNumber} value={callNumber}
              onChange={(e) => setField('callNumber', e.target.value)}
              fullWidth size="small" placeholder="可留空" />
            <TextField label={zhCN.config.smsNumber} value={smsNumber}
              onChange={(e) => setField('smsNumber', e.target.value)}
              fullWidth size="small" placeholder="可留空" />
            <TextField label={zhCN.config.smsTemplate} value={smsTemplate}
              onChange={(e) => setField('smsTemplate', e.target.value)}
              fullWidth multiline rows={5} size="small" />
            <Stack direction="row" spacing={1}>
              <Button size="small" variant="text" onClick={() => setField('smsTemplate', getDefaultTemplate())}>
                {zhCN.config.defaultTemplate}
              </Button>
              <Button size="small" variant="text" onClick={() => setField('smsTemplate', getSimpleTemplate())}>
                {zhCN.config.simpleTemplate}
              </Button>
            </Stack>
          </Stack>
          <Button variant="contained" onClick={handleSave} fullWidth sx={{ mt: 2 }}>
            {zhCN.actions.save}
          </Button>
        </CardContent>
      </Card>

      <Card variant="outlined" sx={{ borderRadius: 3 }}>
        <CardContent>
          <Typography variant="overline">{zhCN.config.helpDescription}</Typography>
          <Typography variant="body2" mt={1}>{zhCN.config.placeholders}：</Typography>
          <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap mt={0.5}>
            {getAvailablePlaceholders().map((p) => (
              <Chip key={p} label={p} size="small" variant="outlined" />
            ))}
          </Stack>
          <Typography variant="body2" mt={2}>{zhCN.config.preview}：</Typography>
          <Box sx={{ bgcolor: 'action.hover', color: 'text.primary', border: 1, borderColor: 'divider', p: 1.5, borderRadius: 2, mt: 0.5 }}>
            <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
              {previewText}
            </Typography>
          </Box>
        </CardContent>
      </Card>

      <Snackbar open={showSaved} autoHideDuration={2000}
        onClose={() => setShowSaved(false)} message={zhCN.config.configSaved} />
    </Stack>
  )
}