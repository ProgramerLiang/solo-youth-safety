import { create } from 'zustand'
import { storage } from '../data/storage'

const CONFIG_KEY = 'safety_v2_ai_config'

export interface AiConfig {
  baseUrl: string
  key: string
  model: string
  enabled: boolean
}

interface AiConfigState {
  config: AiConfig
  loaded: boolean
  initialize: () => Promise<void>
  setConfig: (partial: Partial<AiConfig>) => Promise<void>
  toggle: () => void
}

const DEFAULT_CONFIG: AiConfig = {
  baseUrl: 'https://api.openai.com/v1',
  key: '',
  model: 'gpt-4o-mini',
  enabled: false,
}

export const useAiConfigStore = create<AiConfigState>((set, get) => ({
  config: { ...DEFAULT_CONFIG },
  loaded: false,

  initialize: async () => {
    const saved = await storage.getJson<Partial<AiConfig>>(CONFIG_KEY)
    set({
      config: { ...DEFAULT_CONFIG, ...saved },
      loaded: true,
    })
  },

  setConfig: async (partial) => {
    const next = { ...get().config, ...partial }
    set({ config: next })
    await storage.setJson(CONFIG_KEY, next)
  },

  toggle: () => {
    set((s) => ({ config: { ...s.config, enabled: !s.config.enabled } }))
  },
}))