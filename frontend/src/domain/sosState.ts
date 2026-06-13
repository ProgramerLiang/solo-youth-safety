import type { SosResult, SosFinalStatus, SosStep } from '../types'

export type SosStepKey = 'location' | 'persistence' | 'sms' | 'call'

export function createInitialResult(): SosResult {
  const defaultStep = (): SosStep => ({ label: '等待中', badge: '-', detail: '', tone: 'idle' })
  return {
    stage: 'idle',
    steps: { location: defaultStep(), persistence: defaultStep(), sms: defaultStep(), call: defaultStep() },
    finalStatus: 'idle',
    finalLabel: '未触发',
    summary: '',
  }
}

export function updateStepTone(
  result: SosResult,
  key: SosStepKey,
  tone: SosStep['tone'],
  label: string,
  detail: string,
): SosResult {
  const badgeMap: Record<SosStep['tone'], string> = {
    idle: '-',
    success: '\u2713',
    warn: '\u26A0',
    danger: '\u2717',
  }
  return {
    ...result,
    steps: {
      ...result.steps,
      [key]: { ...result.steps[key], tone, label, detail, badge: badgeMap[tone] },
    },
  }
}

export function advanceStage(
  result: SosResult,
  stage: SosResult['stage'],
  summary: string,
): SosResult {
  return { ...result, stage, summary }
}

export function computeFinalStatus(result: SosResult): SosResult {
  const { location, persistence, sms, call } = result.steps

  const hasDanger = [location, persistence, sms, call].some(s => s.tone === 'danger' || s.tone === 'warn')
  const allSuccess = [location, persistence, sms, call].every(s => s.tone === 'success')

  let finalStatus: SosFinalStatus
  let finalLabel: string

  if (location.tone === 'danger') {
    finalStatus = 'location-failed'
    finalLabel = '定位失败'
  } else if (allSuccess) {
    finalStatus = 'success'
    finalLabel = '成功'
  } else if (sms.tone === 'danger' && call.tone === 'danger') {
    finalStatus = 'failed'
    finalLabel = '失败'
  } else if (hasDanger) {
    finalStatus = 'partial-success'
    finalLabel = '部分成功'
  } else {
    finalStatus = 'in-progress'
    finalLabel = '进行中'
  }

  return { ...result, finalStatus, finalLabel }
}
