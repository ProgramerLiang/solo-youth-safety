import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

import { __resetStorageStateForTests } from './storage.js'

function createLocalStorageMock() {
  const store = new Map()
  return {
    getItem(key) {
      return store.has(key) ? store.get(key) : null
    },
    setItem(key, value) {
      store.set(key, String(value))
    },
    removeItem(key) {
      store.delete(key)
    },
    clear() {
      store.clear()
    },
  }
}

async function loadApiModule() {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'api-test-'))
  const sourcePath = path.resolve('src/api.js')
  const source = await fs.readFile(sourcePath, 'utf8')

  const identityModulePath = path.join(tempDir, 'identity.mock.mjs')
  await fs.writeFile(
    identityModulePath,
    "export function getPersistedIdentity() { return { userId: 'u_test', deviceId: 'd_test' } }\n",
    'utf8',
  )

  const nativeActionsModulePath = path.join(tempDir, 'nativeActions.mock.mjs')
  await fs.writeFile(nativeActionsModulePath, "export function isNativePlatform() { return false }\n", 'utf8')

  const configModulePath = path.join(tempDir, 'config.mock.mjs')
  await fs.writeFile(configModulePath, "export const apiBasePath = ''\n", 'utf8')

  const remoteApiModulePath = path.join(tempDir, 'remoteApi.mock.mjs')
  await fs.writeFile(
    remoteApiModulePath,
    "export function createRemoteApi() { return { getTrackingTimeline() { throw new Error('remote api should not be used in local mode') } } }\n",
    'utf8',
  )

  const replacements = [
    ['./identity.js', pathToFileURL(identityModulePath).href],
    ['./nativeActions.js', pathToFileURL(nativeActionsModulePath).href],
    ['./storage.js', pathToFileURL(path.resolve('src/storage.js')).href],
    ['./config.js', pathToFileURL(configModulePath).href],
    ['./services/localBackend.js', pathToFileURL(path.resolve('src/services/localBackend.js')).href],
    ['./services/remoteApi.js', pathToFileURL(remoteApiModulePath).href],
  ]

  const patchedSource = replacements.reduce(
    (content, [specifier, moduleUrl]) => content.replace(`'${specifier}'`, `'${moduleUrl}'`),
    source,
  )

  const tempModulePath = path.join(tempDir, 'api.test.mjs')
  await fs.writeFile(tempModulePath, patchedSource, 'utf8')
  return import(pathToFileURL(tempModulePath).href)
}

async function loadBackendModeLabelHelper() {
  const sourcePath = path.resolve('src/pages/TrackingPage.jsx')
  const source = await fs.readFile(sourcePath, 'utf8')
  const helperMatch = source.match(
    /export function getBackendModeLabel\(isUsingLocalBackend\) \{[\s\S]*?^\}/m,
  )

  if (!helperMatch) {
    throw new Error('未在 TrackingPage.jsx 中找到 getBackendModeLabel helper')
  }

  const tempModulePath = path.join(
    os.tmpdir(),
    `backend-mode-label.test.${process.pid}.${Date.now()}.${Math.random().toString(16).slice(2)}.mjs`
  )
  await fs.writeFile(tempModulePath, helperMatch[0], 'utf8')
  return import(pathToFileURL(tempModulePath).href)
}

test('api getTrackingTimeline uses shared object payload shape in local mode', { concurrency: false }, async () => {
  const previousLocalStorage = globalThis.localStorage
  globalThis.localStorage = createLocalStorageMock()
  globalThis.localStorage.setItem('safety_force_local_backend', '1')
  __resetStorageStateForTests({ driver: 'localStorage' })

  try {
    const api = await loadApiModule()

    await api.createTrackingPoints({
      userId: 'u_test',
      deviceId: 'd_test',
      points: [
        {
          lat: 31.23,
          lng: 121.47,
          accuracy: 12,
          speed: 0,
          heading: 0,
          timestamp: '2026-03-25T08:00:00.000Z',
        },
      ],
    })

    const timeline = await api.getTrackingTimeline({
      userId: 'u_test',
      from: '2026-03-25T07:00:00.000Z',
      to: '2026-03-25T09:00:00.000Z',
    })

    assert.equal(api.isLocalBackendMode(), true)
    assert.equal(timeline.userId, 'u_test')
    assert.equal(timeline.count, 1)
    assert.equal(timeline.points.length, 1)
    assert.equal(timeline.points[0].timestamp, '2026-03-25T08:00:00.000Z')
  } finally {
    __resetStorageStateForTests({ driver: 'localStorage' })
    if (previousLocalStorage === undefined) {
      delete globalThis.localStorage
    } else {
      globalThis.localStorage = previousLocalStorage
    }
  }
})

test('getBackendModeLabel 仅由真实后端模式决定，不受工具页可见性影响', async () => {
  const { getBackendModeLabel } = await loadBackendModeLabelHelper()
  const developerModeEnabled = false
  const showToolsPage = false
  const isUsingLocalBackend = true

  assert.equal(showToolsPage, false)
  assert.equal(developerModeEnabled, false)
  assert.equal(getBackendModeLabel(isUsingLocalBackend), '本地后端')
  assert.equal(getBackendModeLabel(false), '远端后端')
})
