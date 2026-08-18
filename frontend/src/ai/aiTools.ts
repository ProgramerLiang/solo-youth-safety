import { getCurrentPosition } from '../data/locationProvider'
import { useContactsStore } from '../stores/useContactsStore'
import { useSosStore } from '../stores/useSosStore'
import { useTrackingStore } from '../stores/useTrackingStore'
import { useGeofenceStore } from '../stores/useGeofenceStore'
import { useSafetyTripStore } from '../stores/useSafetyTripStore'
import { useRuleEngineStore } from '../stores/useRuleEngineStore'
import { useConfigStore } from '../stores/useConfigStore'
import { aggregateRiskData } from '../domain/riskAssessment'
import { routeGeofenceEvents } from '../domain/geofence'

interface ToolFunction {
  name: string
  description: string
  parameters: Record<string, unknown>
}

interface ToolDefinition {
  type: 'function'
  function: ToolFunction
}

export const TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    type: 'function',
    function: {
      name: 'get_location',
      description: '获取用户当前地理位置(经纬度和精度)',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_sos_history',
      description: '查看最近 5 条 SOS 记录',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_tracking_status',
      description: '查看轨迹采样状态:是否启用、最后采样时间、历史点数量',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_contacts',
      description: '查看紧急联系人列表',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_geofence_zones',
      description: '查看已设置的围栏区域列表',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_safety_trip',
      description: '查看当前安全行程:目的地、状态、超时情况',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_rules',
      description: '查看智能规则列表:名称、启用状态、最后触发时间',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_risk_summary',
      description: '查看风险摘要:等级、风险项数量',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_safety_trip',
      description: '创建安全行程(需用户确认)',
      parameters: {
        type: 'object',
        properties: {
          destination: { type: 'string', description: '目的地名称' },
          durationMinutes: { type: 'number', description: '预计时长(分钟 5-240)' },
          note: { type: 'string', description: '备注(可选)', nullable: true },
        },
        required: ['destination', 'durationMinutes'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'add_contact',
      description: '添加紧急联系人(需用户确认)',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: '联系人姓名' },
          phone: { type: 'string', description: '手机号码' },
        },
        required: ['name', 'phone'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'enable_tracking',
      description: '开启周期轨迹采样(需用户确认)',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'trigger_sos',
      description: '触发 SOS(需双重确认)',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
]

export const TOOL_PERMISSIONS: Record<string, 'read' | 'write'> = {
  get_location: 'read',
  get_sos_history: 'read',
  get_tracking_status: 'read',
  get_contacts: 'read',
  get_geofence_zones: 'read',
  get_safety_trip: 'read',
  get_rules: 'read',
  get_risk_summary: 'read',
  create_safety_trip: 'write',
  add_contact: 'write',
  enable_tracking: 'write',
  trigger_sos: 'write',
}

export type ToolResultSuccess = Record<string, unknown> & { __needs_confirmation?: boolean }

export async function runTool(name: string, args: Record<string, unknown>): Promise<ToolResultSuccess | { error: string }> {
  switch (name) {
    case 'get_location': {
      const pos = await getCurrentPosition()
      if (!pos) return { error: '无法获取当前位置,请检查定位权限和 GPS 状态' }
      return { lat: pos.lat, lng: pos.lng, accuracy: pos.accuracy }
    }
    case 'get_sos_history': {
      const h = useSosStore.getState().history
      const recent = h.slice(-5).map((r) => ({
        time: r.triggeredAt ? new Date(r.triggeredAt).toLocaleString('zh-CN') : '未知',
        status: r.finalLabel,
        detail: r.summary,
      }))
      return { records: recent }
    }
    case 'get_tracking_status': {
      const s = useTrackingStore.getState()
      return {
        enabled: s.enabled,
        lastCapturedAt: s.lastCapturedAt ? new Date(s.lastCapturedAt).toLocaleString('zh-CN') : null,
        totalPoints: s.history.length,
        pendingCount: s.pendingCount,
      }
    }
    case 'get_contacts': {
      const list = useContactsStore.getState().list
      return { contacts: list.map((c) => ({ id: c.id, name: c.name, phone: c.phone })) }
    }
    case 'get_geofence_zones': {
      const zones = useGeofenceStore.getState().zones
      return { zones: zones.map((z) => ({ id: z.id, label: z.label, lat: z.lat, lng: z.lng, radiusM: z.radiusM })) }
    }
    case 'get_safety_trip': {
      const trip = useSafetyTripStore.getState().current
      if (!trip) return { trip: null, message: '无进行中行程' }
      return {
        trip: {
          destination: trip.destination,
          status: trip.status,
          expectedArrivalAt: new Date(trip.expectedArrivalAt).toLocaleString('zh-CN'),
        },
      }
    }
    case 'get_rules': {
      const rules = useRuleEngineStore.getState().rules
      return {
        rules: rules.map((r) => ({
          name: r.name,
          enabled: r.enabled,
          lastFiredAt: r.lastFiredAt ? new Date(r.lastFiredAt).toLocaleString('zh-CN') : null,
        })),
      }
    }
    case 'get_risk_summary': {
      const config = useConfigStore.getState()
      const contacts = useContactsStore.getState().list
      const tracking = useTrackingStore.getState()
      const sosHistory = useSosStore.getState().history
      const zones = useGeofenceStore.getState().zones
      const geofenceEvents = routeGeofenceEvents(zones, tracking.history)
      const report = aggregateRiskData({
        points: tracking.history,
        sosHistory,
        config: { callNumber: config.callNumber, smsNumber: config.smsNumber },
        contacts,
        locationAgeMs: tracking.lastCapturedAt ? Date.now() - new Date(tracking.lastCapturedAt).getTime() : 999_999_999,
        geofenceEvents,
        riskRules: undefined,
        safetyTrip: useSafetyTripStore.getState().current ?? undefined,
      })
      return { level: report.level, totalItems: report.items.length }
    }
    case 'create_safety_trip':
    case 'add_contact':
    case 'enable_tracking':
    case 'trigger_sos':
      return { __needs_confirmation: true, tool: name, args }
    default:
      return { error: `未知工具: ${name}` }
  }
}