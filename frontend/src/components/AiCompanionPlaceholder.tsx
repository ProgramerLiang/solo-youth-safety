import { Card, CardContent, Typography, Button, Box } from '@mui/material'
import SmartToyIcon from '@mui/icons-material/SmartToy'
import { useHomeStore } from '../stores/useHomeStore'

export function AiCompanionPlaceholder() {
  const companionEnabled = useHomeStore((s) => s.companionEnabled)
  const setCompanionEnabled = useHomeStore((s) => s.setCompanionEnabled)

  return (
    <Card variant="outlined" sx={{ borderRadius: 3 }}>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <SmartToyIcon color="disabled" />
          <Typography variant="subtitle2">AI 陪伴助手</Typography>
        </Box>
        {companionEnabled ? (
          <Box>
            <Typography variant="body2" color="text.secondary">
              即将上线,敬请期待。陪伴助手将在后续版本提供本地情绪陪伴与安全提醒。
            </Typography>
          </Box>
        ) : (
          <Typography variant="body2" color="text.secondary">已禁用,可在「我的」重新启用。</Typography>
        )}
        <Button
          size="small"
          color="inherit"
          onClick={() => setCompanionEnabled(!companionEnabled)}
          aria-label="禁用陪伴占位"
          sx={{ mt: 1 }}
        >
          {companionEnabled ? '禁用陪伴占位' : '启用陪伴占位'}
        </Button>
      </CardContent>
    </Card>
  )
}