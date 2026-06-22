import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

async function loadAppLoadHelpers() {
  const sourcePath = path.resolve('src/App.jsx')
  const source = await fs.readFile(sourcePath, 'utf8')
  const helperMatch = source.match(
    /export async function settleUserScopedLoadsWithTasks\(tasks\) \{[\s\S]*?^export function buildScopedLoadFailureText\(prefix, failures\) \{[\s\S]*?^\}/m
  )

  if (!helperMatch) {
    throw new Error('未在 App.jsx 中找到用户作用域加载降级 helper')
  }

  const tempModulePath = path.join(
    os.tmpdir(),
    `app-load-failure.test.${process.pid}.${Date.now()}.${Math.random().toString(16).slice(2)}.mjs`
  )
  await fs.writeFile(tempModulePath, helperMatch[0], 'utf8')
  return import(pathToFileURL(tempModulePath).href)
}

test('settleUserScopedLoadsWithTasks 在部分失败时汇总错误且保留成功结果', async () => {
  const { settleUserScopedLoadsWithTasks, buildScopedLoadFailureText } = await loadAppLoadHelpers()
  const calls = []

  const result = await settleUserScopedLoadsWithTasks([
    {
      key: 'localPanel',
      label: '本地面板',
      async run() {
        calls.push('localPanel')
        return { ok: true }
      },
    },
    {
      key: 'contacts',
      label: '联系人',
      async run() {
        calls.push('contacts')
        throw new Error('contacts exploded')
      },
    },
    {
      key: 'sos',
      label: 'SOS 历史',
      async run() {
        calls.push('sos')
        throw new Error('sos timeout')
      },
    },
  ])

  assert.deepEqual(calls, ['localPanel', 'contacts', 'sos'])
  assert.equal(result.ok, false)
  assert.deepEqual(result.failures, [
    { key: 'contacts', label: '联系人', message: 'contacts exploded' },
    { key: 'sos', label: 'SOS 历史', message: 'sos timeout' },
  ])
  assert.equal(
    buildScopedLoadFailureText('初始化完成，但部分数据加载失败', result.failures),
    '初始化完成，但部分数据加载失败：联系人（contacts exploded）；SOS 历史（sos timeout）'
  )
})

test('settleUserScopedLoadsWithTasks 在全部成功时返回 ok 且不生成错误文案', async () => {
  const { settleUserScopedLoadsWithTasks, buildScopedLoadFailureText } = await loadAppLoadHelpers()

  const result = await settleUserScopedLoadsWithTasks([
    { key: 'localPanel', label: '本地面板', run: async () => ({ count: 1 }) },
    { key: 'contacts', label: '联系人', run: async () => ({ contacts: [] }) },
  ])

  assert.deepEqual(result, { ok: true, failures: [] })
  assert.equal(buildScopedLoadFailureText('已切换用户，但刷新失败', result.failures), '')
})

test('settleUserScopedLoadsWithTasks 会将非 Error rejection 显式转成字符串消息', async () => {
  const { settleUserScopedLoadsWithTasks } = await loadAppLoadHelpers()

  const result = await settleUserScopedLoadsWithTasks([
    {
      key: 'contacts',
      label: '联系人',
      async run() {
        throw 'network down'
      },
    },
  ])

  assert.equal(result.ok, false)
  assert.deepEqual(result.failures, [{ key: 'contacts', label: '联系人', message: 'network down' }])
})
