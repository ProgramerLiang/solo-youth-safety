import { Stack, Typography } from '@mui/material'
import { AiChatBox } from '../components/AiChatBox'
import { useAiConfigStore } from '../ai/aiConfigStore'

export function AiPage() {
  const aiConfig = useAiConfigStore((s) => s.config)

  return (
    <Stack spacing={2} sx={{ height: 'calc(100dvh - 140px)', display: 'flex', flexDirection: 'column' }}>
      <Typography variant="h5">AI 陪伴助手</Typography>
      <Typography variant="caption" color="text.secondary">
        {aiConfig.enabled && aiConfig.baseUrl ? '已配置 API,可以开始对话' : '未配置 API,请在「我的」面板设置 AI 助手'}
      </Typography>
      <AiChatBox fullHeight />
    </Stack>
  )
}