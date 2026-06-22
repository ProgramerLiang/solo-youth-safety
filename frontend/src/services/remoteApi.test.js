import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

async function loadRemoteApiModule() {
  const sourcePath = path.resolve('src/services/remoteApi.js')
  const source = await fs.readFile(sourcePath, 'utf8')
  const patchedSource = source.replace(
    "import { apiBasePath, apiToken } from '../config.js'",
    "const apiBasePath = 'http://api.test/api/v1'\nconst apiToken = ''",
  )
  const tempModulePath = path.join(
    os.tmpdir(),
    `remoteApi.test.${process.pid}.${Date.now()}.${Math.random().toString(16).slice(2)}.mjs`,
  )
  await fs.writeFile(tempModulePath, patchedSource, 'utf8')
  return import(pathToFileURL(tempModulePath).href)
}

test('request 在 204/205 或空响应体时返回 null', async () => {
  const { request } = await loadRemoteApiModule()

  globalThis.fetch = async () => new Response(null, { status: 204 })
  await assert.doesNotReject(async () => {
    const result = await request('/empty')
    assert.equal(result, null)
  })

  globalThis.fetch = async () =>
    new Response('', {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  const emptyJsonResult = await request('/empty-json')
  assert.equal(emptyJsonResult, null)
})

test('request 在 JSON 成功响应时继续返回对象', async () => {
  const { request } = await loadRemoteApiModule()

  globalThis.fetch = async () =>
    new Response(JSON.stringify({ ok: true, source: 'json' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    })

  const result = await request('/health')
  assert.deepEqual(result, { ok: true, source: 'json' })
})

test('request 在非 JSON 成功响应时返回原始文本', async () => {
  const { request } = await loadRemoteApiModule()

  globalThis.fetch = async () =>
    new Response('accepted', {
      status: 202,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    })

  const result = await request('/plain-text')
  assert.equal(result, 'accepted')
})
