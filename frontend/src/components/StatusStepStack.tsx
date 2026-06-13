import { Stack, Typography, Box } from '@mui/material'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import ErrorIcon from '@mui/icons-material/Error'
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty'
import type { SosStep } from '../types'

interface StatusStepStackProps {
  steps: SosStep[]
}

const toneConfig = {
  idle: { color: 'text.disabled', icon: <HourglassEmptyIcon fontSize="small" sx={{ color: 'text.disabled' }} /> },
  success: { color: 'success.main', icon: <CheckCircleIcon fontSize="small" color="success" /> },
  warn: { color: 'warning.main', icon: <WarningAmberIcon fontSize="small" color="warning" /> },
  danger: { color: 'error.main', icon: <ErrorIcon fontSize="small" color="error" /> },
} as const

export function StatusStepStack({ steps }: StatusStepStackProps) {
  return (
    <Stack spacing={1.5}>
      {steps.map((step, index) => {
        const cfg = toneConfig[step.tone]
        return (
          <Box key={index} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {cfg.icon}
            <Box sx={{ flex: 1 }}>
              <Typography variant="body2">{step.label}</Typography>
              {step.detail && (
                <Typography variant="caption" color="text.secondary">{step.detail}</Typography>
              )}
            </Box>
          </Box>
        )
      })}
    </Stack>
  )
}