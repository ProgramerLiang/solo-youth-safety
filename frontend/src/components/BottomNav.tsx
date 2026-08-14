import { useState, useCallback } from 'react'
import { BottomNavigation, BottomNavigationAction, Paper, Popover } from '@mui/material'
import HomeIcon from '@mui/icons-material/Home'
import NotificationsIcon from '@mui/icons-material/Notifications'
import ExploreIcon from '@mui/icons-material/Explore'
import StarIcon from '@mui/icons-material/Star'
import PersonIcon from '@mui/icons-material/Person'
import { MessagesPanel } from './MessagesPanel'
import { ScenesPanel } from './ScenesPanel'
import { ProfilePanel } from './ProfilePanel'
import type { PageId } from '../types'

interface BottomNavProps {
  activePageId: PageId
  onNavigate: (pageId: PageId) => void
}

type PanelType = 'messages' | 'scenes' | 'profile'

const TABS: { label: string; page: PageId; icon: React.ReactElement; panel?: PanelType }[] = [
  { label: '首页', page: 'home', icon: <HomeIcon /> },
  { label: '消息', page: 'messages', icon: <NotificationsIcon />, panel: 'messages' },
  { label: '场景', page: 'scenes', icon: <ExploreIcon />, panel: 'scenes' },
  { label: '会员', page: 'membership', icon: <StarIcon /> },
  { label: '我的', page: 'profile', icon: <PersonIcon />, panel: 'profile' },
]

export function BottomNav({ activePageId, onNavigate }: BottomNavProps) {
  const [panel, setPanel] = useState<PanelType | null>(null)
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null)

  const handleChange = useCallback((_e: unknown, idx: number) => {
    const tab = TABS[idx]
    if (!tab) return
    if (tab.panel) {
      setPanel(panel === tab.panel ? null : tab.panel)
      const btn = document.querySelector(`[data-bottom-tab="${tab.page}"]`) as HTMLElement | null
      setAnchorEl(btn)
    } else {
      setPanel(null)
      setAnchorEl(null)
      onNavigate(tab.page)
    }
  }, [panel, onNavigate])

  const handleClose = useCallback(() => {
    setPanel(null)
    setAnchorEl(null)
  }, [])

  const panelNavigate = useCallback((page: PageId) => {
    setPanel(null)
    setAnchorEl(null)
    onNavigate(page)
  }, [onNavigate])

  const tabIdx = TABS.findIndex((t) => t.page === activePageId)

  return (
    <>
      <Paper sx={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 1100 }} elevation={3}>
        <BottomNavigation
          value={tabIdx >= 0 ? tabIdx : false}
          onChange={handleChange}
          showLabels
        >
          {TABS.map((tab) => (
            <BottomNavigationAction
              key={tab.page}
              label={tab.label}
              icon={tab.icon}
              data-bottom-tab={tab.page}
              aria-label={tab.label}
            />
          ))}
        </BottomNavigation>
      </Paper>

      <Popover
        open={panel !== null}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        transformOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        slotProps={{ paper: { sx: { borderRadius: 2 } } }}
      >
        {panel === 'messages' && <MessagesPanel onNavigate={panelNavigate} onClose={handleClose} />}
        {panel === 'scenes' && <ScenesPanel onNavigate={panelNavigate} onClose={handleClose} />}
        {panel === 'profile' && <ProfilePanel onNavigate={panelNavigate} onClose={handleClose} />}
      </Popover>
    </>
  )
}