import { Card, CardActionArea, CardContent, Typography, Button, Box } from '@mui/material'
import SmartToyIcon from '@mui/icons-material/SmartToy'
import { useHomeStore } from '../stores/useHomeStore'
import { useDevModeStore } from '../stores/useDevModeStore'
import { useAiConfigStore } from '../ai/aiConfigStore'
import type { PageId } from '../types'

interface AiCompanionPlaceholderProps {
  onNavigate?: (pageId: PageId) => void
}

export function AiCompanionPlaceholder({ onNavigate }: AiCompanionPlaceholderProps) {
  const companionEnabled = useHomeStore((s) => s.companionEnabled)
  const setCompanionEnabled = useHomeStore((s) => s.setCompanionEnabled)
  const devEnabled = useDevModeStore((s) => s.enabled)
  const aiEnabled = useAiConfigStore((s) => s.config.enabled)

  // debug 模式 + AI 助手启用 → 可点击入口卡,点击跳转独立 AI 页
  if (devEnabled && aiEnabled) {
    return (
      <Card variant="outlined" sx={{ borderRadius: 3 }}>
        <CardActionArea onClick={() => onNavigate?.('ai')} aria-label="AI 陪伴助手">
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <SmartToyIcon color="primary" />
              <Box>
                <Typography variant="subtitle2">AI 陪伴助手</Typography>
                <Typography variant="body2" color="text.secondary">点击进入对话 · 已配置 API</Typography>
              </Box>
            </Box>
          </CardContent>
        </CardActionArea>
      </Card>
    )
  }

  // 原有占位(含 release 包)
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