import { useCallback } from 'react'
import {
  Stack, Typography, Card, CardContent, Button, Chip, Box, Alert,
} from '@mui/material'
import { useSosStore } from '../stores/useSosStore'
import { useConfigStore } from '../stores/useConfigStore'
import { useSosCountdown } from '../hooks/useSosCountdown'
import { useLocationFreshness } from '../hooks/useLocationFreshness'
import { useTrackingStore } from '../stores/useTrackingStore'
import { useIdentityStore } from '../stores/useIdentityStore'
import { StatusStepStack } from '../components/StatusStepStack'
import { zhCN } from '../i18n/zh-CN'

export function SosPage() {
  const sosResult = useSosStore((s) => s.sosResult)
  const arm = useSosStore((s) => s.arm)
  const cancel = useSosStore((s) => s.cancel)
  const triggerNow = useSosStore((s) => s.triggerNow)
  const reportLocationFailure = useSosStore((s) => s.reportLocationFailure)
  const retry = useSosStore((s) => s.retry)
  const callOnly = useSosStore((s) => s.callOnly)
  const smsOnly = useSosStore((s) => s.smsOnly)

  const callNumber = useConfigStore((s) => s.callNumber)
  const smsNumber = useConfigStore((s) => s.smsNumber)
  const smsTemplate = useConfigStore((s) => s.smsTemplate)
  const onboardingDone = useConfigStore((s) => s.onboardingDone)
  const userId = useIdentityStore((s) => s.userId)
  const deviceId = useIdentityStore((s) => s.deviceId)


  const freshness = useLocationFreshness(null)

  const onElapsed = useCallback(async () => {
    const now = new Date()
    const pad = (n: number) => String(n).padStart(2, '0')
    const timeStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`

    const tracking = useTrackingStore.getState()
    const prevCapturedAt = tracking.lastCapturedAt
    await tracking.captureNow()
    const history = useTrackingStore.getState().history
    const pos = history[history.length - 1]
    // Check that captureNow actually produced a new point
    if (!pos || tracking.lastCapturedAt === prevCapturedAt) {
      await reportLocationFailure('无法获取当前位置，未发送短信或拨打电话')
      return
    }

    await triggerNow({ lat: pos.lat, lng: pos.lng, accuracy: pos.accuracy, userId, deviceId, callNumber, smsNumber, smsTemplate, time: timeStr })
  }, [userId, deviceId, callNumber, smsNumber, smsTemplate, triggerNow, reportLocationFailure])

  const countdown = useSosCountdown(onElapsed)

  const handleTrigger = () => {
    arm()
    countdown.start()
  }

  const handleCancel = () => {
    cancel()
    countdown.cancel()
  }

  const steps = Object.values(sosResult.steps)
  const hasResult = sosResult.finalStatus !== 'idle'

  const canDispatchWithoutFreshLocation = sosResult.finalStatus !== 'location-failed'
  return (
    <Stack spacing={2}>
      <Typography variant="h5">{zhCN.pages.sos.label}</Typography>

      {!onboardingDone && (
        <Alert severity="info">请先在「配置」页设置号码后再触发 SOS</Alert>
      )}

      {!hasResult && (
        <>
          <Card variant="outlined" sx={{ borderRadius: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>SOS 快速操作</Typography>
              {countdown.active ? (
                <Button
                  variant="contained"
                  color="error"
                  fullWidth
                  size="large"
                  onClick={handleCancel}
                  sx={{ borderRadius: 4, py: 1.5 }}
                >
                  {zhCN.sos.cancelCountdown}（{zhCN.sos.countdown.replace('{n}', String(countdown.remaining))}）
                </Button>
              ) : (
                <Button
                  variant="contained"
                  color="error"
                  fullWidth
                  size="large"
                  onClick={handleTrigger}
                  sx={{ borderRadius: 4, py: 1.5 }}
                >
                  {zhCN.sos.trigger}（{zhCN.sos.countdown.replace('{n}', '5')}）
                </Button>
              )}
            </CardContent>
          </Card>

          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 1 }}>
            <Card variant="outlined" sx={{ borderRadius: 3 }}>
              <CardContent>
                <Typography variant="caption" color="text.secondary">电话通道</Typography>
                <Chip label={callNumber || '未配置'} size="small"
                  color={callNumber ? 'success' : 'warning'} sx={{ mt: 0.5 }} />
              </CardContent>
            </Card>
            <Card variant="outlined" sx={{ borderRadius: 3 }}>
              <CardContent>
                <Typography variant="caption" color="text.secondary">短信通道</Typography>
                <Chip label={smsNumber || '未配置'} size="small"
                  color={smsNumber ? 'success' : 'warning'} sx={{ mt: 0.5 }} />
              </CardContent>
            </Card>
            <Card variant="outlined" sx={{ borderRadius: 3 }}>
              <CardContent>
                <Typography variant="caption" color="text.secondary">位置</Typography>
                <Chip label={freshness.level} size="small"
                  color={freshness.tone} sx={{ mt: 0.5 }} />
              </CardContent>
            </Card>
          </Box>

          <Card variant="outlined" sx={{ borderRadius: 3 }}>
            <CardContent>
              <Typography variant="overline">触发说明</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                触发 SOS 后，系统将获取当前位置、写入本地记录、发送短信并拨打电话。
              </Typography>
            </CardContent>
          </Card>
        </>
      )}

      {hasResult && (
        <Card variant="outlined" sx={{ borderRadius: 3 }}>
          <CardContent>
            <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
              <Typography variant="h6">SOS 结果</Typography>
              <Chip
                label={sosResult.finalLabel}
                color={
                  sosResult.finalStatus === 'success' ? 'success'
                  : sosResult.finalStatus === 'partial-success' ? 'warning'
                  : 'error'
                }
              />
            </Stack>

            <Typography variant="body2" color="text.secondary" mb={1}>
              阶段：{sosResult.stage}
            </Typography>

            <StatusStepStack steps={steps} />

            <Stack direction="row" spacing={1} mt={2} flexWrap="wrap" useFlexGap>
              <Button size="small" variant="outlined" onClick={retry}>{zhCN.sos.retry}</Button>
              {canDispatchWithoutFreshLocation && (
                <>
                  <Button size="small" variant="outlined" onClick={callOnly}>{zhCN.sos.callOnly}</Button>
                  <Button size="small" variant="outlined" onClick={smsOnly}>{zhCN.sos.smsOnly}</Button>
                </>
              )}
            </Stack>
          </CardContent>
        </Card>
      )}
    </Stack>
  )
}