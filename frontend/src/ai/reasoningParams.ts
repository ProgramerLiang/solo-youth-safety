/**
 * 推理/思考参数适配
 *
 * 策略：发送所有已知推理参数格式，端点报错后逐步减少
 * - reasoning_effort（OpenAI 格式）
 * - thinking + budget_tokens（Anthropic 格式）
 */

// 推理努力等级 → Anthropic thinking budget 映射
const EFFORT_TO_BUDGET: Record<string, number> = {
  low: 512,
  medium: 2048,
  high: 8192,
}

/** 一个参数组（一组同时发送或同时移除的 params） */
export interface ParamBundle {
  key: string            // 唯一标识（用于错误回溯和 UI 提示）
  label: string          // 显示用
  params: Record<string, unknown>  // 要注入请求体的参数
}

/**
 * 根据用户配置，构建所有可能的推理参数组
 * 调用方先全发，遇 400 再逐个移除
 */
export function buildAllBundles(
  reasoningEffort: string | undefined,
): ParamBundle[] {
  if (!reasoningEffort || reasoningEffort === 'off') return []

  const bundles: ParamBundle[] = []

  // 1. OpenAI format: reasoning_effort
  bundles.push({
    key: 'reasoning_effort',
    label: `reasoning_effort=${reasoningEffort}`,
    params: { reasoning_effort: reasoningEffort },
  })

  // 2. Anthropic format: thinking + budget_tokens
  const budget = EFFORT_TO_BUDGET[reasoningEffort] ?? 2048
  bundles.push({
    key: 'thinking',
    label: `thinking(budget=${budget})`,
    params: { thinking: { type: 'enabled', budget_tokens: budget } },
  })

  return bundles
}

/** 将所有 bundle 合并为一个平铺对象 */
export function mergeBundles(bundles: ParamBundle[]): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const b of bundles) {
    Object.assign(result, b.params)
  }
  return result
}

/** bundle 标签列表（用于 UI 提示） */
export function bundleLabels(bundles: ParamBundle[]): string {
  if (bundles.length === 0) return '未启用'
  return bundles.map((b) => b.label).join(' + ')
}

/**
 * 分析 400 错误，返回应移除的参数组 key（匹配的第一个）
 * 覆盖各种 API 错误格式
 */
export function findOffendingBundleKey(
  status: number,
  errorBody: unknown,
  activeBundles: ParamBundle[],
): string | null {
  if (status !== 400) return null

  const body = errorBody as Record<string, unknown> | undefined
  if (!body) return null

  const error = body.error as Record<string, unknown> | undefined
  if (!error) return null

  const message = typeof error.message === 'string' ? error.message : ''
  const code = typeof error.code === 'string' ? error.code : ''
  const type = typeof error.type === 'string' ? error.type : ''

  const combined = `${message} ${code} ${type}`.toLowerCase()

  // 按 bundle key 检查错误消息中是否提及该参数
  for (const bundle of activeBundles) {
    // 将 bundle key 转成错误消息中可能出现的模式
    const keyPatterns = bundle.key.split('_')
    for (const pat of keyPatterns) {
      if (combined.includes(pat.toLowerCase())) return bundle.key
    }
  }

  // 没有提及具体参数名，但匹配通用参数错误 → 移除第一个
  const genericPatterns = [
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
    /unrecognized.?param/,
    /unknown.?field/,
    /invalid.?field/,
    /unexpected.?field/,
  ]

  if (genericPatterns.some((p) => p.test(combined))) {
    // 移除第一个 bundle
    return activeBundles[0]?.key ?? null
  }

  return null
}