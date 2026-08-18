import { Stack, Typography, Box } from '@mui/material'
import { AiChatBox } from '../components/AiChatBox'
import { useAiConfigStore } from '../ai/aiConfigStore'

export function AiPage() {
  const aiConfig = useAiConfigStore((s) => s.config)

  return (
    <Stack spacing={0} sx={{ height: 'calc(100dvh - 140px)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <Box sx={{ px: 1, pt: 1, pb: 0.5 }}>
        <Typography variant="h5">AI 陪伴助手</Typography>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
          {aiConfig.enabled && aiConfig.baseUrl ? '已配置 API,可以开始对话' : '未配置 API,请在「我的」面板设置 AI 助手'}
        </Typography>
      </Box>
      <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        <AiChatBox fullHeight />
      </Box>
    </Stack>
  )
}