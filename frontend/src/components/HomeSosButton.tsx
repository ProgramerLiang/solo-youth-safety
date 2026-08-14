import { useCallback } from 'react'
import { Box, Button, Typography, Chip, Stack } from '@mui/material'
import { useSosStore } from '../stores/useSosStore'
import { useConfigStore } from '../stores/useConfigStore'
import { useTrackingStore } from '../stores/useTrackingStore'
import { useIdentityStore } from '../stores/useIdentityStore'
import { useSosCountdown } from '../hooks/useSosCountdown'
import { useLocationFreshness } from '../hooks/useLocationFreshness'
import { getSosLocation } from '../data/sosLocation'
import { zhCN } from '../i18n/zh-CN'
import type { PageId } from '../types'

interface HomeSosButtonProps {
  onNavigate: (pageId: PageId) => void
}

export function HomeSosButton({ onNavigate }: HomeSosButtonProps) {
  const arm = useSosStore((s) => s.arm)
  const cancel = useSosStore((s) => s.cancel)
  const triggerNow = useSosStore((s) => s.triggerNow)
  const reportLocationFailure = useSosStore((s) => s.reportLocationFailure)

  const callNumber = useConfigStore((s) => s.callNumber)
  const smsNumber = useConfigStore((s) => s.smsNumber)
  const smsTemplate = useConfigStore((s) => s.smsTemplate)
  const userId = useIdentityStore((s) => s.userId)
  const deviceId = useIdentityStore((s) => s.deviceId)
  const lastCapturedAt = useTrackingStore((s) => s.lastCapturedAt)
  const freshness = useLocationFreshness(lastCapturedAt ? new Date(lastCapturedAt).getTime() : null)

  const onElapsed = useCallback(async () => {
    const now = new Date()
    const pad = (n: number) => String(n).padStart(2, '0')
    const timeStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`
    const pos = await getSosLocation()
    if (!pos) {
      await reportLocationFailure('无法获取当前位置,未发送短信或拨打电话')
      return
    }
    await triggerNow({ lat: pos.lat, lng: pos.lng, accuracy: pos.accuracy, userId, deviceId, callNumber, smsNumber, smsTemplate, time: timeStr })
  }, [userId, deviceId, callNumber, smsNumber, smsTemplate, triggerNow, reportLocationFailure])

  const countdown = useSosCountdown(onElapsed)

  const handleTap = () => {
    if (countdown.active) {
      countdown.cancel()
      cancel()
    } else {
      arm()
      countdown.start()
    }
  }

  const missingConfig = !callNumber || !smsNumber

  return (
    <Stack alignItems="center" spacing={1.5} sx={{ py: 2 }}>
      <Box
        component="button"
        onClick={handleTap}
        aria-label={countdown.active ? zhCN.sos.cancelCountdown : zhCN.sos.trigger}
        sx={{
          width: 176,
          height: 176,
          borderRadius: '50%',
          border: 'none',
          cursor: 'pointer',
          background: 'radial-gradient(circle at 30% 30%, #ff6b6b, #c62828)',
          color: 'common.white',
          boxShadow: 6,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 1,
          '&:active': { transform: 'scale(0.96)' },
        }}
      >
        <Typography variant="h5" sx={{ fontWeight: 700 }}>
          {countdown.active ? `${countdown.remaining}s` : 'SOS'}
        </Typography>
        <Typography variant="caption">
          {countdown.active ? zhCN.sos.cancelCountdown : zhCN.sos.trigger}
        </Typography>
      </Box>

      <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" justifyContent="center">
        <Chip size="small" label={`电话 ${callNumber ? '✓' : '✗'}`} color={callNumber ? 'success' : 'warning'} variant="outlined" />
        <Chip size="small" label={`短信 ${smsNumber ? '✓' : '✗'}`} color={smsNumber ? 'success' : 'warning'} variant="outlined" />
        <Chip size="small" label={`位置 ${freshness.level === 'fresh' ? '新鲜' : freshness.level === 'stale' ? '过期' : '未知'}`} color={freshness.tone} variant="outlined" />
      </Stack>

      {missingConfig && (
        <Button size="small" color="warning" variant="contained" onClick={() => onNavigate('config')} aria-label="一键前往配置">
          未配置紧急号码,一键前往配置
        </Button>
      )}
    </Stack>
  )
}