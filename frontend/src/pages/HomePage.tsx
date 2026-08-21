import { Stack, Typography, Box, Card, CardContent, Chip, Button } from '@mui/material'
import FullscreenIcon from '@mui/icons-material/Fullscreen'
import FullscreenExitIcon from '@mui/icons-material/FullscreenExit'
import { HomeSosButton } from '../components/HomeSosButton'
import { HomeSlotCard } from '../components/HomeSlotCard'
import { AiCompanionPlaceholder } from '../components/AiCompanionPlaceholder'
import { useHomeStore } from '../stores/useHomeStore'
import { useThemeStore } from '../stores/useThemeStore'
import { useConfigStore } from '../stores/useConfigStore'
import { useContactsStore } from '../stores/useContactsStore'
import { zhCN } from '../i18n/zh-CN'
import type { PageId } from '../types'

interface HomePageProps {
  onNavigate: (pageId: PageId) => void
}

export function HomePage({ onNavigate }: HomePageProps) {
  const slots = useHomeStore((s) => s.slots)
  const callNumber = useConfigStore((s) => s.callNumber)
  const smsNumber = useConfigStore((s) => s.smsNumber)
  const contactsCount = useContactsStore((s) => s.list.length)
  const configComplete = !!(callNumber && smsNumber && contactsCount > 0)
  const immersiveNavBar = useThemeStore((s) => s.immersiveNavBar)
  const setImmersiveNavBar = useThemeStore((s) => s.setImmersiveNavBar)

  return (
    <Stack spacing={2}>
      <HomeSosButton onNavigate={onNavigate} />

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', sm: '1fr 1fr' }, gap: 1.5 }}>
        {slots.map((key, idx) => (
          <HomeSlotCard key={`${key}-${idx}`} slotKey={key} onNavigate={onNavigate} />
        ))}
      </Box>

      <AiCompanionPlaceholder onNavigate={onNavigate} />

      <Card variant="outlined" sx={{ borderRadius: 3 }}>
        <CardContent>
          <Typography variant="overline">{zhCN.overview.statusCard}</Typography>
          <Stack spacing={1} mt={1}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="body2">{zhCN.config.callNumber}</Typography>
              <Chip label={callNumber || zhCN.overview.notConfigured} size="small" color={callNumber ? 'success' : 'warning'} variant="outlined" />
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="body2">{zhCN.config.smsNumber}</Typography>
              <Chip label={smsNumber || zhCN.overview.notConfigured} size="small" color={smsNumber ? 'success' : 'warning'} variant="outlined" />
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="body2">{zhCN.pages.contacts.label}</Typography>
              <Chip label={`${contactsCount} 人`} size="small" color={contactsCount > 0 ? 'success' : 'warning'} variant="outlined" />
            </Box>
            {!configComplete && (
              <Button size="small" variant="outlined" onClick={() => onNavigate('config')}>一键补全配置</Button>
            )}
          </Stack>
        </CardContent>
      </Card>

      {/* 导航栏沉浸快捷开关 — 底栏被遮挡时使用 */}
      <Box sx={{ textAlign: 'center' }}>
        <Chip
          icon={immersiveNavBar ? <FullscreenExitIcon /> : <FullscreenIcon />}
          label={immersiveNavBar ? '导航栏沉浸已开启 · 关闭' : '导航栏沉浸已关闭 · 开启'}
          size="small"
          variant="outlined"
          color={immersiveNavBar ? 'primary' : 'default'}
          onClick={() => setImmersiveNavBar(!immersiveNavBar)}
        />
      </Box>
    </Stack>
  )
}