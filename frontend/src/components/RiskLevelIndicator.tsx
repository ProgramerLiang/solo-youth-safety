import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import type { RiskLevel } from '../domain/riskAssessment'

interface RiskLevelIndicatorProps {
  level: RiskLevel
}

const config: Record<RiskLevel, { label: string; detail: string; bgColor: string }> = {
  ok: { label: '安全', detail: '所有检查正常', bgColor: 'success.main' },
  attention: { label: '注意', detail: '存在一些需要注意的项目', bgColor: 'warning.main' },
  warning: { label: '警告', detail: '存在需要立即关注的风险', bgColor: 'error.main' },
}

export function RiskLevelIndicator({ level }: RiskLevelIndicatorProps) {
  const c = config[level]
  return (
    <Box
      data-level={level}
      sx={{
        bgcolor: c.bgColor,
        color: '#fff',
        borderRadius: 2,
        px: { xs: 2, sm: 3 },
        py: { xs: 1.5, sm: 2 },
        mb: 2,
        display: 'flex',
        alignItems: 'center',
        gap: 1,
      }}
    >
      <Typography variant="h6" component="span" fontWeight="bold">
        {c.label}
      </Typography>
      <Typography variant="body2" component="span" sx={{ opacity: 0.95 }}>
        {c.detail}
      </Typography>
    </Box>
  )
}