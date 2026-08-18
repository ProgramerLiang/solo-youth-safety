export type HomeSlotKey =
  | 'safetyTrip'
  | 'contacts'
  | 'trackingFreshness'
  | 'smartRisk'
  | 'recentSos'
  | 'geofence'
  | 'membership'
  | 'aiAssistant'

export interface HomeSlotCandidate {
  key: HomeSlotKey
  label: string
}

export const HOME_SLOT_CANDIDATES: HomeSlotCandidate[] = [
  { key: 'safetyTrip', label: '安全行程' },
  { key: 'contacts', label: '紧急联系人' },
  { key: 'trackingFreshness', label: '轨迹新鲜度' },
  { key: 'smartRisk', label: '智能风险提示' },
  { key: 'recentSos', label: '最近 SOS' },
  { key: 'geofence', label: '围栏状态' },
  { key: 'membership', label: '会员权益' },
  { key: 'aiAssistant', label: 'AI 陪伴助手' },
]

export const DEFAULT_HOME_SLOTS: HomeSlotKey[] = [
  'safetyTrip',
  'contacts',
  'trackingFreshness',
  'smartRisk',
]

export interface HomeLayout {
  slots: HomeSlotKey[]
  companionEnabled: boolean
}