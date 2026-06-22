import { useEffect, useState } from 'react'
import { Box, Card, CardContent, Chip, Slider, Stack, Typography } from '@mui/material'
import { IconButton, Popover } from '@mui/material'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import PauseIcon from '@mui/icons-material/Pause'
import { EmptyState } from '../components/EmptyState'
import { buildPlaybackRoute, type PlaybackBounds, type PlaybackPoint, type PlaybackPointRole } from '../domain/playback'
import { computeMovementSummary } from '../domain/movementAnalysis'
import { assessMovementRisk } from '../domain/riskAssessment'
import { routeGeofenceEvents } from '../domain/geofence'
import { zhCN } from '../i18n/zh-CN'
import { useSosStore } from '../stores/useSosStore'
import { useTrackingStore } from '../stores/useTrackingStore'
import { useGeofenceStore } from '../stores/useGeofenceStore'


const roleTone: Record<PlaybackPointRole, { bg: string; fg: string; label: string }> = {
  start: { bg: 'success.main', fg: 'success.contrastText', label: '开始点' },
  tracking: { bg: 'primary.main', fg: 'primary.contrastText', label: '轨迹点' },
  sos: { bg: 'error.main', fg: 'error.contrastText', label: 'SOS' },
  end: { bg: 'warning.main', fg: 'warning.contrastText', label: '结束点' },
}

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleString('zh-CN')
}

function formatDuration(durationMs: number): string {
  if (durationMs <= 0) return '0 秒'
  const totalSeconds = Math.round(durationMs / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  if (minutes === 0) return `${seconds} 秒`
  if (seconds === 0) return `${minutes} 分钟`
  return `${minutes} 分 ${seconds} 秒`
}

function formatDistance(m: number): string {
  if (m < 1000) return `${m} m`
  return `${(m / 1000).toFixed(1)} km`
}

function formatBounds(bounds: PlaybackBounds | null): string {
  if (!bounds) return '无'
  return `${bounds.minLat.toFixed(5)},${bounds.minLng.toFixed(5)} → ${bounds.maxLat.toFixed(5)},${bounds.maxLng.toFixed(5)}`
}

function markerPosition(point: PlaybackPoint, bounds: PlaybackBounds | null): { left: string; top: string } {
  if (!bounds) return { left: '50%', top: '50%' }
  const latSpan = bounds.maxLat - bounds.minLat
  const lngSpan = bounds.maxLng - bounds.minLng
  const left = lngSpan === 0 ? 50 : ((point.lng - bounds.minLng) / lngSpan) * 80 + 10
  const top = latSpan === 0 ? 50 : 90 - ((point.lat - bounds.minLat) / latSpan) * 80
  return { left: `${left}%`, top: `${top}%` }
}

function markerLabel(point: PlaybackPoint): string {
  if (point.role === 'sos') return '警'
  if (point.role === 'start') return '起'
  if (point.role === 'end') return '终'
  return '•'
}

function speedColor(speedKmh: number | undefined): string {
  if (speedKmh == null) return 'primary.main'
  if (speedKmh < 5) return 'success.main'
  if (speedKmh <= 30) return 'warning.main'
  return 'error.main'
}

function speedLabel(speedKmh: number | undefined): string {
  if (speedKmh == null) return '-'
  if (speedKmh < 5) return '低速'
  if (speedKmh <= 30) return '中速'
  return '高速'
}

export function PlaybackPage() {
  const trackingHistory = useTrackingStore((s) => s.history)
  const sosHistory = useSosStore((s) => s.history)
  const route = buildPlaybackRoute(trackingHistory, sosHistory)
  const movement = computeMovementSummary(trackingHistory)
  const risk = assessMovementRisk(trackingHistory, sosHistory)
  const geofenceZones = useGeofenceStore((s) => s.zones)
  const geofenceEvents = routeGeofenceEvents(geofenceZones, trackingHistory)
  const [zoom, setZoom] = useState(1)
  const [selectedPoint, setSelectedPoint] = useState<PlaybackPoint | null>(null)
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [playbackIndex, setPlaybackIndex] = useState(0)
  const [playbackSpeed, setPlaybackSpeed] = useState<1 | 2 | 4>(1)

  useEffect(() => {
    if (!isPlaying) return
    if (playbackIndex >= route.points.length - 1) {
      setIsPlaying(false)
      return
    }
    const intervalMs = 1000 / playbackSpeed
    const timer = setInterval(() => {
      setPlaybackIndex((prev) => {
        if (prev >= route.points.length - 1) {
          setIsPlaying(false)
          return prev
        }
        return prev + 1
      })
    }, intervalMs)
    return () => clearInterval(timer)
  }, [isPlaying, playbackIndex, playbackSpeed, route.points.length])

  const handlePlayPause = () => {
    if (playbackIndex >= route.points.length - 1) setPlaybackIndex(0)
    setIsPlaying((p) => !p)
  }

  return (
    <Stack spacing={2}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" gap={1}>
        <Typography variant="h5">{zhCN.playback.title}</Typography>
        <Chip label={`${route.points.length} 点`} size="small" />
      </Stack>

      <Card variant="outlined" sx={{ borderRadius: 3 }}>
        <CardContent>
          <Typography variant="body2" color="text.secondary">
            {zhCN.playback.localOnly}
          </Typography>
        </CardContent>
      </Card>

      {route.points.length === 0 ? (
        <EmptyState message={zhCN.playback.empty} />
      ) : (
        <>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 1.5 }}>
            <Card variant="outlined" sx={{ borderRadius: 3 }}>
              <CardContent>
                <Typography variant="caption" color="text.secondary">{zhCN.playback.trackingPoints}</Typography>
                <Typography variant="h6">{route.totalTrackingPoints}</Typography>
              </CardContent>
            </Card>
            <Card variant="outlined" sx={{ borderRadius: 3 }}>
              <CardContent>
                <Typography variant="caption" color="text.secondary">{zhCN.playback.sosNodes}</Typography>
                <Typography variant="h6">{route.totalSosEvents}</Typography>
              </CardContent>
            </Card>
            <Card variant="outlined" sx={{ borderRadius: 3 }}>
              <CardContent>
                <Typography variant="caption" color="text.secondary">{zhCN.playback.duration}</Typography>
                <Typography variant="h6">{formatDuration(route.durationMs)}</Typography>
              </CardContent>
            </Card>
          </Box>

          {/* Movement Analysis */}
          <Card variant="outlined" sx={{ borderRadius: 3 }}>
            <CardContent>
              <Typography variant="overline">{zhCN.playback.movement.title}</Typography>
              {movement.totalPoints < 2 ? (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  {zhCN.playback.movement.noData}
                </Typography>
              ) : (
                <Stack spacing={1.5} mt={1}>
                  <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 1 }}>
                    <Box>
                      <Typography variant="caption" color="text.secondary">
                        {zhCN.playback.movement.totalDistance}
                      </Typography>
                      <Typography variant="body2" fontWeight={600}>
                        {formatDistance(movement.totalDistanceM)}
                      </Typography>
                    </Box>
                    <Box>
                      <Typography variant="caption" color="text.secondary">
                        {zhCN.playback.movement.avgSpeed}
                      </Typography>
                      <Typography variant="body2" fontWeight={600}>
                        {movement.avgSpeedKmh > 0 ? `${movement.avgSpeedKmh} km/h` : '-'}
                      </Typography>
                    </Box>
                    <Box>
                      <Typography variant="caption" color="text.secondary">
                        {zhCN.playback.movement.maxSpeed}
                      </Typography>
                      <Typography variant="body2" fontWeight={600}>
                        {movement.maxSpeedKmh > 0 ? `${movement.maxSpeedKmh} km/h` : '-'}
                      </Typography>
                    </Box>
                  </Box>

                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      {zhCN.playback.movement.stationaryPeriods}
                    </Typography>
                    {movement.stationaryPeriods.length === 0 ? (
                      <Typography variant="body2" color="text.secondary">
                        {zhCN.playback.movement.noStationary}
                      </Typography>
                    ) : (
                      movement.stationaryPeriods.map((p, i) => (
                        <Typography key={i} variant="body2">
                          {formatTime(p.startedAt)} – {formatTime(p.endedAt)}
                          {' · '}{p.sampleCount} 个采样点
                          {' · '}{Math.round(p.durationMs / 60000)}{zhCN.playback.movement.periodUnit}
                        </Typography>
                      ))
                    )}
                  </Box>

                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      {zhCN.playback.movement.suspiciousPauses}
                    </Typography>
                    {movement.suspiciousPauses.length === 0 ? (
                      <Typography variant="body2" color="text.secondary">
                        {zhCN.playback.movement.noSuspicious}
                      </Typography>
                    ) : (
                      movement.suspiciousPauses.map((p, i) => (
                        <Typography key={i} variant="body2" color="warning.main">
                          {formatTime(p.startedAt)} – {formatTime(p.endedAt)}
                          {' · '}{p.sampleCount} 个采样点
                          {' · '}{Math.round(p.durationMs / 60000)}{zhCN.playback.movement.periodUnit}
                        </Typography>
                      ))
                    )}
                  </Box>
                </Stack>
              )}
            </CardContent>
          </Card>

          {/* Risk Assessment */}
          <Card variant="outlined" sx={{ borderRadius: 3 }}>
            <CardContent>
              <Stack direction="row" spacing={1} alignItems="center">
                <Typography variant="overline">{zhCN.playback.risk.title}</Typography>
                <Chip
                  label={{
                    ok: zhCN.playback.risk.ok,
                    attention: zhCN.playback.risk.attention,
                    warning: zhCN.playback.risk.warning,
                  }[risk.level]}
                  size="small"
                  color={risk.level === 'warning' ? 'warning' : risk.level === 'attention' ? 'primary' : 'default'}
                />
              </Stack>
              <Stack spacing={0.5} mt={1}>
                {risk.items.map((item, i) => (
                  <Typography
                    key={i}
                    variant="body2"
                    color={item.severity === 'warning' ? 'warning.main' : item.severity === 'attention' ? 'text.primary' : 'text.secondary'}
                    fontWeight={item.severity === 'warning' ? 600 : 400}
                  >
                    {item.title}：{item.detail}
                  </Typography>
                ))}
              </Stack>
            </CardContent>
          </Card>

          {/* Geofence Events */}
          <Card variant="outlined" sx={{ borderRadius: 3 }}>
            <CardContent>
              <Typography variant="overline">{zhCN.playback.geofence.title}</Typography>
              {geofenceZones.length === 0 ? (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  {zhCN.playback.geofence.noEvents}
                </Typography>
              ) : geofenceEvents.length === 0 ? (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  {zhCN.playback.geofence.noEvents}
                </Typography>
              ) : (
                <Stack spacing={0.5} mt={1}>
                  {geofenceEvents.map((evt, i) => (
                    <Typography
                      key={i}
                      variant="body2"
                      color={evt.event === 'exit' ? 'warning.main' : 'primary.main'}
                      fontWeight={evt.event === 'exit' ? 600 : 400}
                    >
                      {evt.zoneLabel}：{evt.event === 'inside' ? zhCN.playback.geofence.eventInside : zhCN.playback.geofence.eventExit}
                      {' · '}{formatTime(evt.at)}
                      {' · '}距离 {evt.distanceM}m
                    </Typography>
                  ))}
                </Stack>
              )}
            </CardContent>
          </Card>

          <Card variant="outlined" sx={{ borderRadius: 3, overflow: 'hidden' }}>
            <CardContent>
              <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1} gap={1}>
                <Typography variant="overline">{zhCN.playback.bounds}</Typography>
                <Typography variant="caption" color="text.secondary">{formatBounds(route.bounds)}</Typography>
              </Stack>
              <Box
                aria-label={zhCN.playback.mapLabel}
                sx={{
                  position: 'relative',
                  minHeight: 260,
                  borderRadius: 3,
                  overflow: 'hidden',
                  bgcolor: 'action.hover',
                  backgroundImage: (theme) => `linear-gradient(${theme.palette.divider} 1px, transparent 1px), linear-gradient(90deg, ${theme.palette.divider} 1px, transparent 1px)`,
                  backgroundSize: '28px 28px',
                  border: '1px solid',
                  borderColor: 'divider',
                }}
              >
                <Stack direction="row" spacing={0.5} sx={{ position: 'absolute', top: 8, right: 8, zIndex: 2 }}>
                  <IconButton
                    size="small"
                    aria-label="放大"
                    onClick={() => setZoom((z) => Math.min(3, z + 0.25))}
                    sx={{ bgcolor: 'background.paper' }}
                  >
                    <Typography variant="body2" fontWeight="bold">+</Typography>
                  </IconButton>
                  <IconButton
                    size="small"
                    aria-label="缩小"
                    onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))}
                    sx={{ bgcolor: 'background.paper' }}
                  >
                    <Typography variant="body2" fontWeight="bold">-</Typography>
                  </IconButton>
                  <Chip label={`${zoom.toFixed(2)}x`} size="small" sx={{ bgcolor: 'background.paper' }} />
                </Stack>
                <Box
                  sx={{
                    position: 'absolute',
                    inset: 0,
                    transform: `scale(${zoom})`,
                    transformOrigin: 'top left',
                    width: `${100 / zoom}%`,
                    height: `${100 / zoom}%`,
                  }}
                >
                  <Box
                    sx={{
                      position: 'absolute',
                      inset: 24,
                      border: '1px dashed',
                      borderColor: 'divider',
                      borderRadius: 2,
                    }}
                  />
                  {route.points.map((point) => {
                    const tone = roleTone[point.role]
                    const position = markerPosition(point, route.bounds)
                    const bgColor = point.source === 'tracking' && point.speedKmh != null ? speedColor(point.speedKmh) : tone.bg
                    const isCurrentPoint = route.points.indexOf(point) === playbackIndex && isPlaying
                    return (
                    <Box
                      key={point.id}
                      onClick={(event) => {
                        setSelectedPoint(point)
                        setAnchorEl(event.currentTarget)
                      }}
                      sx={{
                        position: 'absolute',
                        left: position.left,
                        top: position.top,
                        transform: 'translate(-50%, -50%)',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: 0.5,
                        cursor: 'pointer',
                      }}
                    >
                      <Box
                        sx={{
                        width: isCurrentPoint ? (point.role === 'sos' ? 52 : 44) : (point.role === 'sos' ? 42 : 34),
                        height: isCurrentPoint ? (point.role === 'sos' ? 52 : 44) : (point.role === 'sos' ? 42 : 34),
                          borderRadius: '999px',
                          display: 'grid',
                          placeItems: 'center',
                          bgcolor: bgColor,
                          color: tone.fg,
                          border: '2px solid',
                          borderColor: 'background.paper',
                          boxShadow: isCurrentPoint ? 6 : 3,
                        outline: isCurrentPoint ? '4px solid' : 'none',
                        outlineColor: isCurrentPoint ? 'warning.main' : 'transparent',
                          fontSize: point.role === 'sos' ? 12 : 10,
                          fontWeight: 700,
                        }}
                      >
                        {markerLabel(point)}
                      </Box>
                      <Typography
                        variant="caption"
                        sx={{
                          px: 0.75,
                          py: 0.25,
                          borderRadius: 999,
                          bgcolor: 'background.paper',
                          boxShadow: 1,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {tone.label}
                      </Typography>
                    </Box>
                    )
                  })}
                </Box>
              </Box>
            </CardContent>
          </Card>

          <Popover
            open={selectedPoint !== null}
            anchorEl={anchorEl}
            onClose={() => setSelectedPoint(null)}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            transformOrigin={{ vertical: 'top', horizontal: 'center' }}
          >
            {selectedPoint && (
              <Box sx={{ p: 2, minWidth: 220 }}>
                <Stack spacing={1}>
                  <Typography variant="subtitle2" fontWeight="bold">
                    点位详情 · {roleTone[selectedPoint.role].label}
                  </Typography>
                  <Typography variant="body2">时间: {formatTime(selectedPoint.timestamp)}</Typography>
                  <Typography variant="body2">纬度: {selectedPoint.lat.toFixed(5)}</Typography>
                  <Typography variant="body2">经度: {selectedPoint.lng.toFixed(5)}</Typography>
                  {selectedPoint.accuracy != null && (
                    <Typography variant="body2">精度: {selectedPoint.accuracy} m</Typography>
                  )}
                  <Typography variant="body2">来源: {selectedPoint.source === 'tracking' ? '轨迹采样' : 'SOS 事件'}</Typography>
                  {selectedPoint.speedKmh != null && (
                    <Typography variant="body2">速度: {selectedPoint.speedKmh.toFixed(1)} km/h · {speedLabel(selectedPoint.speedKmh)}</Typography>
                  )}
                  <Typography variant="body2">{selectedPoint.detail}</Typography>
                </Stack>
              </Box>
            )}
          </Popover>

          <Card variant="outlined" sx={{ borderRadius: 3 }}>
            <CardContent>
              <Typography variant="overline">动画播放</Typography>
              <Stack direction="row" alignItems="center" spacing={2} mt={1}>
                <IconButton
                  aria-label={isPlaying ? '暂停' : '播放'}
                  onClick={handlePlayPause}
                  size="medium"
                  sx={{ border: '1px solid', borderColor: 'divider' }}
                >
                  {isPlaying ? <PauseIcon /> : <PlayArrowIcon />}
                </IconButton>
                <Typography variant="body2">
                  {playbackIndex + 1} / {route.points.length}
                </Typography>
                <Stack direction="row" spacing={0.5}>
                  {([1, 2, 4] as const).map((s) => (
                    <Chip
                      key={s}
                      label={`${s}x`}
                      size="small"
                      color={playbackSpeed === s ? 'primary' : 'default'}
                      onClick={() => setPlaybackSpeed(s)}
                    />
                  ))}
                </Stack>
              </Stack>
            </CardContent>
          </Card>

          <Card variant="outlined" sx={{ borderRadius: 3 }}>
            <CardContent>
              <Typography variant="overline">时间轴</Typography>
              <Stack direction="row" alignItems="center" spacing={2} mt={1}>
                <Typography variant="caption" sx={{ minWidth: 120 }}>
                  {route.points[playbackIndex] ? formatTime(route.points[playbackIndex].timestamp) : '--'}
                </Typography>
                <Slider
                  value={playbackIndex}
                  min={0}
                  max={route.points.length - 1}
                  onChange={(_, value) => setPlaybackIndex(value as number)}
                  aria-label="时间轴"
                  sx={{ flex: 1 }}
                />
                <Typography variant="caption" sx={{ minWidth: 60 }}>
                  {playbackIndex + 1} / {route.points.length}
                </Typography>
              </Stack>
            </CardContent>
          </Card>

          <Card variant="outlined" sx={{ borderRadius: 3 }}>
            <CardContent>
              <Typography variant="overline">速度图例</Typography>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} mt={1}>
                <Stack direction="row" alignItems="center" spacing={0.5}>
                  <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: 'success.main' }} />
                  <Typography variant="caption">低速 (&lt;5 km/h)</Typography>
                </Stack>
                <Stack direction="row" alignItems="center" spacing={0.5}>
                  <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: 'warning.main' }} />
                  <Typography variant="caption">中速 (5-30 km/h)</Typography>
                </Stack>
                <Stack direction="row" alignItems="center" spacing={0.5}>
                  <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: 'error.main' }} />
                  <Typography variant="caption">高速 (&gt;30 km/h)</Typography>
                </Stack>
              </Stack>
            </CardContent>
          </Card>

          <Card variant="outlined" sx={{ borderRadius: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>{zhCN.playback.timeline}</Typography>
              <Stack spacing={1}>
                {route.points.map((point, index) => (
                  <Box
                    key={point.id}
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: 'auto 1fr auto',
                      gap: 1,
                      alignItems: 'center',
                      py: 1,
                      borderBottom: index === route.points.length - 1 ? 0 : '1px solid',
                      borderColor: 'divider',
                    }}
                  >
                    <Chip label={index + 1} size="small" />
                    <Box>
                      <Typography variant="body2" fontWeight={600}>{point.label}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {formatTime(point.timestamp)} · {point.lat.toFixed(5)}, {point.lng.toFixed(5)} · {point.detail}
                      </Typography>
                    </Box>
                    <Chip label={roleTone[point.role].label} size="small" variant="outlined" />
                  </Box>
                ))}
              </Stack>
            </CardContent>
          </Card>
        </>
      )}
    </Stack>
  )
}