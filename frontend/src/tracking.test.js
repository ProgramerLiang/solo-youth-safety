import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

import { __resetStorageStateForTests, readStoredJson } from './storage.js'

function createPoint(index) {
  return {
    lat: 31.23 + index * 0.0001,
    lng: 121.47 + index * 0.0001,
    accuracy: 12,
    speed: 0,
    heading: 0,
    timestamp: new Date(Date.UTC(2026, 2, 25, 8, 0, index)).toISOString(),
  }
}

async function loadTrackingModule() {
  const sourcePath = path.resolve('src/tracking.js')
  const storageModuleUrl = pathToFileURL(path.resolve('src/storage.js')).href
  const source = await fs.readFile(sourcePath, 'utf8')
  const patchedSource = source.replace(
    "import { readStoredJson, writeStoredJson } from './storage'",
    `import { readStoredJson, writeStoredJson } from '${storageModuleUrl}'`,
  )
  const tempModulePath = path.join(
    os.tmpdir(),
    `tracking.test.${process.pid}.${Date.now()}.${Math.random().toString(16).slice(2)}.mjs`,
  )
  await fs.writeFile(tempModulePath, patchedSource, 'utf8')
  return import(pathToFileURL(tempModulePath).href)
}

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
  }
}

function installFixedDate(isoString) {
  const RealDate = Date
  const fixedTime = new RealDate(isoString).getTime()

  class FixedDate extends RealDate {
    constructor(value) {
      super(value ?? fixedTime)
    }

    static now() {
      return fixedTime
    }
  }

  globalThis.Date = FixedDate
  return () => {
    globalThis.Date = RealDate
  }
}

function createPendingPoint(index, overrides = {}) {
  const minute = String(index % 60).padStart(2, '0')
  return {
    id: `pending_${index}`,
    userId: 'user-1',
    deviceId: 'device-1',
    point: {
      lat: 30 + index / 1000,
      lng: 120 + index / 1000,
      accuracy: 12,
      speed: 0,
      heading: 0,
      timestamp: `2026-03-25T08:${minute}:00.000Z`,
    },
    reason: 'periodic',
    createdAt: `2026-03-25T08:${minute}:00.000Z`,
    availableAt: `2026-03-25T08:${minute}:00.000Z`,
    attempts: 0,
    lastError: '',
    ...overrides,
  }
}

test('enqueueTrackingPoint 在队列超上限时仅保留最新的 240 条', { concurrency: false }, async () => {
  const { enqueueTrackingPoint, trackingStateKey } = await loadTrackingModule()
  const previousLocalStorage = globalThis.localStorage
  globalThis.localStorage = createLocalStorageMock()
  __resetStorageStateForTests({ driver: 'localStorage' })

  try {
    const pendingPoints = Array.from({ length: 240 }, (_, index) => createPendingPoint(index))
    globalThis.localStorage.setItem(
      trackingStateKey,
      JSON.stringify({
        preferences: { enabled: true, intervalSeconds: 60 },
        pendingPoints,
        statsByUser: {
          'user-1': {
            lastCapturedAt: '2026-03-25T08:59:00.000Z',
            lastSyncedAt: null,
            lastAttemptAt: null,
            lastError: '',
            lastErrorAt: null,
            totalCaptured: 240,
            totalSynced: 0,
          },
        },
      })
    )

    const snapshot = await enqueueTrackingPoint({
      userId: 'user-1',
      deviceId: 'device-1',
      point: {
        lat: 31.23,
        lng: 121.47,
        accuracy: 8,
        speed: 0,
        heading: 0,
        timestamp: '2026-03-25T09:00:00.000Z',
      },
    })

    const storedState = readStoredJson(trackingStateKey)
    assert.equal(snapshot.pendingCount, 240)
    assert.equal(storedState.pendingPoints.length, 240)
    assert.equal(storedState.pendingPoints.some((item) => item.id === 'pending_0'), false)
    assert.equal(storedState.pendingPoints.at(-1).point.timestamp, '2026-03-25T09:00:00.000Z')
    assert.equal(storedState.statsByUser['user-1'].totalCaptured, 241)
  } finally {
    if (previousLocalStorage === undefined) {
      delete globalThis.localStorage
    } else {
      globalThis.localStorage = previousLocalStorage
    }
    __resetStorageStateForTests()
  }
})

test('flushPendingTracking 在发送失败时按退避策略更新 attempts 与 availableAt', { concurrency: false }, async () => {
  const { flushPendingTracking, getTrackingSnapshot, trackingStateKey } = await loadTrackingModule()
  const previousLocalStorage = globalThis.localStorage
  const restoreDate = installFixedDate('2026-03-25T10:00:00.000Z')
  globalThis.localStorage = createLocalStorageMock()
  __resetStorageStateForTests({ driver: 'localStorage' })

  try {
    globalThis.localStorage.setItem(
      trackingStateKey,
      JSON.stringify({
        preferences: { enabled: true, intervalSeconds: 60 },
        pendingPoints: [
          createPendingPoint(1, {
            id: 'retry_me',
            createdAt: '2026-03-25T09:50:00.000Z',
            availableAt: '2026-03-25T09:50:00.000Z',
          }),
        ],
        statsByUser: {
          'user-1': {
            lastCapturedAt: '2026-03-25T09:50:00.000Z',
            lastSyncedAt: null,
            lastAttemptAt: null,
            lastError: '',
            lastErrorAt: null,
            totalCaptured: 1,
            totalSynced: 0,
          },
        },
      })
    )

    const result = await flushPendingTracking(async () => {
      throw new Error('network down')
    }, { userId: 'user-1' })

    const storedState = readStoredJson(trackingStateKey)
    const retriedPoint = storedState.pendingPoints[0]
    const userStats = storedState.statsByUser['user-1']
    const snapshot = getTrackingSnapshot('user-1')

    assert.equal(result.sentCount, 0)
    assert.equal(result.error, 'network down')
    assert.equal(retriedPoint.attempts, 1)
    assert.equal(retriedPoint.lastError, 'network down')
    assert.equal(retriedPoint.availableAt, '2026-03-25T10:00:15.000Z')
    assert.equal(userStats.lastAttemptAt, '2026-03-25T10:00:00.000Z')
    assert.equal(userStats.lastError, 'network down')
    assert.equal(userStats.lastErrorAt, '2026-03-25T10:00:00.000Z')
    assert.equal(snapshot.nextRetryAt, '2026-03-25T10:00:15.000Z')
    assert.equal(snapshot.pendingCount, 1)
  } finally {
    restoreDate()
    if (previousLocalStorage === undefined) {
      delete globalThis.localStorage
    } else {
      globalThis.localStorage = previousLocalStorage
    }
    __resetStorageStateForTests()
  }
})

test('enqueueTrackingPoint 在队列超上限时会记录丢弃告警与累计数量', { concurrency: false }, async () => {
  const { enqueueTrackingPoint, getTrackingSnapshot } = await loadTrackingModule()
  const previousLocalStorage = globalThis.localStorage
  globalThis.localStorage = createLocalStorageMock()
  __resetStorageStateForTests({ driver: 'localStorage' })

  try {
    for (let index = 0; index < 241; index += 1) {
      await enqueueTrackingPoint({
        userId: 'user-overflow',
        deviceId: 'device-a',
        point: createPoint(index),
      })
    }

    const snapshot = getTrackingSnapshot('user-overflow')
    assert.equal(snapshot.pendingCount, 240)
    assert.equal(snapshot.droppedCount, 1)
    assert.equal(snapshot.totalDropped, 1)
    assert.equal(typeof snapshot.lastDroppedAt, 'string')
    assert.match(snapshot.lastError, /轨迹队列已满/)
  } finally {
    if (previousLocalStorage === undefined) {
      delete globalThis.localStorage
    } else {
      globalThis.localStorage = previousLocalStorage
    }
    __resetStorageStateForTests()
  }
})

test('队列截断跨用户发生时会把丢失计数记到被丢弃用户', { concurrency: false }, async () => {
  const { enqueueTrackingPoint, getTrackingSnapshot } = await loadTrackingModule()
  const previousLocalStorage = globalThis.localStorage
  globalThis.localStorage = createLocalStorageMock()
  __resetStorageStateForTests({ driver: 'localStorage' })

  try {
    for (let index = 0; index < 240; index += 1) {
      await enqueueTrackingPoint({
        userId: index === 0 ? 'user-a' : 'user-b',
        deviceId: 'device-a',
        point: createPoint(index),
      })
    }

    await enqueueTrackingPoint({
      userId: 'user-b',
      deviceId: 'device-a',
      point: createPoint(240),
    })

    const droppedUserSnapshot = getTrackingSnapshot('user-a')
    const activeUserSnapshot = getTrackingSnapshot('user-b')

    assert.equal(droppedUserSnapshot.pendingCount, 0)
    assert.equal(droppedUserSnapshot.droppedCount, 1)
    assert.equal(droppedUserSnapshot.totalDropped, 1)
    assert.match(droppedUserSnapshot.lastError, /最早的 1 条待补发轨迹已被丢弃/)
    assert.equal(activeUserSnapshot.pendingCount, 240)
    assert.equal(activeUserSnapshot.droppedCount, 0)
    assert.equal(activeUserSnapshot.totalDropped, 0)
  } finally {
    if (previousLocalStorage === undefined) {
      delete globalThis.localStorage
    } else {
      globalThis.localStorage = previousLocalStorage
    }
    __resetStorageStateForTests()
  }
})

test('clearTrackingData 只清理目标用户的 pending 与统计数据', { concurrency: false }, async () => {
  const { clearTrackingData, getTrackingSnapshot, trackingStateKey } = await loadTrackingModule()
  const previousLocalStorage = globalThis.localStorage
  globalThis.localStorage = createLocalStorageMock()
  __resetStorageStateForTests({ driver: 'localStorage' })

  try {
    globalThis.localStorage.setItem(
      trackingStateKey,
      JSON.stringify({
        preferences: { enabled: true, intervalSeconds: 60 },
        pendingPoints: [
          createPendingPoint(1, { userId: 'user-a', id: 'a-1' }),
          createPendingPoint(2, { userId: 'user-a', id: 'a-2' }),
          createPendingPoint(3, { userId: 'user-b', id: 'b-1' }),
        ],
        statsByUser: {
          'user-a': {
            lastCapturedAt: '2026-03-25T08:02:00.000Z',
            lastSyncedAt: null,
            lastAttemptAt: null,
            lastError: 'old error',
            lastErrorAt: '2026-03-25T08:02:00.000Z',
            totalCaptured: 2,
            totalSynced: 0,
          },
          'user-b': {
            lastCapturedAt: '2026-03-25T08:03:00.000Z',
            lastSyncedAt: null,
            lastAttemptAt: null,
            lastError: '',
            lastErrorAt: null,
            totalCaptured: 1,
            totalSynced: 0,
          },
        },
      })
    )

    const clearedSnapshot = await clearTrackingData(' user-a ')
    const storedState = readStoredJson(trackingStateKey)
    const untouchedSnapshot = getTrackingSnapshot('user-b')

    assert.equal(clearedSnapshot.pendingCount, 0)
    assert.equal(clearedSnapshot.totalCaptured, 0)
    assert.equal(storedState.pendingPoints.some((item) => item.userId === 'user-a'), false)
    assert.equal(storedState.pendingPoints.filter((item) => item.userId === 'user-b').length, 1)
    assert.equal('user-a' in storedState.statsByUser, false)
    assert.equal(untouchedSnapshot.pendingCount, 1)
    assert.equal(untouchedSnapshot.totalCaptured, 1)
  } finally {
    if (previousLocalStorage === undefined) {
      delete globalThis.localStorage
    } else {
      globalThis.localStorage = previousLocalStorage
    }
    __resetStorageStateForTests()
  }
})
