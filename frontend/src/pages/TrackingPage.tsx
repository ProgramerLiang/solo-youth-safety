import {
  Stack, Typography, Card, CardContent, Button, Chip, Select, MenuItem, FormControl,
  InputLabel,
} from '@mui/material'
import { useTrackingStore } from '../stores/useTrackingStore'
import { useLocationFreshness } from '../hooks/useLocationFreshness'
import { zhCN } from '../i18n/zh-CN'

const INTERVAL_OPTIONS = [
  { value: 10, label: '10 秒' },
  { value: 30, label: '30 秒' },
  { value: 60, label: '1 分钟' },
  { value: 120, label: '2 分钟' },
  { value: 300, label: '5 分钟' },
]

export function TrackingPage() {
  const enabled = useTrackingStore((s) => s.enabled)
  const intervalSeconds = useTrackingStore((s) => s.intervalSeconds)
  const pendingCount = useTrackingStore((s) => s.pendingCount)
  const lastCapturedAt = useTrackingStore((s) => s.lastCapturedAt)
  const lastAcknowledgedAt = useTrackingStore((s) => s.lastAcknowledgedAt)
  const busy = useTrackingStore((s) => s.busy)

  const start = useTrackingStore((s) => s.start)
  const stop = useTrackingStore((s) => s.stop)
  const setInterval = useTrackingStore((s) => s.setInterval)
  const captureNow = useTrackingStore((s) => s.captureNow)
  const acknowledgeQueue = useTrackingStore((s) => s.acknowledgeQueue)

  const freshness = useLocationFreshness(lastCapturedAt)

  const lastCapturedStr = lastCapturedAt
    ? new Date(lastCapturedAt).toLocaleString('zh-CN')
    : zhCN.tracking.neverCaptured

  const lastAcknowledgedStr = lastAcknowledgedAt
    ? new Date(lastAcknowledgedAt).toLocaleString('zh-CN')
    : zhCN.tracking.neverSynced

  return (
    <Stack spacing={2}>
      <Typography variant="h5">{zhCN.pages.tracking.label}</Typography>

      <Card variant="outlined" sx={{ borderRadius: 3 }}>
        <CardContent>
          <Typography variant="body2" color="text.secondary">
            {zhCN.tracking.description}
          </Typography>
        </CardContent>
      </Card>

      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
        <Card variant="outlined" sx={{ borderRadius: 3, flex: 1, minWidth: 140 }}>
          <CardContent>
            <Typography variant="caption" color="text.secondary">{zhCN.tracking.status}</Typography>
            <Chip label={enabled ? zhCN.tracking.running : zhCN.tracking.stopped} size="small"
              color={enabled ? 'success' : 'default'} sx={{ mt: 0.5, display: 'block' }} />
          </CardContent>
        </Card>
        <Card variant="outlined" sx={{ borderRadius: 3, flex: 1, minWidth: 140 }}>
          <CardContent>
            <Typography variant="caption" color="text.secondary">{zhCN.tracking.pending}</Typography>
            <Chip label={`${pendingCount} 条`} size="small" color={pendingCount > 0 ? 'warning' : 'default'}
              sx={{ mt: 0.5, display: 'block' }} />
          </CardContent>
        </Card>
        <Card variant="outlined" sx={{ borderRadius: 3, flex: 1, minWidth: 140 }}>
          <CardContent>
            <Typography variant="caption" color="text.secondary">{zhCN.tracking.freshness}</Typography>
            <Chip label={freshness.level} size="small" color={freshness.tone} sx={{ mt: 0.5, display: 'block' }} />
          </CardContent>
        </Card>
      </Stack>

      <Card variant="outlined" sx={{ borderRadius: 3 }}>
        <CardContent>
          <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap" useFlexGap>
            <FormControl size="small" sx={{ minWidth: 140 }}>
              <InputLabel>{zhCN.tracking.interval}</InputLabel>
              <Select
                value={intervalSeconds}
                label={zhCN.tracking.interval}
                onChange={(e) => setInterval(Number(e.target.value))}
              >
                {INTERVAL_OPTIONS.map((opt) => (
                  <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
                ))}
              </Select>
            </FormControl>

            {enabled ? (
              <Button variant="outlined" color="error" onClick={stop} disabled={busy}>
                {zhCN.tracking.stopTracking}
              </Button>
            ) : (
              <Button variant="contained" onClick={start} disabled={busy}>
                {zhCN.tracking.startTracking}
              </Button>
            )}

            <Button variant="outlined" onClick={captureNow} disabled={busy}>
              {zhCN.tracking.captureNow}
            </Button>

            <Button variant="outlined" onClick={acknowledgeQueue} disabled={busy || pendingCount === 0}>
              {zhCN.tracking.acknowledgeQueue}
            </Button>
          </Stack>
        </CardContent>
      </Card>

      <Card variant="outlined" sx={{ borderRadius: 3 }}>
        <CardContent>
          <Typography variant="body2" color="text.secondary">
            {zhCN.tracking.lastCapture}：{lastCapturedStr}
          </Typography>
          <Typography variant="body2" color="text.secondary" mt={0.5}>
            {zhCN.tracking.lastAcknowledgement}：{lastAcknowledgedStr}
          </Typography>
        </CardContent>
      </Card>
    </Stack>
  )
}