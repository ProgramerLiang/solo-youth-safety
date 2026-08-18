import { Stack, Typography, TextField, Switch, FormControlLabel, Button, Divider, Box } from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import { useAiConfigStore } from '../ai/aiConfigStore'
import type { PageId } from '../types'

interface AiConfigPageProps {
  onNavigate: (pageId: PageId) => void
}

export function AiConfigPage({ onNavigate }: AiConfigPageProps) {
  const config = useAiConfigStore((s) => s.config)
  const setAiConfig = useAiConfigStore((s) => s.setConfig)
  const toggleAi = useAiConfigStore((s) => s.toggle)

  return (
    <Stack spacing={2} sx={{ p: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Button size="small" startIcon={<ArrowBackIcon />} onClick={() => onNavigate('profile')} aria-label="返回">
          返回
        </Button>
        <Typography variant="h6">AI 助手设置</Typography>
      </Box>

      <Divider />

      <FormControlLabel
        control={<Switch checked={config.enabled} onChange={() => toggleAi()} />}
        label="启用 AI 助手"
      />

      <TextField
        size="small"
        label="API 地址"
        value={config.baseUrl}
        onChange={(e) => setAiConfig({ baseUrl: e.target.value })}
        placeholder="https://api.openai.com/v1"
        fullWidth
      />

      <TextField
        size="small"
        label="API Key"
        type="password"
        value={config.key}
        onChange={(e) => setAiConfig({ key: e.target.value })}
        placeholder="sk-..."
        fullWidth
      />

      <TextField
        size="small"
        label="模型"
        value={config.model}
        onChange={(e) => setAiConfig({ model: e.target.value })}
        placeholder="gpt-4o-mini"
        fullWidth
      />

      <Typography variant="caption" color="text.secondary">
        AI 陪伴助手默认使用 gpt 系列模型提供的对话能力。请自行填入可用的 API 地址和 Key。
        AI 功能仅在调试模式下可用。
      </Typography>
    </Stack>
  )
}