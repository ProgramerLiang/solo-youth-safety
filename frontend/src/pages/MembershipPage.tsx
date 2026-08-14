import { Stack, Typography, Card, CardContent, Box } from '@mui/material'
import StarIcon from '@mui/icons-material/Star'
import { zhCN } from '../i18n/zh-CN'

const BENEFITS = [
  { title: '本地优先守护', desc: '一切敏感数据留在本机,你的位置与联系人不上云。' },
  { title: '智能场景扩展', desc: '围栏、行程、风险规则组合,后续支持更多自动守护场景。' },
  { title: '陪伴助手抢先体验', desc: 'AI 陪伴助手上线后,会员可优先体验情绪陪伴与安全提醒。' },
  { title: '数据加密与备份', desc: '本地加密存储 + 一键导出备份,换机无忧。' },
]

export function MembershipPage() {
  return (
    <Stack spacing={2}>
      <Typography variant="h5">会员</Typography>
      <Card variant="outlined" sx={{ borderRadius: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <StarIcon color="warning" />
            <Typography variant="h6">会员权益</Typography>
          </Box>
          <Typography variant="body2" color="text.secondary">所有功能均已免费开放,会员权益即将上线,敬请期待。</Typography>
        </CardContent>
      </Card>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.5 }}>
        {BENEFITS.map((b) => (
          <Card key={b.title} variant="outlined" sx={{ borderRadius: 3 }}>
            <CardContent>
              <Typography variant="subtitle1" gutterBottom>{b.title}</Typography>
              <Typography variant="body2" color="text.secondary">{b.desc}</Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>即将上线,敬请期待</Typography>
            </CardContent>
          </Card>
        ))}
      </Box>
    </Stack>
  )
}