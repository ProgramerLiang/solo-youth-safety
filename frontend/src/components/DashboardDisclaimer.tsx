import Typography from '@mui/material/Typography'

export function DashboardDisclaimer() {
  return (
    <Typography variant="caption" color="text.disabled" sx={{ display: 'block', textAlign: 'center', mt: 1, mb: 1 }}>
      所有提示仅本地生成，不会自动通知联系人或触发 SOS。
    </Typography>
  )
}