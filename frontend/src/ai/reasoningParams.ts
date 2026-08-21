/**
 * 推理/思考参数适配
 * 根据模型名称和用户选择的思考等级，自动选择正确的 API 参数格式
 */

// OpenAI 推理模型（支持 reasoning_effort）
const OPENAI_REASONING = /^(o[1-9]|o[1-9]-mini|o-mini)/i

// Anthropic Claude（支持 thinking 参数）
const ANTHROPIC_MODELS = /^claude/i

// DeepSeek（不支持推理参数，但流式响应含 reasoning_content）
const DEEPSEEK_MODELS = /^(deepseek|ds)/i

// 推理努力等级 → Anthropic thinking budget 映射
const EFFORT_TO_BUDGET: Record<string, number> = {
  low: 512,
  medium: 2048,
  high: 8192,
}

export interface ReasoningParamsResult {
  /** 是否附加了 reasoning 参数 */
  hasParams: boolean
  /** 参数说明（用于 UI 提示） */
  hint: string
  /** 要附加的参数对象（可能为空） */
  params: Record<string, unknown>
}

/**
 * 根据模型名和用户配置，生成合适的推理参数
 * @param reasoningEffort 用户设置的思考等级：'off' | 'low' | 'medium' | 'high' | undefined
 * @param model 模型名
 */
export function buildReasoningParams(
  reasoningEffort: string | undefined,
  model: string,
): ReasoningParamsResult {
  if (!reasoningEffort || reasoningEffort === 'off') {
    return { hasParams: false, hint: '未启用', params: {} }
  }

  const m = (model || '').trim()

  // Anthropic Claude → thinking 参数
  if (ANTHROPIC_MODELS.test(m)) {
    const budget = EFFORT_TO_BUDGET[reasoningEffort] ?? 2048
    return {
      hasParams: true,
      hint: `thinking (budget=${budget})`,
      params: { thinking: { type: 'enabled', budget_tokens: budget } },
    }
  }

  // DeepSeek → 不支持推理参数，但始终流式输出推理过程
  if (DEEPSEEK_MODELS.test(m)) {
    return {
      hasParams: false,
      hint: 'DeepSeek 模型不支持，自动忽略',
      params: {},
    }
  }

  // OpenAI 推理模型 → reasoning_effort
  if (OPENAI_REASONING.test(m)) {
    return {
      hasParams: true,
      hint: `reasoning_effort=${reasoningEffort}`,
      params: { reasoning_effort: reasoningEffort },
    }
  }

  // 未知模型 → 尝试 reasoning_effort（带 fallback）
  return {
    hasParams: true,
    hint: `reasoning_effort=${reasoningEffort}（不支持的模型会自动回退）`,
    params: { reasoning_effort: reasoningEffort },
  }
}

/**
 * 检查 400 错误是否与不支持的推理参数相关
 * 覆盖多种 API 格式的错误消息
 */
export function isReasoningParamError(status: number, errorBody: unknown): boolean {
  if (status !== 400) return false

  const body = errorBody as Record<string, unknown> | undefined
  if (!body) return false

  const error = body.error as Record<string, unknown> | undefined
  if (!error) return false

  const message = typeof error.message === 'string' ? error.message : ''
  const code = typeof error.code === 'string' ? error.code : ''
  const type = typeof error.type === 'string' ? error.type : ''

  const combined = `${message} ${code} ${type}`.toLowerCase()

  // 匹配各种 API 返回的不支持参数错误
  const patterns = [
    /reasoning_effort/,
    /unsupported.?param/,
    /unknown.?param/,
    /invalid.?param/,
    /param.*not.?support/,
    /not.?support.*param/,
    /param.*not.?found/,
    /param.*not.?exist/,
    /param.*invalid/,
    /param.*unknown/,
    /unexpected.?param/,
    /extra.?param/,
    /bad.?request.*param/,
  ]

  return patterns.some((p) => p.test(combined))
}