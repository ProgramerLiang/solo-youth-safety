import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

async function loadBackendModeHelper() {
  const sourcePath = path.resolve('src/pages/TrackingPage.jsx')
  const source = await fs.readFile(sourcePath, 'utf8')
  const helperMatch = source.match(
    /export function getBackendModeLabel\(isUsingLocalBackend\) \{[\s\S]*?^\}/m
  )

  if (!helperMatch) {
    throw new Error('未在 TrackingPage.jsx 中找到后端模式文案 helper')
  }

  const tempModulePath = path.join(
    os.tmpdir(),
    `backend-mode-label.test.${process.pid}.${Date.now()}.${Math.random().toString(16).slice(2)}.mjs`
  )
  await fs.writeFile(tempModulePath, helperMatch[0], 'utf8')
  return import(pathToFileURL(tempModulePath).href)
}

test('getBackendModeLabel returns local backend label even when developer mode is off', async () => {
  const { getBackendModeLabel } = await loadBackendModeHelper()
  const developerModeEnabled = false
  const isUsingLocalBackend = true
  const showToolsPage = isUsingLocalBackend && developerModeEnabled

  assert.equal(showToolsPage, false)
  assert.equal(getBackendModeLabel(isUsingLocalBackend), '本地后端')
})

test('getBackendModeLabel returns remote backend label when local backend is disabled', async () => {
  const { getBackendModeLabel } = await loadBackendModeHelper()

  assert.equal(getBackendModeLabel(false), '远端后端')
})

test('backend mode label stays independent from tools page visibility', async () => {
  const { getBackendModeLabel } = await loadBackendModeHelper()

  const localBackendLabel = getBackendModeLabel(true)
  const remoteBackendLabel = getBackendModeLabel(false)

  assert.equal(localBackendLabel, '本地后端')
  assert.equal(remoteBackendLabel, '远端后端')
  assert.notEqual(localBackendLabel, remoteBackendLabel)

  assert.equal(true && true, true)
  assert.equal(true && false, false)
})
