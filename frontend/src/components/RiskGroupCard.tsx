import { useState } from 'react'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import Collapse from '@mui/material/Collapse'
import IconButton from '@mui/material/IconButton'
import Chip from '@mui/material/Chip'
import ExpandMore from '@mui/icons-material/ExpandMore'
import ExpandLess from '@mui/icons-material/ExpandLess'
import type { RiskItem } from '../domain/riskAssessment'

interface RiskGroupCardProps {
  title: string
  icon: string
  items: RiskItem[]
}

export function RiskGroupCard({ title, icon, items }: RiskGroupCardProps) {
  const [open, setOpen] = useState(true)

  return (
    <Paper sx={{ px: { xs: 2, sm: 3 }, py: 2, mb: 2 }} variant="outlined">
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        onClick={() => setOpen(!open)}
        sx={{ cursor: 'pointer' }}
      >
        <Stack direction="row" alignItems="center" spacing={1}>
          <Typography variant="body1" component="span">{icon}</Typography>
          <Typography variant="subtitle1" fontWeight="bold">{title}</Typography>
          <Chip label={items.length} size="small" color={items.length > 0 ? 'warning' : 'default'} />
        </Stack>
        <IconButton size="small">
          {open ? <ExpandLess /> : <ExpandMore />}
        </IconButton>
      </Stack>
      <Collapse in={open}>
        <Stack spacing={0.75} sx={{ mt: 1.5 }}>
          {items.map((item, i) => (
            <Typography key={i} variant="body2" color="text.secondary">
              {'\u2022'} {item.title}
              {item.detail && (
                <Typography component="span" variant="caption" color="text.disabled" sx={{ ml: 1 }}>
                  {item.detail}
                </Typography>
              )}
              {item.rule && (
                <Typography component="span" variant="caption" color="text.disabled" sx={{ ml: 0.5 }}>
                  [{item.rule}]
                </Typography>
              )}
            </Typography>
          ))}
        </Stack>
      </Collapse>
    </Paper>
  )
}