import Typography from '@mui/material/Typography'
import Stack from '@mui/material/Stack'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'

interface EmptyRiskGroupProps {
  message: string
}

export function EmptyRiskGroup({ message }: EmptyRiskGroupProps) {
  return (
    <Stack direction="row" alignItems="center" spacing={1} sx={{ py: 1, px: { xs: 2, sm: 3 } }}>
      <CheckCircleIcon fontSize="small" color="success" data-testid="CheckCircleIcon" />
      <Typography variant="body2" color="text.secondary">{message}</Typography>
    </Stack>
  )
}