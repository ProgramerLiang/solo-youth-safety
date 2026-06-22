import { useState } from 'react'
import { Box, TextField, Button, Typography, Paper } from '@mui/material'
import { usePrivacyLockStore } from '../stores/usePrivacyLockStore'

interface PrivacyLockScreenProps {
  onUnlock: () => void
}

export function PrivacyLockScreen({ onUnlock }: PrivacyLockScreenProps) {
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const unlock = usePrivacyLockStore((s) => s.unlock)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const success = await unlock(pin)
    if (success) {
      setError('')
      onUnlock()
    } else {
      setError('PIN incorrect')
      setPin('')
    }
  }

  return (
    <Box
      sx={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        bgcolor: 'background.default',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Paper
        elevation={3}
        sx={{
          p: 4,
          maxWidth: 400,
          width: '90%',
        }}
      >
        <Typography variant="h5" gutterBottom align="center">
          Privacy Lock
        </Typography>
        <Typography variant="body2" color="text.secondary" gutterBottom align="center">
          Enter your PIN to unlock
        </Typography>
        <Box component="form" onSubmit={handleSubmit} sx={{ mt: 3 }}>
          <TextField
            fullWidth
            type="tel"
            inputMode="numeric"
            label="PIN"
            value={pin}
            onChange={(e) => {
              const val = e.target.value.replace(/\D/g, '')
              if (val.length <= 6) setPin(val)
            }}
            error={!!error}
            helperText={error}
            autoFocus
            sx={{ mb: 3 }}
          />
          <Button
            fullWidth
            type="submit"
            variant="contained"
            disabled={pin.length < 4}
          >
            Unlock
          </Button>
        </Box>
      </Paper>
    </Box>
  )
}
