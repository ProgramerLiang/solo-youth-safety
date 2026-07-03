import { useCallback, useEffect, useRef, useState } from 'react'
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Typography, LinearProgress, Box } from '@mui/material'
import { useSosStore } from '../stores/useSosStore'
import { useConfigStore } from '../stores/useConfigStore'
import { useIdentityStore } from '../stores/useIdentityStore'
import { useTrackingStore } from '../stores/useTrackingStore'

const COUNTDOWN_SECONDS = 5

export function PreArmOverlay() {
  const arming = useSosStore((s) => s.arming)
  const countdownActive = useSosStore((s) => s.countdownActive)
  const preArmSource = useSosStore((s) => s.preArmSource)
  const cancel = useSosStore((s) => s.cancel)
  const triggerNow = useSosStore((s) => s.triggerNow)
  const reportLocationFailure = useSosStore((s) => s.reportLocationFailure)
  const sosResult = useSosStore((s) => s.sosResult)

  const callNumber = useConfigStore((s) => s.callNumber)
  const smsNumber = useConfigStore((s) => s.smsNumber)
  const smsTemplate = useConfigStore((s) => s.smsTemplate)
  const userId = useIdentityStore((s) => s.userId)
  const deviceId = useIdentityStore((s) => s.deviceId)

  const [remaining, setRemaining] = useState(COUNTDOWN_SECONDS)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const triggeredRef = useRef(false)

  const onElapsed = useCallback(async () => {
    const now = new Date()
    const pad = (n: number) => String(n).padStart(2, '0')
    const timeStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`

    const tracking = useTrackingStore.getState()
    const prevCapturedAt = tracking.lastCapturedAt
    await tracking.captureNow()
    const history = useTrackingStore.getState().history
    const pos = history[history.length - 1]
    if (!pos || tracking.lastCapturedAt === prevCapturedAt) {
      await reportLocationFailure('无法获取当前位置，未发送短信或拨打电话')
      return
    }

    await triggerNow({
      lat: pos.lat,
      lng: pos.lng,
      accuracy: pos.accuracy,
      userId,
      deviceId,
      callNumber,
      smsNumber,
      smsTemplate,
      time: timeStr,
    })
  }, [userId, deviceId, callNumber, smsNumber, smsTemplate, triggerNow, reportLocationFailure])

  useEffect(() => {
    if (!arming || !countdownActive) {
      setRemaining(COUNTDOWN_SECONDS)
      triggeredRef.current = false
      if (timerRef.current !== null) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
      return
    }

    setRemaining(COUNTDOWN_SECONDS)
    triggeredRef.current = false

    timerRef.current = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) {
          if (timerRef.current !== null) {
            clearInterval(timerRef.current)
            timerRef.current = null
          }
          if (!triggeredRef.current) {
            triggeredRef.current = true
            onElapsed()
          }
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => {
      if (timerRef.current !== null) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
    }
  }, [arming, countdownActive, onElapsed])

  if (!preArmSource) return null

  const open = arming && countdownActive && preArmSource !== null
  const progress = (remaining / COUNTDOWN_SECONDS) * 100
  const hasResult = sosResult.finalStatus !== 'idle'

  return (
    <Dialog open={open || hasResult} maxWidth="xs" fullWidth>
      {!hasResult ? (
        <>
          <DialogTitle sx={{ textAlign: 'center', pt: 3 }}>
            ⚠ 预武装 SOS
          </DialogTitle>
          <DialogContent>
            <Box sx={{ textAlign: 'center', mb: 2 }}>
              <Typography variant="body1" gutterBottom>
                规则「{preArmSource}」已触发预武装 SOS
              </Typography>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                {remaining} 秒后自动拨打紧急电话并发送短信
              </Typography>
            </Box>
            <LinearProgress variant="determinate" value={progress} sx={{ height: 8, borderRadius: 4 }} />
          </DialogContent>
          <DialogActions sx={{ justifyContent: 'center', pb: 2 }}>
            <Button variant="contained" color="error" onClick={cancel}>
              立即取消
            </Button>
          </DialogActions>
        </>
      ) : (
        <>
          <DialogTitle sx={{ textAlign: 'center', pt: 3 }}>
            SOS 执行结果
          </DialogTitle>
          <DialogContent>
            <Typography variant="body1" textAlign="center">
              {sosResult.finalLabel}
            </Typography>
            <Typography variant="body2" color="text.secondary" textAlign="center" sx={{ mt: 1 }}>
              {sosResult.summary}
            </Typography>
          </DialogContent>
          <DialogActions sx={{ justifyContent: 'center', pb: 2 }}>
            <Button variant="outlined" onClick={cancel}>
              关闭
            </Button>
          </DialogActions>
        </>
      )}
    </Dialog>
  )
}
