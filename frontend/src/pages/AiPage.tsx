import { useState } from 'react'
import { Stack, Typography, Box, Drawer, List, ListItem, ListItemButton, ListItemText, IconButton, TextField, Tooltip, Divider } from '@mui/material'
import ListIcon from '@mui/icons-material/List'
import AddIcon from '@mui/icons-material/Add'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import SettingsIcon from '@mui/icons-material/Settings'
import { AiChatBox } from '../components/AiChatBox'
import { useAiConfigStore } from '../ai/aiConfigStore'
import { useAiConversationStore } from '../ai/aiConversationStore'
import type { PageId } from '../types'

interface AiPageProps {
  onNavigate: (pageId: PageId) => void
}

export function AiPage({ onNavigate }: AiPageProps) {
  const aiConfig = useAiConfigStore((s) => s.config)
  const conversations = useAiConversationStore((s) => s.conversations)
  const activeConvId = useAiConversationStore((s) => s.activeConversationId)
  const setActive = useAiConversationStore((s) => s.setActive)
  const create = useAiConversationStore((s) => s.create)
  const remove = useAiConversationStore((s) => s.remove)
  const rename = useAiConversationStore((s) => s.rename)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameText, setRenameText] = useState('')

  const handleSelect = (id: string) => {
    setActive(id)
    setDrawerOpen(false)
  }

  const handleNew = () => {
    create()
    setDrawerOpen(false)
  }

  const handleRenameStart = (id: string, title: string) => {
    setRenamingId(id)
    setRenameText(title)
  }

  const handleRenameSubmit = () => {
    if (renamingId && renameText.trim()) {
      rename(renamingId, renameText.trim())
    }
    setRenamingId(null)
    setRenameText('')
  }

  const activeTitle = conversations.find((c) => c.id === activeConvId)?.title ?? '对话'

  return (
    <Stack spacing={0} sx={{ height: 'calc(100dvh - 140px)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, px: 1, pt: 1, pb: 0.5 }}>
        <Typography variant="h6" sx={{ flex: 1 }}>AI 陪伴助手</Typography>
        <Tooltip title="对话列表">
          <IconButton size="small" onClick={() => setDrawerOpen(true)} aria-label="对话列表">
            <ListIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="设置">
          <IconButton size="small" onClick={() => onNavigate('ai-config')} aria-label="AI 设置">
            <SettingsIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>
      <Typography variant="caption" color="text.secondary" sx={{ px: 1, pb: 0.5 }}>
        {aiConfig.enabled && aiConfig.baseUrl ? `当前: ${activeTitle}` : '未配置 API,请在「AI 设置」中配置'}
      </Typography>

      {/* chat */}
      <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        <AiChatBox fullHeight />
      </Box>

      {/* conversation list drawer */}
      <Drawer
        anchor="left"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        slotProps={{ paper: { sx: { width: 280, p: 1 } } }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <Typography variant="subtitle1" sx={{ flex: 1 }}>对话列表</Typography>
          <IconButton size="small" onClick={handleNew} aria-label="新建对话">
            <AddIcon fontSize="small" />
          </IconButton>
        </Box>
        <Divider />

        <List dense sx={{ flex: 1, overflow: 'auto' }}>
          {conversations.map((conv) => (
            <ListItem
              key={conv.id}
              disablePadding
              secondaryAction={
                <IconButton
                  edge="end"
                  size="small"
                  onClick={() => remove(conv.id)}
                  aria-label={`删除 ${conv.title}`}
                >
                  <DeleteOutlineIcon fontSize="small" />
                </IconButton>
              }
            >
              {renamingId === conv.id ? (
                <TextField
                  size="small"
                  value={renameText}
                  onChange={(e) => setRenameText(e.target.value)}
                  onBlur={handleRenameSubmit}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleRenameSubmit() }}
                  autoFocus
                  fullWidth
                  slotProps={{ htmlInput: { style: { fontSize: '0.875rem' } } }}
                />
              ) : (
                <ListItemButton
                  selected={conv.id === activeConvId}
                  onClick={() => handleSelect(conv.id)}
                  onDoubleClick={() => handleRenameStart(conv.id, conv.title)}
                >
                  <ListItemText
                    primary={conv.title}
                    primaryTypographyProps={{
                      variant: 'body2',
                      noWrap: true,
                      fontWeight: conv.id === activeConvId ? 600 : 400,
                    }}
                  />
                </ListItemButton>
              )}
            </ListItem>
          ))}
        </List>
      </Drawer>
    </Stack>
  )
}