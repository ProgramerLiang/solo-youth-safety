import assert from 'node:assert/strict'
import test from 'node:test'

import {
  defaultSmsTemplate,
  getSmsTemplateValidationError,
  normalizeSmsTemplate,
  renderSmsTemplate,
  validateSmsTemplate,
} from './template.js'

test('normalizeSmsTemplate 在空字符串时回退默认模板', () => {
  assert.equal(normalizeSmsTemplate(''), defaultSmsTemplate)
  assert.equal(normalizeSmsTemplate('   '), defaultSmsTemplate)
})

test('getSmsTemplateValidationError 能识别未知占位符', () => {
  const error = getSmsTemplateValidationError('[SOS]{userId} {foo}')
  assert.match(error, /不支持的占位符/)
  assert.match(error, /\{foo\}/)
})

test('validateSmsTemplate 会拒绝未闭合的花括号', () => {
  assert.throws(() => validateSmsTemplate('[SOS]{userId'), /未闭合的 \{/)
})

test('renderSmsTemplate 会替换全部支持的占位符', () => {
  const result = renderSmsTemplate(
    '[SOS]{userId}|{deviceId}|{lat}|{lng}|{time}',
    {
      userId: 'u_test',
      deviceId: 'd_test',
      location: { lat: 31.23, lng: 121.47 },
      timestamp: '2026-03-24T12:00:00Z',
    }
  )

  assert.equal(result, '[SOS]u_test|d_test|31.23|121.47|2026-03-24T12:00:00Z')
})

test('renderSmsTemplate 在缺失字段时使用 unknown 占位', () => {
  const result = renderSmsTemplate('[SOS]{userId}|{lat}|{time}', { userId: 'u_only' })
  assert.equal(result, '[SOS]u_only|unknown|unknown')
})
