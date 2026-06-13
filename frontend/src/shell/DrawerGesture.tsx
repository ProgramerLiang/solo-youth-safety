import { Box } from '@mui/material'
import type { ReactNode } from 'react'

interface DrawerGestureProps {
  children: ReactNode
  handlers: {
    onTouchStart: (e: React.TouchEvent) => void
    onTouchMove: (e: React.TouchEvent) => void
    onTouchEnd: (e: React.TouchEvent) => void
  }
}

export function DrawerGesture({ children, handlers }: DrawerGestureProps) {
  return (
    <Box
      sx={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column' }}
      {...handlers}
    >
      {children}
    </Box>
  )
}