import { useState, useRef, useEffect, useCallback } from 'react'
import { Stack, Box, TextField, IconButton, Typography, Dialog, DialogTitle, DialogContent, DialogActions, Button, CircularProgress, Tooltip, Chip } from '@mui/material'
import SendIcon from '@mui/icons-material/Send'
import StopIcon from '@mui/icons-material/Stop'
import RefreshIcon from '@mui/icons-material/Refresh'
import AddIcon from '@mui/icons-material/Add'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import { AiChatMessage } from './AiChatMessage'
import { useAiConversationStore } from '../ai/aiConversationStore'
import { buildSystemPrompt } from '../ai/aiContext'
import { useAiStream } from '../hooks/useAiStream'

interface AiChatBoxProps {
  fullHeight?: boolean
}

export function AiChatBox({ fullHeight }: AiChatBoxProps) {
  const [input, setInput] = useState('')
  const [initializing, setInitializing] = useState(true)
  const listRef = useRef<HTMLDivElement>(null)

  const conversations = useAiConversationStore((s) => s.conversations)
  const activeConvId = useAiConversationStore((s) => s.activeConversationId)
  const create = useAiConversationStore((s) => s.create)
  const remove = useAiConversationStore((s) => s.remove)
  const setMessages = useAiConversationStore((s) => s.setMessages)
  const clearConv = useAiConversationStore((s) => s.clearMessages)
  const initialize = useAiConversationStore((s) => s.initialize)
  const loaded = useAiConversationStore((s) => s.loaded)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  const {
    streamingContent,
    isStreaming,
    error,
    abort,
    retry,
    sendMessage: streamSend,
    pendingToolConfirm,
    confirmTool,
  } = useAiStream()

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
  }, [activeConv?.messages, streamingContent])

  const handleNewConversation = useCallback(() => {
    abort()
    create()
  }, [abort, create])

  const confirmDelete = useCallback(() => {
    if (deleteConfirm) {
      remove(deleteConfirm)
      setDeleteConfirm(null)
    }
  }, [deleteConfirm, remove])

  const handleSend = useCallback(() => {
    if (!input.trim() || isStreaming) return
    const text = input
    setInput('')
    streamSend(text)
  }, [input, isStreaming, streamSend])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleRetry = useCallback(() => {
    retry()
  }, [retry])

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

        {/* 流式消息 */}
        {isStreaming && streamingContent && (
          <AiChatMessage
            role="assistant"
            content={streamingContent}
            isRunning={true}
          />
        )}

        {/* 流式等待占位 */}
        {isStreaming && !streamingContent && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 1, px: 1 }}>
            <CircularProgress size={16} />
            <Typography variant="caption" color="text.secondary">
              思考中...
            </Typography>
          </Box>
        )}

        {/* 错误提示 */}
        {error && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 1, px: 1, bgcolor: 'error.light', borderRadius: 1, mx: 1, my: 1 }}>
            <Typography variant="body2" color="error.contrastText" sx={{ flex: 1 }}>
              {error}
            </Typography>
            <Button
              size="small"
              variant="outlined"
              color="inherit"
              onClick={handleRetry}
              startIcon={<RefreshIcon />}
            >
              重试
            </Button>
          </Box>
        )}

        {displayMessages.length === 0 && !isStreaming && !error && (
          <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
            新对话，发送消息开始
          </Typography>
        )}
      </Box>

      {/* Input */}
      <Box sx={{ display: 'flex', gap: 1, p: 1, borderTop: 1, borderColor: 'divider' }}>
        <TextField
          size="small"
          fullWidth
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isStreaming}
          placeholder="输入消息..."
          slotProps={{ htmlInput: { 'aria-label': '消息输入' } }}
          sx={{ flex: 1 }}
        />
        {isStreaming ? (
          <IconButton color="error" onClick={abort} aria-label="停止">
            <StopIcon />
          </IconButton>
        ) : (
          <IconButton
            color="primary"
            onClick={handleSend}
            disabled={!input.trim()}
            aria-label="发送"
          >
            <SendIcon />
          </IconButton>
        )}
      </Box>

      {/* Confirm dialog for write operations */}
      <Dialog
        open={pendingToolConfirm !== null}
        onClose={() => confirmTool(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>确认操作</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            {pendingToolConfirm?.tool === 'trigger_sos'
              ? 'AI 请求触发 SOS!此操作将拨打电话并发送短信。确定要触发吗?'
              : `AI 请求执行以下操作: ${pendingToolConfirm?.tool}。`}
          </Typography>
          {pendingToolConfirm?.args && Object.keys(pendingToolConfirm.args).length > 0 && (
            <Box
              component="pre"
              sx={{ mt: 1, p: 1, bgcolor: 'grey.100', borderRadius: 1, fontSize: 'caption.fontSize' }}
            >
              {JSON.stringify(pendingToolConfirm.args, null, 2)}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => confirmTool(false)}>拒绝</Button>
          <Button
            variant="contained"
            onClick={() => confirmTool(true)}
            color={pendingToolConfirm?.tool === 'trigger_sos' ? 'error' : 'primary'}
          >
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