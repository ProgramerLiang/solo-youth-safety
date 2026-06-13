import { Stack, Typography } from '@mui/material'

interface EmptyStateProps {
  message: string
  icon?: React.ReactNode
}

export function EmptyState({ message, icon }: EmptyStateProps) {
  return (
    <Stack alignItems="center" justifyContent="center" sx={{ py: 8, color: 'text.secondary' }}>
      {icon}
      <Typography variant="body1" color="text.secondary">
        {message}
      </Typography>
    </Stack>
  )
}