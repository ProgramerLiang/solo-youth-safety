import { useEffect, useState } from 'react'
import {
  Stack, Typography, Card, CardContent, Button, Chip, Box, Alert, Snackbar, TextField,
} from '@mui/material'
import DownloadIcon from '@mui/icons-material/Download'
import UploadIcon from '@mui/icons-material/Upload'
import DeleteForeverIcon from '@mui/icons-material/DeleteForever'
import PersonAddIcon from '@mui/icons-material/PersonAdd'
import PinDropIcon from '@mui/icons-material/PinDrop'
import { useConfigStore } from '../stores/useConfigStore'
import { useSosStore } from '../stores/useSosStore'
import { useContactsStore } from '../stores/useContactsStore'
import { useTrackingStore } from '../stores/useTrackingStore'
import { useDevModeStore } from '../stores/useDevModeStore'
import { exportSnapshot, importSnapshot, clearAllData } from '../data/snapshot'
import { exportDiagnosticReport } from '../data/diagnostics'
import { parseDiagnosticReportJson, summarizeDiagnosticReport } from '../data/diagnosticSummary'
import type { DiagnosticSummary } from '../data/diagnosticSummary'
import { loadLocationSelfTestReport, runAndSaveLocationSelfTest } from '../data/locationSelfTestRepo'
import type { LocationSelfTestReport, LocationSelfTestAttempt } from '../native/nativeLocation'
import { saveContacts } from '../data/contactsRepo'
import { saveTrackingState } from '../data/trackingRepo'
import { getStorageDriverLabel } from '../data/storage'
import { zhCN } from '../i18n/zh-CN'
import { ConfirmDialog } from '../components/ConfirmDialog'
import type { TrackingSnapshot } from '../types'


function issueColor(level: 'attention' | 'warning'): 'warning' | 'error' {
  return level === 'warning' ? 'error' : 'warning'
}

function DiagnosticSummaryView({ summary }: { summary: DiagnosticSummary }) {
  const rows = [
    ['App', summary.facts.appVersion],
    ['设备', summary.facts.device],
    ['定位 Provider', summary.facts.locationProviders],
    ['定位权限', summary.facts.locationPermissions],
    ['定位自检', summary.facts.locationSelfTest],
    ['最近定位', summary.facts.lastLocationAttempt],
    ['本地轨迹', summary.facts.localTracking],
    ['主题', summary.facts.theme],
    ['隐私', summary.facts.privacy],
  ]

  return (
    <Stack spacing={1}>
      <Chip label={summary.level} color={summary.level === 'warning' ? 'error' : summary.level === 'attention' ? 'warning' : 'success'} size="small" sx={{ alignSelf: 'flex-start' }} />
      <Stack spacing={0.5}>
        {rows.map(([label, value]) => (
          <Box key={label} sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, flexWrap: 'wrap' }}>
            <Typography variant="body2" color="text.secondary">{label}</Typography>
            <Typography variant="body2" sx={{ textAlign: 'right', overflowWrap: 'anywhere' }}>{value}</Typography>
          </Box>
        ))}
      </Stack>
      {summary.issues.length > 0 && (
        <Stack spacing={0.5}>
          {summary.issues.map((issue) => (
            <Alert key={`${issue.level}-${issue.title}`} severity={issueColor(issue.level)}>
              <Typography variant="body2">{issue.title}</Typography>
              <Typography variant="caption">{issue.detail}</Typography>
            </Alert>
          ))}
        </Stack>
      )}
    </Stack>
  )
}

function LocationSelfTestAttemptView({ attempt }: { attempt: LocationSelfTestAttempt }) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, flexWrap: 'wrap' }}>
      <Typography variant="body2">{attempt.label}</Typography>
      <Typography variant="body2" sx={{ textAlign: 'right', overflowWrap: 'anywhere' }}>
        {attempt.success ? '成功' : '失败'} · {attempt.elapsedMs}ms · 精度 {attempt.accuracy ?? '未知'}m · {attempt.providerName ?? '无 provider'}
      </Typography>
    </Box>
  )
}

function LocationSelfTestView({ report }: { report: LocationSelfTestReport }) {
  return (
    <Stack spacing={1}>
      <Typography variant="caption" color="text.secondary">{report.ranAt}</Typography>
      <LocationSelfTestAttemptView attempt={report.fast} />
      <LocationSelfTestAttemptView attempt={report.accurate} />
      <Alert severity={report.fast.success || report.accurate.success ? 'info' : 'warning'}>{report.conclusion}</Alert>
    </Stack>
  )
}
export function ToolsPage() {
  const devMode = useDevModeStore((s) => s.enabled)
  const config = useConfigStore.getState()
  const sosHistory = useSosStore((s) => s.history)
  const contacts = useContactsStore((s) => s.list)
  const pc = useTrackingStore((s) => s.pendingCount)

  const [showClearDialog, setShowClearDialog] = useState(false)
  const [snackbarMsg, setSnackbarMsg] = useState('')
  const [currentDiagnosticSummary, setCurrentDiagnosticSummary] = useState<DiagnosticSummary | null>(null)
  const [diagnosticJson, setDiagnosticJson] = useState('')
  const [parsedDiagnosticSummary, setParsedDiagnosticSummary] = useState<DiagnosticSummary | null>(null)
  const [diagnosticParseError, setDiagnosticParseError] = useState('')
  const [locationSelfTest, setLocationSelfTest] = useState<LocationSelfTestReport | null>(null)
  const [locationSelfTesting, setLocationSelfTesting] = useState(false)

  useEffect(() => {
    if (!devMode) return
    let active = true
    exportDiagnosticReport()
      .then((report) => {
        if (active) setCurrentDiagnosticSummary(summarizeDiagnosticReport(report))
      })
      .catch(() => {
        if (active) setCurrentDiagnosticSummary(null)
      })
    loadLocationSelfTestReport().then((report) => {
      if (active) setLocationSelfTest(report)
    })
    return () => {
      active = false
    }
  }, [devMode])

  if (!devMode) {
    return (
      <Stack spacing={2} sx={{ p: 2 }}>
        <Typography variant="h5">{zhCN.pages.tools.label}</Typography>
        <Alert severity="info">{zhCN.tools.devModeOnly}</Alert>
      </Stack>
    )
  }

  const handleExportSnapshot = async () => {
    const snap = await exportSnapshot()
    const blob = new Blob([JSON.stringify(snap, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `safety-snapshot-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
    setSnackbarMsg(`${zhCN.feedback.snapshotExported}，${zhCN.feedback.exportLocationHint}`)
  }

  const handleExportDiagnostics = async () => {
    const report = await exportDiagnosticReport()
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `safety-diagnostics-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
    setSnackbarMsg(`${zhCN.feedback.diagnosticsExported}，${zhCN.feedback.exportLocationHint}`)
  }

  const handleParseDiagnostics = () => {
    const parsed = parseDiagnosticReportJson(diagnosticJson)
    if (parsed.ok) {
      setParsedDiagnosticSummary(parsed.summary)
      setDiagnosticParseError('')
    } else {
      setParsedDiagnosticSummary(null)
      setDiagnosticParseError(parsed.error)
    }
  }

  const handleRunLocationSelfTest = async () => {
    setLocationSelfTesting(true)
    try {
      const report = await runAndSaveLocationSelfTest()
      setLocationSelfTest(report)
      const diagnosticReport = await exportDiagnosticReport()
      setCurrentDiagnosticSummary(summarizeDiagnosticReport(diagnosticReport))
    } finally {
      setLocationSelfTesting(false)
    }
  }

  const handleImportSnapshot = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return
      try {
        const json = await file.text()
        const snap = JSON.parse(json)
        await importSnapshot(snap)
        setSnackbarMsg(zhCN.feedback.snapshotImported)
      } catch {
        setSnackbarMsg(zhCN.feedback.importFailed)
      }
    }
    input.click()
  }

  const handleClearAll = async () => {
    await clearAllData()
    setShowClearDialog(false)
    setSnackbarMsg(zhCN.feedback.dataCleared)
  }

  const handleAddMockContact = async () => {
    const mockContact = { id: `mock_${Date.now()}`, name: `模拟联系人_${contacts.length + 1}`, phone: '13800138000' }
    const newList = [...contacts, mockContact]
    await saveContacts(newList)
    useContactsStore.setState({ list: newList })
    setSnackbarMsg(`已添加模拟联系人：${mockContact.name}`)
  }

  const handleWriteMockTracking = async () => {
    await useTrackingStore.getState().stop()
    const nowMs = Date.now()
    const now = new Date(nowMs).toISOString()
    const history = [
      { lat: 31.2304, lng: 121.4737, accuracy: 12, timestamp: nowMs - 120_000 },
      { lat: 31.2310, lng: 121.4741, accuracy: 10, timestamp: nowMs - 60_000 },
      { lat: 31.2316, lng: 121.4748, accuracy: 14, timestamp: nowMs },
    ]
    const mockSnapshot: TrackingSnapshot = { enabled: false, intervalSeconds: 60, pendingCount: 0, lastCapturedAt: now, lastAcknowledgedAt: now, nextRetryAt: null, queue: [], history }
    await saveTrackingState(mockSnapshot)
    useTrackingStore.setState({ enabled: false, intervalSeconds: 60, lastCapturedAt: nowMs, lastAcknowledgedAt: nowMs, pendingCount: 0, queue: [], history, busy: false })
    setSnackbarMsg('已写入模拟轨迹数据')
  }

  return (
    <Stack spacing={2}>
      <Typography variant="h5">{zhCN.pages.tools.label}</Typography>

      <Card variant="outlined" sx={{ borderRadius: 3 }}>
        <CardContent>
          <Typography variant="overline">{zhCN.tools.devPanel}</Typography>
          <Chip label={`${zhCN.tools.storageDriver}：${getStorageDriverLabel()}`} size="small" sx={{ ml: 1 }} />
        </CardContent>
      </Card>

      <Card variant="outlined" sx={{ borderRadius: 3 }}>
        <CardContent>
          <Typography variant="overline">{zhCN.tools.dataPanel}</Typography>
          <Stack spacing={1} mt={1}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography variant="body2">{zhCN.pages.config.label}</Typography>
              <Chip label={config.callNumber ? '已配置' : '未配置'} size="small" />
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography variant="body2">{zhCN.pages.history.label}</Typography>
              <Chip label={`${sosHistory.length} 条`} size="small" />
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography variant="body2">{zhCN.pages.contacts.label}</Typography>
              <Chip label={`${contacts.length} 人`} size="small" />
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography variant="body2">{zhCN.pages.tracking.label}</Typography>
              <Chip label={pc > 0 ? `${pc} ${zhCN.tracking.pending}` : '0'} size="small" />
            </Box>
          </Stack>


          <Alert severity="info" sx={{ mt: 2 }}>
            {zhCN.tools.diagnosticsPrivacy}
          </Alert>
          <Stack direction="row" spacing={1} mt={2} flexWrap="wrap" useFlexGap>
            <Button size="small" variant="outlined" startIcon={<DownloadIcon />} onClick={handleExportSnapshot}>
              {zhCN.tools.exportSnapshot}
            </Button>
            <Button size="small" variant="outlined" startIcon={<DownloadIcon />} onClick={handleExportDiagnostics}>
              {zhCN.tools.exportDiagnostics}
            </Button>
            <Button size="small" variant="outlined" startIcon={<UploadIcon />} onClick={handleImportSnapshot}>
              {zhCN.tools.importSnapshot}
            </Button>
            <Button size="small" variant="outlined" startIcon={<PersonAddIcon />} onClick={handleAddMockContact}>
              {zhCN.tools.mockContact}
            </Button>
            <Button size="small" variant="outlined" startIcon={<PinDropIcon />} onClick={handleWriteMockTracking}>
              {zhCN.tools.mockTracking}
            </Button>
            <Button size="small" variant="outlined" color="error" startIcon={<DeleteForeverIcon />} onClick={() => setShowClearDialog(true)}>
              {zhCN.tools.clearAll}
            </Button>
          </Stack>
        </CardContent>
      </Card>

      <Card variant="outlined" sx={{ borderRadius: 3 }}>
        <CardContent>
          <Typography variant="overline">{zhCN.tools.diagnosticsSummary}</Typography>
          <Box sx={{ mt: 1 }}>
            {currentDiagnosticSummary ? (
              <DiagnosticSummaryView summary={currentDiagnosticSummary} />
            ) : (
              <Typography variant="body2" color="text.secondary">{zhCN.tools.diagnosticsLoading}</Typography>
            )}
          </Box>
        </CardContent>
      </Card>


      <Card variant="outlined" sx={{ borderRadius: 3 }}>
        <CardContent>
          <Stack direction="row" justifyContent="space-between" alignItems="center" gap={1} flexWrap="wrap">
            <Typography variant="overline">最近定位自检</Typography>
            <Button size="small" variant="outlined" onClick={handleRunLocationSelfTest} disabled={locationSelfTesting}>
              {locationSelfTesting ? '定位自检中…' : '开始定位自检'}
            </Button>
          </Stack>
          <Box sx={{ mt: 1 }}>
            {locationSelfTest ? (
              <LocationSelfTestView report={locationSelfTest} />
            ) : (
              <Typography variant="body2" color="text.secondary">尚未运行定位自检。</Typography>
            )}
          </Box>
        </CardContent>
      </Card>
      <Card variant="outlined" sx={{ borderRadius: 3 }}>
        <CardContent>
          <Typography variant="overline">{zhCN.tools.parsedDiagnostics}</Typography>
          <Stack spacing={1.5} mt={1}>
            <TextField
              label={zhCN.tools.diagnosticJsonLabel}
              value={diagnosticJson}
              onChange={(e) => setDiagnosticJson(e.target.value)}
              multiline
              minRows={4}
              fullWidth
            />
            <Button size="small" variant="outlined" onClick={handleParseDiagnostics} sx={{ alignSelf: 'flex-start' }}>
              {zhCN.tools.parseDiagnostics}
            </Button>
            {diagnosticParseError && <Alert severity="error">{diagnosticParseError}</Alert>}
            {parsedDiagnosticSummary && <DiagnosticSummaryView summary={parsedDiagnosticSummary} />}
          </Stack>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={showClearDialog}
        title={zhCN.tools.clearAll}
        content="此操作将删除所有本地数据（配置、联系人、SOS 历史、轨迹），不可恢复。确定继续？"
        confirmLabel={zhCN.actions.confirm}
        onConfirm={handleClearAll}
        onCancel={() => setShowClearDialog(false)}
      />

      <Snackbar
        open={!!snackbarMsg}
        autoHideDuration={3000}
        onClose={() => setSnackbarMsg('')}
        message={snackbarMsg}
      />
    </Stack>
  )
}