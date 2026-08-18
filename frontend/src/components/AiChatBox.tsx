import { useState, useRef, useEffect, useCallback } from 'react'
import { Stack, Box, TextField, IconButton, Typography, Dialog, DialogTitle, DialogContent, DialogActions, Button, CircularProgress, Tooltip, Chip } from '@mui/material'
import SendIcon from '@mui/icons-material/Send'
import AddIcon from '@mui/icons-material/Add'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import { AiChatMessage } from './AiChatMessage'
import { chatCompletion } from '../ai/aiService'
import { TOOL_DEFINITIONS, TOOL_PERMISSIONS, runTool } from '../ai/aiTools'
import { useAiConversationStore } from '../ai/aiConversationStore'
import { buildSystemPrompt } from '../ai/aiContext'

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
  const [initializing, setInitializing] = useState(true)
  const listRef = useRef<HTMLDivElement>(null)

  const conversations = useAiConversationStore((s) => s.conversations)
  const activeConvId = useAiConversationStore((s) => s.activeConversationId)
  const create = useAiConversationStore((s) => s.create)
  const remove = useAiConversationStore((s) => s.remove)
  const addMessage = useAiConversationStore((s) => s.addMessage)
  const setMessages = useAiConversationStore((s) => s.setMessages)
  const clearConv = useAiConversationStore((s) => s.clearMessages)
  const initialize = useAiConversationStore((s) => s.initialize)
  const loaded = useAiConversationStore((s) => s.loaded)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  const activeConv = conversations.find((c) => c.id === activeConvId)

  useEffect(() => {
    if (!loaded) {
      initialize().then(() => {
        const conv = useAiConversationStore.getState().getActiveConversation()
        if (conv && conv.messages.length <= 1) {
          const sysPrompt = buildSystemPrompt()
          setMessages([{ role: 'system', content: sysPrompt }])
        }
        setInitializing(false)
      })
    } else {
      setInitializing(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded])

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' })
  }, [activeConv?.messages])

  const handleNewConversation = useCallback(() => {
    create()
  }, [create])

  const confirmDelete = useCallback(() => {
    if (deleteConfirm) {
      remove(deleteConfirm)
      setDeleteConfirm(null)
    }
  }, [deleteConfirm, remove])

  const processConversation = useCallback(async () => {
    let rounds = 0
    const maxRounds = 10

    while (rounds < maxRounds) {
      rounds++
      const conv = useAiConversationStore.getState().getActiveConversation()
      if (!conv) return
      const msgs = conv.messages

      try {
        const response = await chatCompletion(msgs, TOOL_DEFINITIONS)
        const choice = response.choices[0]
        if (!choice) { throw new Error('AI 返回空响应') }

        addMessage({
          role: 'assistant',
          content: choice.message.content ?? null,
          tool_calls: choice.message.tool_calls,
        })

        if (!choice.message.tool_calls || choice.message.tool_calls.length === 0) {
          return
        }

        for (const tc of choice.message.tool_calls) {
          const toolName = tc.function.name
          const args = JSON.parse(tc.function.arguments || '{}')
          const perm = TOOL_PERMISSIONS[toolName]

          if (perm === 'read') {
            addMessage({ role: 'tool', tool_call_id: tc.id, name: toolName, content: JSON.stringify(await runTool(toolName, args)) })
          } else {
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
          }
        }
      } catch (err) {
        addMessage({ role: 'assistant', content: `连接 AI 服务失败: ${err instanceof Error ? err.message : '请检查配置和网络'}` })
        return
      }
    }
  }, [addMessage])

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || busy) return
    setBusy(true)
    addMessage({ role: 'user', content: text })
    await processConversation()
    setBusy(false)
  }, [busy, addMessage, processConversation])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(input)
    }
  }

  const getDisplayMessages = () => {
    return activeConv ? activeConv.messages.filter((m) => m.role !== 'system') : []
  }

  if (initializing) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress size={24} /></Box>
  }

  const displayMessages = getDisplayMessages()

  return (
    <Stack sx={{ flex: fullHeight ? '1 1 0' : '0 0 auto', height: fullHeight ? 'auto' : 400, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      {/* Header: title + buttons */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, px: 1, py: 0.5, borderBottom: 1, borderColor: 'divider' }}>
        <Chip
          label={activeConv?.title ?? '对话'}
          size="small"
          variant="outlined"
          sx={{ maxWidth: 160 }}
        />
        <Box sx={{ flex: 1 }} />
        <Tooltip title="新对话">
          <IconButton size="small" onClick={handleNewConversation} aria-label="新对话">
            <AddIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="清空当前对话">
          <IconButton size="small" onClick={() => clearConv()} aria-label="清空对话">
            <DeleteOutlineIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>

      {/* Messages */}
      <Box ref={listRef} sx={{ flex: 1, overflowY: 'auto', px: 1, py: 1 }}>
        {displayMessages.map((msg, i) => (
          <AiChatMessage
            key={i}
            role={msg.role}
            content={msg.content ?? null}
            toolName={msg.name}
            isRunning={false}
          />
        ))}
        {displayMessages.length === 0 && (
          <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
            新对话,发送消息开始
          </Typography>
        )}
        {busy && <CircularProgress size={20} sx={{ display: 'block', mx: 'auto', my: 1 }} />}
      </Box>

      {/* Input */}
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

      {/* Confirm dialog for write operations */}
      <Dialog open={confirmDialog !== null} onClose={() => confirmDialog?.resolve(false)} maxWidth="xs" fullWidth>
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
          <Button onClick={() => confirmDialog?.resolve(false)}>拒绝</Button>
          <Button variant="contained" onClick={() => confirmDialog?.resolve(true)} color={confirmDialog?.tool === 'trigger_sos' ? 'error' : 'primary'}>
            允许
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog open={deleteConfirm !== null} onClose={() => setDeleteConfirm(null)} maxWidth="xs" fullWidth>
        <DialogTitle>删除对话</DialogTitle>
        <DialogContent>
          <Typography variant="body2">确定删除此对话?对话记录将不可恢复。</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirm(null)}>取消</Button>
          <Button variant="contained" color="error" onClick={confirmDelete}>删除</Button>
        </DialogActions>
      </Dialog>
    </Stack>
  )
}