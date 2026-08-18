import { useConfigStore } from '../stores/useConfigStore'
import { useContactsStore } from '../stores/useContactsStore'
import { useTrackingStore } from '../stores/useTrackingStore'
import { useSafetyTripStore } from '../stores/useSafetyTripStore'
import { useGeofenceStore } from '../stores/useGeofenceStore'
import { useRuleEngineStore } from '../stores/useRuleEngineStore'
import { useSosStore } from '../stores/useSosStore'
import { aggregateRiskData } from '../domain/riskAssessment'
import { routeGeofenceEvents } from '../domain/geofence'

export function buildSystemPrompt(): string {
  const config = useConfigStore.getState()
  const contacts = useContactsStore.getState().list
  const tracking = useTrackingStore.getState()
  const trip = useSafetyTripStore.getState().current
  const zones = useGeofenceStore.getState().zones
  const rules = useRuleEngineStore.getState().rules
  const sosHistory = useSosStore.getState().history

  const trackingSummary = tracking.lastCapturedAt
    ? `${new Date(tracking.lastCapturedAt).toLocaleString('zh-CN')}`
    : '从未采样'

  const tripText = trip
    ? `${trip.destination} (${trip.status})`
    : '无进行中行程'

  const firedRules = rules.filter((r) => r.lastFiredAt).length

  const geofenceEvents = routeGeofenceEvents(zones, tracking.history)
  const risk = aggregateRiskData({
    points: tracking.history,
    sosHistory,
    config: { callNumber: config.callNumber, smsNumber: config.smsNumber },
    contacts,
    locationAgeMs: tracking.lastCapturedAt
      ? Date.now() - new Date(tracking.lastCapturedAt).getTime()
      : 999_999_999,
    geofenceEvents,
    riskRules: undefined,
    safetyTrip: trip ?? undefined,
  })

  return [
    '你是一个 AI 安全助手,运行在「独行青年安全守护」App 中。',
    `当前用户状态:`,
    `- 紧急电话: ${config.callNumber || '未配置'}`,
    `- 联系人: ${contacts.length} 人`,
    `- 轨迹状态: ${tracking.enabled ? '采集中' : '停止'}, 最后采样: ${trackingSummary}`,
    `- 安全行程: ${tripText}`,
    `- 围栏: ${zones.length} 个`,
    `- 智能规则: ${rules.length} 条, 最近触发: ${firedRules} 条`,
    `- 风险等级: ${risk.level}`,
    `- 最近 SOS: ${sosHistory.length} 条`,
    '',
    '你有以下工具可用:',
    '1. get_location - 获取当前位置',
    '2. get_sos_history - 查看最近 SOS 记录',
    '3. get_tracking_status - 查看轨迹状态',
    '4. get_contacts - 查看紧急联系人',
    '5. get_geofence_zones - 查看围栏区域',
    '6. get_safety_trip - 查看当前安全行程',
    '7. get_rules - 查看智能规则',
    '8. get_risk_summary - 查看风险摘要',
    '9. create_safety_trip - 创建安全行程(需确认)',
    '10. add_contact - 添加紧急联系人(需确认)',
    '11. enable_tracking - 开启轨迹采样(需确认)',
    '12. trigger_sos - 触发 SOS(需双重确认)',
    '',
    '注意:读取操作你直接执行。写入操作(创建行程/添加联系人/开启轨迹/触发SOS)你需要先告诉用户你的计划,',
    '执行时会弹出确认框。触发 SOS 是严肃操作,只在用户明确要求时执行。',
    '保持语气友好、简洁,使用中文。',
  ].join('\n')
}