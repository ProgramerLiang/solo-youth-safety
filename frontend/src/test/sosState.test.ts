import { describe, it, expect } from 'vitest'
import {
  createInitialResult,
  updateStepTone,
  computeFinalStatus,
  createSimulationResult,
} from '../domain/sosState'

describe('sosState', () => {
  it('createInitialResult returns idle result', () => {
    const result = createInitialResult()
    expect(result.stage).toBe('idle')
    expect(result.finalStatus).toBe('idle')
    expect(result.steps.location.tone).toBe('idle')
    expect(result.steps.call.tone).toBe('idle')
    expect(result.steps.sms.tone).toBe('idle')
    expect(result.steps.persistence.tone).toBe('idle')
  })

  it('updateStepTone sets tone for a specific step', () => {
    const result = createInitialResult()
    const updated = updateStepTone(result, 'location', 'success', '已获取位置', 'GPS 精度 10m')
    expect(updated.steps.location.tone).toBe('success')
    expect(updated.steps.location.label).toBe('已获取位置')
    expect(updated.steps.location.detail).toBe('GPS 精度 10m')
    expect(updated.steps.call.tone).toBe('idle')
  })

  it('computeFinalStatus: all success', () => {
    const result = createInitialResult()
    const r1 = updateStepTone(result, 'location', 'success', '', '')
    const r2 = updateStepTone(r1, 'persistence', 'success', '', '')
    const r3 = updateStepTone(r2, 'sms', 'success', '', '')
    const r4 = updateStepTone(r3, 'call', 'success', '', '')
    const final = computeFinalStatus(r4)
    expect(final.finalStatus).toBe('success')
  })

  it('computeFinalStatus: partial success when some steps fail', () => {
    let result = createInitialResult()
    result = updateStepTone(result, 'location', 'success', '', '')
    result = updateStepTone(result, 'persistence', 'success', '', '')
    result = updateStepTone(result, 'sms', 'success', '', '')
    result = updateStepTone(result, 'call', 'danger', '拨号失败', '无权限')
    const final = computeFinalStatus(result)
    expect(final.finalStatus).toBe('partial-success')
  })

  it('computeFinalStatus: failed when sms+call both fail and location not danger', () => {
    let result = createInitialResult()
    result = updateStepTone(result, 'location', 'warn', '', '')
    result = updateStepTone(result, 'persistence', 'danger', '', '')
    result = updateStepTone(result, 'sms', 'danger', '', '')
    result = updateStepTone(result, 'call', 'danger', '', '')
    const final = computeFinalStatus(result)
    expect(final.finalStatus).toBe('failed')
  })

  it('computeFinalStatus: location-failed when location is danger', () => {
    let result = createInitialResult()
    result = updateStepTone(result, 'location', 'danger', '定位失败', '')
    result = updateStepTone(result, 'persistence', 'success', '', '')
    result = updateStepTone(result, 'sms', 'success', '', '')
    result = updateStepTone(result, 'call', 'success', '', '')
    const final = computeFinalStatus(result)
    expect(final.finalStatus).toBe('location-failed')
  })

  it('createSimulationResult returns training-mode result', () => {
    const result = createSimulationResult()
    expect(result.finalLabel).toBe('训练完成')
    expect(result.finalStatus).toBe('success')
    expect(result.summary).toContain('模拟训练')
    expect(result.steps.location.label).toContain('训练模式')
    expect(result.steps.sms.detail).toContain('未发送')
    expect(result.steps.call.detail).toContain('未拨打')
  })
})