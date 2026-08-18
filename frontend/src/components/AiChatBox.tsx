import { useState, useRef, useEffect, useCallback } from 'react'
import { Stack, Box, TextField, IconButton, Typography, Dialog, DialogTitle, DialogContent, DialogActions, Button, CircularProgress } from '@mui/material'
import SendIcon from '@mui/icons-material/Send'
import { AiChatMessage } from './AiChatMessage'
import { chatCompletion } from '../ai/aiService'
import { TOOL_DEFINITIONS, TOOL_PERMISSIONS, runTool } from '../ai/aiTools'
import { addMessage, getMessages, initializeMemory, type AiMessage } from '../ai/aiMemory'
import { buildSystemPrompt } from '../ai/aiContext'
import { useAiConfigStore } from '../ai/aiConfigStore'

interface AiChatBoxProps {
  fullHeight?: boolean
}

export function AiChatBox({ fullHeight }: AiChatBoxProps) {
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [confirmDialog, setConfirmDialog] = useState<{
    tool: string
    args: Record<string, unknown>
    resolve: (ok: boolean) => void
  } | null>(null)
  const [messages, setMessages] = useState<AiMessage[]>([])
  const listRef = useRef<HTMLDivElement>(null)
  const aiConfig = useAiConfigStore((s) => s.config)
  const initialized = useRef(false)

  useEffect(() => {
    if (!initialized.current) {
      initialized.current = true
      initializeMemory(buildSystemPrompt()).then(() => {
        const saved = getMessages()
        setMessages(saved)
        if (saved.length === 1) {
          addMessage({ role: 'assistant', content: '你好!我是你的安全助手。我可以帮你查看位置、联系人、行程信息,也可以帮你创建行程、添加联系人。需要我做什么?' })
          setMessages([...getMessages()])
        }
      })
    }
  }, [])

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages])

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || busy) return
    setBusy(true)
    addMessage({ role: 'user', content: text })
    setMessages([...getMessages()])

    await processConversation()

    setInput('')
    setBusy(false)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busy])

  const processConversation = async () => {
    let rounds = 0
    const maxRounds = 10

    while (rounds < maxRounds) {
      rounds++
      const msgs = getMessages()

      try {
        const response = await chatCompletion(msgs, TOOL_DEFINITIONS)
        const choice = response.choices[0]
        if (!choice) { throw new Error('AI 返回空响应') }

        addMessage({
          role: 'assistant',
          content: choice.message.content ?? null,
          tool_calls: choice.message.tool_calls,
        })
        setMessages([...getMessages()])

        if (!choice.message.tool_calls || choice.message.tool_calls.length === 0) {
          return // AI 直接回复,结束
        }

        // 处理每个 tool_call
        for (const tc of choice.message.tool_calls) {
          const toolName = tc.function.name
          const args = JSON.parse(tc.function.arguments || '{}')
          const perm = TOOL_PERMISSIONS[toolName]

          if (perm === 'read') {
            // 只读:自动执行
            addMessage({ role: 'tool', tool_call_id: tc.id, name: toolName, content: JSON.stringify(await runTool(toolName, args)) })
            setMessages([...getMessages()])
          } else {
            // 写入:需要确认
            const ok = await new Promise<boolean>((resolve) => {
              setConfirmDialog({ tool: toolName, args, resolve })
            })
            if (ok) {
              const result = await runTool(toolName, args)
              addMessage({ role: 'tool', tool_call_id: tc.id, name: toolName, content: JSON.stringify(result) })
            } else {
              addMessage({ role: 'tool', tool_call_id: tc.id, name: toolName, content: JSON.stringify({ error: '用户拒绝了操作' }) })
            }
            setConfirmDialog(null)
            setMessages([...getMessages()])
          }
        }
      } catch (err) {
        addMessage({ role: 'assistant', content: `连接 AI 服务失败: ${err instanceof Error ? err.message : '请检查配置和网络'}` })
        setMessages([...getMessages()])
        return
      }
    }
  }

  const handleConfirm = async (ok: boolean) => {
    if (confirmDialog) {
      confirmDialog.resolve(ok)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(input)
    }
  }

  if (!aiConfig.baseUrl || !aiConfig.key) {
    return (
      <Box sx={{ textAlign: 'center', py: 4 }}>
        <Typography variant="body2" color="text.secondary">未配置 API,请在「我的」面板设置 AI 助手。</Typography>
      </Box>
    )
  }

  return (
    <Stack sx={{ height: fullHeight ? '100%' : 400, display: 'flex', flexDirection: 'column' }}>
      <Box ref={listRef} sx={{ flex: 1, overflowY: 'auto', px: 1, py: 1 }}>
        {messages.slice(1).map((msg, i) => (
          <AiChatMessage
            key={i}
            role={msg.role}
            content={msg.content || null}
            toolName={msg.name}
            isRunning={false}
          />
        ))}
        {busy && <CircularProgress size={20} sx={{ display: 'block', mx: 'auto', my: 1 }} />}
      </Box>

      <Box sx={{ display: 'flex', gap: 1, p: 1, borderTop: 1, borderColor: 'divider' }}>
        <TextField
          size="small"
          fullWidth
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={busy}
          placeholder="输入消息..."
          slotProps={{ htmlInput: { 'aria-label': '消息输入' } }}
          sx={{ flex: 1 }}
        />
        <IconButton
          color="primary"
          onClick={() => sendMessage(input)}
          disabled={busy || !input.trim()}
          aria-label="发送"
        >
          <SendIcon />
        </IconButton>
      </Box>

      <Dialog open={confirmDialog !== null} onClose={() => handleConfirm(false)} maxWidth="xs" fullWidth>
        <DialogTitle>确认操作</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            {confirmDialog?.tool === 'trigger_sos'
              ? 'AI 请求触发 SOS!此操作将拨打电话并发送短信。确定要触发吗?'
              : `AI 请求执行以下操作: ${confirmDialog?.tool}。`}
          </Typography>
          {confirmDialog?.args && Object.keys(confirmDialog.args).length > 0 && (
            <Box component="pre" sx={{ mt: 1, p: 1, bgcolor: 'grey.100', borderRadius: 1, fontSize: 'caption.fontSize' }}>
              {JSON.stringify(confirmDialog.args, null, 2)}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => handleConfirm(false)}>拒绝</Button>
          <Button variant="contained" onClick={() => handleConfirm(true)} color={confirmDialog?.tool === 'trigger_sos' ? 'error' : 'primary'}>
            允许
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  )
}