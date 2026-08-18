import { useState, useCallback, useRef } from 'react'
import { Box, Paper, Slide, useMediaQuery, useTheme } from '@mui/material'
import { keyframes } from '@emotion/react'
import HomeIcon from '@mui/icons-material/Home'
import NotificationsIcon from '@mui/icons-material/Notifications'
import ExploreIcon from '@mui/icons-material/Explore'
import SmartToyIcon from '@mui/icons-material/SmartToy'
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

interface TabDef {
  label: string
  page: PageId
  icon: React.ReactElement
  panel?: PanelType
}

const TABS: TabDef[] = [
  { label: '首页', page: 'home', icon: <HomeIcon /> },
  { label: '消息', page: 'messages', icon: <NotificationsIcon />, panel: 'messages' },
  { label: '场景', page: 'scenes', icon: <ExploreIcon />, panel: 'scenes' },
  { label: 'AI', page: 'ai', icon: <SmartToyIcon /> },
  { label: '会员', page: 'membership', icon: <StarIcon /> },
  { label: '我的', page: 'profile', icon: <PersonIcon />, panel: 'profile' },
]

/* ── animations ── */
const bounceIn = keyframes`
  0%   { transform: scale(0.8); }
  50%  { transform: scale(1.15); }
  100% { transform: scale(1); }
`

const pulse = keyframes`
  0%, 100% { box-shadow: 0 0 0 0 rgba(var(--active-color), 0.3); }
  50% { box-shadow: 0 0 0 6px rgba(var(--active-color), 0); }
`

/* custom BottomNavigationAction with icon animation */
function NavAction({
  tab,
  isActive,
  onClick,
}: {
  tab: TabDef
  isActive: boolean
  onClick: () => void
}) {
  const [pressed, setPressed] = useState(false)

  const handleClick = () => {
    setPressed(true)
    setTimeout(() => setPressed(false), 300)
    onClick()
  }

  return (
    <Box
      component="button"
      onClick={handleClick}
      aria-label={tab.label}
      sx={[
        {
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 0.25,
          flex: '0 0 auto',
          minWidth: 64,
          px: 1.5,
          py: 0.5,
          border: 'none',
          background: 'transparent',
          color: isActive ? 'primary.main' : 'text.secondary',
          cursor: 'pointer',
          position: 'relative',
          outline: 'none',
          WebkitTapHighlightColor: 'transparent',
          transition: 'color 0.2s ease',
          fontFamily: 'inherit',
          fontSize: '0.75rem',
          lineHeight: 1,
          '&:hover': { color: 'primary.light' },
          '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: 2 },
        },
        pressed && {
          '& .nav-icon': {
            animation: `${bounceIn} 0.3s ease`,
          },
        },
        isActive && {
          '&::after': {
            content: '""',
            position: 'absolute',
            top: 4,
            width: 4,
            height: 4,
            borderRadius: '50%',
            bgcolor: 'primary.main',
            animation: `${pulse} 1.5s ease-in-out infinite`,
            '--active-color': 'primary.mainChannel',
          } as Record<string, unknown>,
        },
      ]}
    >
      <Box
        className="nav-icon"
        sx={{
          display: 'flex',
          transition: 'transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
          transform: isActive ? 'scale(1.15)' : 'scale(1)',
          '& > svg': { fontSize: '1.5rem' },
        }}
      >
        {tab.icon}
      </Box>
      <Box sx={{ fontWeight: isActive ? 600 : 400 }}>{tab.label}</Box>
    </Box>
  )
}

export function BottomNav({ activePageId, onNavigate }: BottomNavProps) {
  const [panel, setPanel] = useState<PanelType | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const theme = useTheme()
  const isSmallScreen = useMediaQuery(theme.breakpoints.down('sm'))

  const handleTab = useCallback(
    (tab: TabDef) => {
      if (tab.panel) {
        // toggle panel on re-click
        setPanel(panel === tab.panel ? null : tab.panel)
      } else {
        setPanel(null)
        onNavigate(tab.page)
      }
    },
    [panel, onNavigate],
  )

  const handleClose = useCallback(() => {
    setPanel(null)
  }, [])

  const panelNavigate = useCallback(
    (page: PageId) => {
      setPanel(null)
      onNavigate(page)
    },
    [onNavigate],
  )

  // active index for highlighting
  const activeIdx = TABS.findIndex((t) => t.page === activePageId)

  return (
    <>
      <Paper
        sx={(theme) => ({
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 1100,
          overflow: 'hidden',
          borderTop: `1px solid ${theme.palette.divider}`,
        })}
        elevation={3}
        square
      >
        <Box
          ref={scrollRef}
          sx={{
            display: 'flex',
            overflowX: 'auto',
            overflowY: 'hidden',
            scrollBehavior: 'smooth',
            WebkitOverflowScrolling: 'touch',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
            '&::-webkit-scrollbar': { display: 'none' },
            justifyContent: isSmallScreen ? 'flex-start' : 'center',
            px: isSmallScreen ? 0.5 : 0,
          }}
        >
          {TABS.map((tab, i) => (
            <Box
              key={tab.page}
              data-bottom-tab={tab.page}
              sx={{ flex: isSmallScreen ? '0 0 auto' : 1 }}
            >
              <NavAction
                tab={tab}
                isActive={i === activeIdx}
                onClick={() => handleTab(tab)}
              />
            </Box>
          ))}
        </Box>
      </Paper>

      {/* slide-up panel */}
      <Slide direction="up" in={panel !== null} mountOnEnter unmountOnExit>
        <Paper
          sx={{
            position: 'fixed',
            bottom: 56, // nav height
            left: 0,
            right: 0,
            zIndex: 1099,
            borderTopLeftRadius: 16,
            borderTopRightRadius: 16,
            maxHeight: '60dvh',
            overflowY: 'auto',
          }}
          elevation={6}
        >
          {panel === 'messages' && <MessagesPanel onNavigate={panelNavigate} onClose={handleClose} />}
          {panel === 'scenes' && <ScenesPanel onNavigate={panelNavigate} onClose={handleClose} />}
          {panel === 'profile' && <ProfilePanel onNavigate={panelNavigate} onClose={handleClose} />}
        </Paper>
      </Slide>
    </>
  )
}