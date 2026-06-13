import { Stack, Typography, Card, CardContent, Chip, Box } from '@mui/material'
import { useThemeStore } from '../stores/useThemeStore'
import { zhCN } from '../i18n/zh-CN'
import { PRESET_PALETTES, type DynamicColorInfo } from '../types'

const PRESET_LABELS: Record<string, string> = {
  purple: '紫色',
  blue: '蓝色',
  green: '绿色',
  orange: '橙色',
  pink: '粉色',
}

interface MaterialThemeBridgeWindow extends Window {
  MaterialThemeBridge?: {
    getColors?: () => Promise<DynamicColorInfo>
  }
}

export function ThemePage() {
  const mode = useThemeStore((s) => s.mode)
  const paletteMode = useThemeStore((s) => s.paletteMode)
  const presetId = useThemeStore((s) => s.presetId)
  const customSeed = useThemeStore((s) => s.customSeed)


  const setMode = useThemeStore((s) => s.setMode)
  const setPaletteMode = useThemeStore((s) => s.setPaletteMode)
  const setPresetId = useThemeStore((s) => s.setPresetId)
  const setCustomSeed = useThemeStore((s) => s.setCustomSeed)
  const loadDynamic = useThemeStore((s) => s.loadDynamic)

  const handleDynamic = async () => {
    try {
      const bridge = (window as MaterialThemeBridgeWindow).MaterialThemeBridge
      if (bridge?.getColors) {
        const info = await bridge.getColors()
        loadDynamic(info)
      } else {
        setPaletteMode('dynamic')
      }
    } catch {
      setPaletteMode('dynamic')
    }
  }

  return (
    <Stack spacing={2}>
      <Typography variant="h5">{zhCN.pages.theme.label}</Typography>

      {/* Theme mode: light / dark / auto */}
      <Card variant="outlined" sx={{ borderRadius: 3 }}>
        <CardContent>
          <Typography variant="subtitle2" gutterBottom>
            主题模式
          </Typography>
          <Stack direction="row" spacing={1}>
            <Chip
              label={zhCN.theme.light}
              color={mode === 'light' ? 'primary' : 'default'}
              variant={mode === 'light' ? 'filled' : 'outlined'}
              onClick={() => setMode('light')}
            />
            <Chip
              label={zhCN.theme.dark}
              color={mode === 'dark' ? 'primary' : 'default'}
              variant={mode === 'dark' ? 'filled' : 'outlined'}
              onClick={() => setMode('dark')}
            />
            <Chip
              label={zhCN.theme.auto}
              color={mode === 'auto' ? 'primary' : 'default'}
              variant={mode === 'auto' ? 'filled' : 'outlined'}
              onClick={() => setMode('auto')}
            />
          </Stack>
        </CardContent>
      </Card>

      {/* Palette mode: dynamic / preset / custom */}
      <Card variant="outlined" sx={{ borderRadius: 3 }}>
        <CardContent>
          <Typography variant="subtitle2" gutterBottom>
            配色方案
          </Typography>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            <Chip
              label={zhCN.theme.dynamic}
              color={paletteMode === 'dynamic' ? 'primary' : 'default'}
              variant={paletteMode === 'dynamic' ? 'filled' : 'outlined'}
              onClick={handleDynamic}
            />
            <Chip
              label={zhCN.theme.preset}
              color={paletteMode === 'preset' ? 'primary' : 'default'}
              variant={paletteMode === 'preset' ? 'filled' : 'outlined'}
              onClick={() => setPaletteMode('preset')}
            />
            <Chip
              label={zhCN.theme.custom}
              color={paletteMode === 'custom' ? 'primary' : 'default'}
              variant={paletteMode === 'custom' ? 'filled' : 'outlined'}
              onClick={() => setPaletteMode('custom')}
            />
          </Stack>
        </CardContent>
      </Card>

      {/* Preset palette grid */}
      {paletteMode === 'preset' && (
        <Card variant="outlined" sx={{ borderRadius: 3 }}>
          <CardContent>
            <Typography variant="subtitle2" gutterBottom>
              {zhCN.theme.presetColors}
            </Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1.5 }}>
              {Object.entries(PRESET_PALETTES).map(([id, color]) => (
                <Box
                  key={id}
                  sx={{
                    cursor: 'pointer',
                    borderRadius: 2,
                    overflow: 'hidden',
                    border: '2px solid',
                    borderColor: presetId === id ? 'primary.main' : 'divider',
                    bgcolor: presetId === id ? 'action.selected' : 'transparent',
                  }}
                  onClick={() => setPresetId(id)}
                >
                  <Box sx={{ height: 40, bgcolor: color }} />
                  <Box sx={{ px: 1, py: 0.5 }}>
                    <Typography variant="caption" display="block" fontWeight={600}>
                      {PRESET_LABELS[id] ?? id}
                    </Typography>
                    <Typography variant="caption" display="block" color="text.secondary">
                      {color}
                    </Typography>
                  </Box>
                </Box>
              ))}
            </Box>
          </CardContent>
        </Card>
      )}

      {/* Custom color picker */}
      {paletteMode === 'custom' && (
        <Card variant="outlined" sx={{ borderRadius: 3 }}>
          <CardContent>
            <Typography variant="subtitle2" gutterBottom>
              自定义颜色
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <input
                type="color"
                value={customSeed ?? '#6750A4'}
                onChange={(e) => setCustomSeed(e.target.value)}
                style={{ width: 48, height: 48, border: 'none', cursor: 'pointer', borderRadius: 8 }}
              />
              <Typography variant="body2" color="text.secondary">
                {customSeed ?? '#6750A4'}
              </Typography>
            </Box>
          </CardContent>
        </Card>
      )}

      {/* Preview */}
      <Card variant="outlined" sx={{ borderRadius: 3 }}>
        <CardContent>
          <Typography variant="subtitle2" gutterBottom>
            预览
          </Typography>
          <Stack direction="row" spacing={1.5}>
            <Box>
              <Box sx={{ width: 56, height: 56, bgcolor: 'primary.main', borderRadius: 2 }} />
              <Typography variant="caption" display="block" textAlign="center" mt={0.5}>
                Primary
              </Typography>
            </Box>
            <Box>
              <Box sx={{ width: 56, height: 56, bgcolor: 'primary.light', borderRadius: 2 }} />
              <Typography variant="caption" display="block" textAlign="center" mt={0.5}>
                Container
              </Typography>
            </Box>
            <Box>
              <Box
                sx={{
                  width: 56, height: 56,
                  bgcolor: 'background.default',
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: 2,
                }}
              />
              <Typography variant="caption" display="block" textAlign="center" mt={0.5}>
                Surface
              </Typography>
            </Box>
          </Stack>
        </CardContent>
      </Card>
    </Stack>
  )
}