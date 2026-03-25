export const defaultSmsTemplate = '[SOS] 用户{userId}触发报警，位置({lat},{lng}) 时间:{time}'
export const allowedSmsTemplateVariables = ['userId', 'deviceId', 'lat', 'lng', 'time']

function buildSupportedPlaceholdersText() {
  return allowedSmsTemplateVariables.map((item) => `{${item}}`).join(' ')
}

export function normalizeSmsTemplate(template, fallback = defaultSmsTemplate) {
  return typeof template === 'string' && template.trim() ? template : fallback
}

export function getSmsTemplateValidationError(template) {
  const normalized = normalizeSmsTemplate(template)

  for (let index = 0; index < normalized.length; index += 1) {
    const char = normalized[index]
    if (char === '}') {
      return '短信模板存在未匹配的 }'
    }
    if (char !== '{') {
      continue
    }

    const end = normalized.indexOf('}', index + 1)
    if (end === -1) {
      return '短信模板存在未闭合的 {'
    }

    const fieldName = normalized.slice(index + 1, end).trim()
    if (!allowedSmsTemplateVariables.includes(fieldName)) {
      return `短信模板包含不支持的占位符：{${fieldName || '?'}}，仅支持 ${buildSupportedPlaceholdersText()}`
    }

    index = end
  }

  return ''
}

export function validateSmsTemplate(template) {
  const normalized = normalizeSmsTemplate(template)
  const error = getSmsTemplateValidationError(normalized)
  if (error) {
    throw new Error(error)
  }
  return normalized
}

function resolveTemplateValue(fieldName, payload) {
  switch (fieldName) {
    case 'userId':
      return String(payload?.userId ?? 'unknown')
    case 'deviceId':
      return String(payload?.deviceId ?? 'unknown')
    case 'lat':
      return String(payload?.location?.lat ?? 'unknown')
    case 'lng':
      return String(payload?.location?.lng ?? 'unknown')
    case 'time':
      return String(payload?.timestamp ?? 'unknown')
    default:
      return ''
  }
}

export function renderSmsTemplate(template, payload) {
  return allowedSmsTemplateVariables.reduce(
    (text, fieldName) =>
      text.replaceAll(`{${fieldName}}`, resolveTemplateValue(fieldName, payload)),
    normalizeSmsTemplate(template)
  )
}
