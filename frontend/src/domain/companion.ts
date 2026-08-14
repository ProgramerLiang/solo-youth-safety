// AI 陪伴助手类型占位:本期不接入任何后端,仅预留类型契约供未来扩展。

export type CompanionStatus = 'idle' | 'thinking' | 'speaking' | 'disabled'

export interface CompanionMessage {
  id: string
  role: 'user' | 'companion'
  text: string
  timestamp: number
}

export interface CompanionState {
  status: CompanionStatus
  enabled: boolean
  messages: CompanionMessage[]
}