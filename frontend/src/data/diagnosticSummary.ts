import type { DiagnosticReport } from './diagnostics'

export type DiagnosticIssueLevel = 'ok' | 'attention' | 'warning'

export interface DiagnosticIssue {
  level: Exclude<DiagnosticIssueLevel, 'ok'>
  title: string
  detail: string
}

export interface DiagnosticFacts {
  appVersion: string
  exportedAt: string
  device: string
  locationProviders: string
  locationPermissions: string
  locationSelfTest: string
  lastLocationAttempt: string
  localTracking: string
  theme: string
  privacy: string
  safetyTrip: string
}

export interface DiagnosticSummary {
  level: DiagnosticIssueLevel
  facts: DiagnosticFacts
  issues: DiagnosticIssue[]
}

export interface ParsedDiagnosticReportOk {
  ok: true
  report: DiagnosticReport
  summary: DiagnosticSummary
}

export interface ParsedDiagnosticReportError {
  ok: false
  error: string
}

export type ParsedDiagnosticReport = ParsedDiagnosticReportOk | ParsedDiagnosticReportError

function boolLabel(value: boolean | null): string {
  if (value === true) return '开启'
  if (value === false) return '关闭'
  return '未知'
}

function deviceLabel(report: DiagnosticReport): string {
  const { brand, model, sdkInt } = report.location.device
  const name = [brand, model].filter(Boolean).join(' ') || '未知设备'
  return `${name} · Android SDK ${sdkInt ?? '未知'}`
}

function highestLevel(issues: DiagnosticIssue[]): DiagnosticIssueLevel {
  if (issues.some((issue) => issue.level === 'warning')) return 'warning'
  if (issues.some((issue) => issue.level === 'attention')) return 'attention'
  return 'ok'
}

function safetyTripLabel(report: DiagnosticReport): string {
  const trip = report.safetyTrip
  if (!trip) return '当前无行程 / 历史 0 条'
  if (!trip.hasCurrentTrip) return `当前无行程 / 历史 ${trip.historyCount} 条`
  return `当前 ${trip.currentStatus ?? 'unknown'} / 目的地 ${trip.destinationLength} 字 / 备注 ${trip.hasNote ? '有' : '无'} / 历史 ${trip.historyCount} 条`
}

function hasValidSchema(value: unknown): value is DiagnosticReport {
  if (!value || typeof value !== 'object') return false
  const candidate = value as { schemaVersion?: unknown; app?: unknown; location?: unknown; privacy?: unknown }
  return candidate.schemaVersion === 1 && !!candidate.app && !!candidate.location && !!candidate.privacy
}

function addPermissionIssues(report: DiagnosticReport, issues: DiagnosticIssue[]): void {
  const { fine, coarse } = report.location.permissions
  if (fine !== 'granted' && coarse !== 'granted') {
    issues.push({
      level: 'warning',
      title: '定位权限不可用',
      detail: '精确定位和粗略定位均不可用，请检查系统权限。',
    })
  } else if (fine !== 'granted') {
    issues.push({
      level: 'attention',
      title: '精确定位权限不可用',
      detail: '当前只能使用粗略定位，轨迹和围栏判断可能不稳定。',
    })
  }
}

function addProviderIssues(report: DiagnosticReport, issues: DiagnosticIssue[]): void {
  const { gps, network } = report.location.providers
  if (gps === false && network === false) {
    issues.push({
      level: 'warning',
      title: '系统定位 Provider 关闭',
      detail: 'GPS 和网络定位均不可用，请检查系统定位开关。',
    })
  } else if (gps === false) {
    issues.push({
      level: 'attention',
      title: 'GPS Provider 不可用',
      detail: 'GPS 定位不可用，室外定位精度可能下降。',
    })
  } else if (network === false) {
    issues.push({
      level: 'attention',
      title: 'Network Provider 不可用',
      detail: '网络定位不可用，室内或弱 GPS 环境可能定位较慢。',
    })
  }
}

function addDataIssues(report: DiagnosticReport, issues: DiagnosticIssue[]): void {
  const tracking = report.localData.tracking
  if (tracking.enabled && tracking.pendingCount >= 10) {
    issues.push({
      level: 'attention',
      title: '本地轨迹待确认较多',
      detail: `当前有 ${tracking.pendingCount} 条待确认轨迹，请检查是否需要本地确认或导出。`,
    })
  }
  if (report.localData.contacts.count === 0) {
    issues.push({
      level: 'warning',
      title: '未配置紧急联系人',
      detail: '联系人为空会降低 SOS 后续补救能力。',
    })
  }
  if (!report.config.hasCallNumber && !report.config.hasSmsNumber) {
    issues.push({
      level: 'warning',
      title: '紧急号码未配置',
      detail: '电话和短信号码都为空，SOS 只能记录本地状态。',
    })
  }
}

function addLocationAttemptIssues(report: DiagnosticReport, issues: DiagnosticIssue[]): void {
  const attempt = report.location.lastAttempt
  if (!attempt.success && attempt.error) {
    issues.push({
      level: 'warning',
      title: '最近定位失败',
      detail: `${attempt.strategy}: ${attempt.error}`,
    })
  }
}

export function summarizeDiagnosticReport(report: DiagnosticReport): DiagnosticSummary {
  const issues: DiagnosticIssue[] = []
  addPermissionIssues(report, issues)
  addProviderIssues(report, issues)
  addDataIssues(report, issues)
  addLocationAttemptIssues(report, issues)

  return {
    level: highestLevel(issues),
    facts: {
      appVersion: report.app.version,
      exportedAt: report.app.exportedAt,
      device: deviceLabel(report),
      locationProviders: `GPS ${boolLabel(report.location.providers.gps)} / Network ${boolLabel(report.location.providers.network)}`,
      locationPermissions: `精确 ${report.location.permissions.fine} / 粗略 ${report.location.permissions.coarse}`,
      locationSelfTest: report.location.selfTest ? report.location.selfTest.conclusion : '未运行',
      lastLocationAttempt: `${report.location.lastAttempt.strategy} / ${report.location.lastAttempt.success ? '成功' : '失败'}`,
      localTracking: `待确认 ${report.localData.tracking.pendingCount} / 队列 ${report.localData.tracking.queueCount} / 历史 ${report.localData.tracking.historyCount}`,
      safetyTrip: safetyTripLabel(report),
      theme: `${report.theme.mode} / ${report.theme.paletteMode} / ${report.theme.presetId ?? 'none'}`,
      privacy: report.privacy.manualExportOnly && !report.privacy.includesContactPhones && !report.privacy.includesExactCoordinates
        ? '手动导出 / 不含手机号 / 不含精确坐标'
        : '请检查隐私字段',
    },
    issues,
  }
}

export function parseDiagnosticReportJson(text: string): ParsedDiagnosticReport {
  try {
    const value: unknown = JSON.parse(text)
    if (!hasValidSchema(value)) return { ok: false, error: '诊断报告格式不受支持' }
    return { ok: true, report: value, summary: summarizeDiagnosticReport(value) }
  } catch {
    return { ok: false, error: '诊断报告不是有效 JSON' }
  }
}
