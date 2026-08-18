import { Box, Typography, Chip, CircularProgress } from '@mui/material'

interface AiChatMessageProps {
  role: 'user' | 'assistant' | 'system' | 'tool'
  content?: string | null
  toolName?: string
  toolCallId?: string
  isRunning?: boolean
}

const toolNames: Record<string, string> = {
  get_location: '正在获取位置...',
  get_sos_history: '正在查询 SOS 记录...',
  get_tracking_status: '正在查询轨迹状态...',
  get_contacts: '正在查询联系人...',
  get_geofence_zones: '正在查询围栏...',
  get_safety_trip: '正在查询安全行程...',
  get_rules: '正在查询规则...',
  get_risk_summary: '正在分析风险...',
  create_safety_trip: '正在创建安全行程...',
  add_contact: '正在添加联系人...',
  enable_tracking: '正在开启轨迹...',
  trigger_sos: '正在触发 SOS...',
}

export function AiChatMessage({ role, content, toolName, isRunning }: AiChatMessageProps) {
  if (role === 'tool') {
    if (isRunning) {
      return (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.5, px: 1 }}>
          <CircularProgress size={14} />
          <Typography variant="caption" color="text.secondary">
            {toolName ? toolNames[toolName] || `正在执行 ${toolName}...` : '执行中...'}
          </Typography>
        </Box>
      )
    }
    return (
      <Box sx={{ py: 0.5, px: 1 }}>
        <Chip
          label={content ? '✅ 执行成功' : '❌ 执行失败'}
          size="small"
          color={content ? 'success' : 'error'}
          variant="outlined"
          sx={{ mb: 0.5 }}
        />
        {content && (
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
            {content.length > 200 ? content.slice(0, 200) + '...' : content}
          </Typography>
        )}
      </Box>
    )
  }

  const isUser = role === 'user'
  return (
    <Box sx={{ display: 'flex', justifyContent: isUser ? 'flex-end' : 'flex-start', mb: 1 }}>
      <Box
        sx={{
          maxWidth: '80%',
          px: 2,
          py: 1,
          borderRadius: 2,
          bgcolor: isUser ? 'primary.main' : 'grey.100',
          color: isUser ? 'primary.contrastText' : 'text.primary',
        }}
      >
        {!isUser && <Typography variant="caption" sx={{ fontWeight: 600, display: 'block', mb: 0.5 }}>🤖 安全助手</Typography>}
        <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
          {content || ''}
        </Typography>
      </Box>
    </Box>
  )
}