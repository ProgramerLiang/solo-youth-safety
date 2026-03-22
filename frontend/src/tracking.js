import { readStoredJson, writeStoredJson } from './storage'

const trackingStateKey = 'safety_tracking_state_v1'
const defaultIntervalSeconds = 60
const maxPendingPoints = 240
const retryDelayScheduleMs = [15000, 30000, 60000, 180000, 300000]

export const trackingIntervalOptions = [30, 60, 180, 300]

function createPendingPointId() {
  const random = Math.random().toString(36).slice(2, 10)
  return `track_${Date.now()}_${random}`
}

function createEmptyUserStats() {
  return {
    lastCapturedAt: null,
    lastSyncedAt: null,
    lastAttemptAt: null,
    lastError: '',
    lastErrorAt: null,
    totalCaptured: 0,
    totalSynced: 0,
  }
}

function createEmptyTrackingState() {
  return {
    preferences: {
      enabled: false,
      intervalSeconds: defaultIntervalSeconds,
    },
    pendingPoints: [],
    statsByUser: {},
  }
}

function asTrimmedString(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function toFiniteNumber(value, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function normalizeIsoString(value, fallback = null) {
  const text = asTrimmedString(value)
  if (!text) {
    return fallback
  }
  const date = new Date(text)
  return Number.isNaN(date.getTime()) ? fallback : date.toISOString()
}

function normalizePoint(point) {
  if (!point || typeof point !== 'object' || Array.isArray(point)) {
    return null
  }

  const timestamp = normalizeIsoString(point.timestamp)
  const lat = Number(point.lat)
  const lng = Number(point.lng)
  if (!timestamp || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null
  }

  return {
    lat,
    lng,
    accuracy: toFiniteNumber(point.accuracy, 12),
    speed: toFiniteNumber(point.speed, 0),
    heading: toFiniteNumber(point.heading, 0),
    timestamp,
  }
}

function normalizePendingPoint(item, index = 0) {
  const userId = asTrimmedString(item?.userId)
  const deviceId = asTrimmedString(item?.deviceId)
  const point = normalizePoint(item?.point)
  if (!userId || !deviceId || !point) {
    return null
  }

  const attempts = Math.max(0, Math.floor(toFiniteNumber(item?.attempts, 0)))
  const createdAt = normalizeIsoString(item?.createdAt, point.timestamp)
  const availableAt = normalizeIsoString(item?.availableAt, createdAt)

  return {
    id: asTrimmedString(item?.id) || `pending_${index}_${createPendingPointId()}`,
    userId,
    deviceId,
    point,
    reason: asTrimmedString(item?.reason) || 'periodic',
    createdAt,
    availableAt,
    attempts,
    lastError: asTrimmedString(item?.lastError),
  }
}

function normalizeUserStats(stats) {
  const raw = stats && typeof stats === 'object' && !Array.isArray(stats) ? stats : {}
  return {
    lastCapturedAt: normalizeIsoString(raw.lastCapturedAt),
    lastSyncedAt: normalizeIsoString(raw.lastSyncedAt),
    lastAttemptAt: normalizeIsoString(raw.lastAttemptAt),
    lastError: asTrimmedString(raw.lastError),
    lastErrorAt: normalizeIsoString(raw.lastErrorAt),
    totalCaptured: Math.max(0, Math.floor(toFiniteNumber(raw.totalCaptured, 0))),
    totalSynced: Math.max(0, Math.floor(toFiniteNumber(raw.totalSynced, 0))),
  }
}

function normalizeTrackingState(raw) {
  const parsed = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}
  const state = createEmptyTrackingState()
  const intervalCandidate = Math.floor(toFiniteNumber(parsed.preferences?.intervalSeconds, defaultIntervalSeconds))

  state.preferences = {
    enabled: Boolean(parsed.preferences?.enabled),
    intervalSeconds: trackingIntervalOptions.includes(intervalCandidate)
      ? intervalCandidate
      : defaultIntervalSeconds,
  }

  state.pendingPoints = Array.isArray(parsed.pendingPoints)
    ? parsed.pendingPoints
        .map((item, index) => normalizePendingPoint(item, index))
        .filter(Boolean)
        .slice(-maxPendingPoints)
    : []

  const statsByUser = parsed.statsByUser && typeof parsed.statsByUser === 'object' ? parsed.statsByUser : {}
  state.statsByUser = Object.fromEntries(
    Object.entries(statsByUser)
      .map(([userId, stats]) => [asTrimmedString(userId), normalizeUserStats(stats)])
      .filter(([userId]) => userId)
  )

  return state
}

function loadTrackingState() {
  return normalizeTrackingState(readStoredJson(trackingStateKey))
}

async function saveTrackingState(state) {
  await writeStoredJson(trackingStateKey, state)
}

function getUserStats(state, userId) {
  return state.statsByUser[userId] || createEmptyUserStats()
}

function setUserStats(state, userId, nextStats) {
  state.statsByUser[userId] = normalizeUserStats(nextStats)
}

function trimPendingQueue(pendingPoints) {
  return pendingPoints.slice(-maxPendingPoints)
}

function computeRetryDelayMs(attempts) {
  const index = Math.min(Math.max(attempts - 1, 0), retryDelayScheduleMs.length - 1)
  return retryDelayScheduleMs[index]
}

function getNextRetryAt(pendingPoints) {
  const readyTimes = pendingPoints
    .map((item) => normalizeIsoString(item.availableAt))
    .filter(Boolean)
    .sort((a, b) => new Date(a) - new Date(b))
  return readyTimes[0] || null
}

export function createTrackingPointFromLocation(location) {
  const timestamp = normalizeIsoString(location?.capturedAt, new Date().toISOString())
  return normalizePoint({
    lat: location?.lat,
    lng: location?.lng,
    accuracy: location?.accuracy,
    speed: location?.speed,
    heading: location?.heading,
    timestamp,
  })
}

export function getTrackingSnapshot(userId = '') {
  const safeUserId = asTrimmedString(userId)
  const state = loadTrackingState()
  const pendingPoints = safeUserId
    ? state.pendingPoints.filter((item) => item.userId === safeUserId)
    : state.pendingPoints
  const stats = safeUserId ? getUserStats(state, safeUserId) : createEmptyUserStats()

  return {
    enabled: state.preferences.enabled,
    intervalSeconds: state.preferences.intervalSeconds,
    pendingCount: pendingPoints.length,
    nextRetryAt: getNextRetryAt(pendingPoints),
    lastCapturedAt: stats.lastCapturedAt,
    lastSyncedAt: stats.lastSyncedAt,
    lastAttemptAt: stats.lastAttemptAt,
    lastError: stats.lastError,
    lastErrorAt: stats.lastErrorAt,
    totalCaptured: stats.totalCaptured,
    totalSynced: stats.totalSynced,
  }
}

export async function updateTrackingPreferences(patch = {}) {
  const state = loadTrackingState()
  const intervalCandidate = Math.floor(toFiniteNumber(patch.intervalSeconds, state.preferences.intervalSeconds))

  state.preferences = {
    enabled:
      typeof patch.enabled === 'boolean' ? patch.enabled : state.preferences.enabled,
    intervalSeconds: trackingIntervalOptions.includes(intervalCandidate)
      ? intervalCandidate
      : state.preferences.intervalSeconds,
  }

  await saveTrackingState(state)
  return state.preferences
}

export async function enqueueTrackingPoint({ userId, deviceId, point, reason = 'periodic' }) {
  const safeUserId = asTrimmedString(userId)
  const safeDeviceId = asTrimmedString(deviceId)
  const normalizedPoint = normalizePoint(point)
  if (!safeUserId || !safeDeviceId || !normalizedPoint) {
    throw new Error('invalid tracking point')
  }

  const state = loadTrackingState()
  const stats = getUserStats(state, safeUserId)
  state.pendingPoints = trimPendingQueue([
    ...state.pendingPoints,
    {
      id: createPendingPointId(),
      userId: safeUserId,
      deviceId: safeDeviceId,
      point: normalizedPoint,
      reason: asTrimmedString(reason) || 'periodic',
      createdAt: normalizedPoint.timestamp,
      availableAt: normalizedPoint.timestamp,
      attempts: 0,
      lastError: '',
    },
  ])
  setUserStats(state, safeUserId, {
    ...stats,
    lastCapturedAt: normalizedPoint.timestamp,
    lastError: '',
    lastErrorAt: null,
    totalCaptured: stats.totalCaptured + 1,
  })
  await saveTrackingState(state)
  return getTrackingSnapshot(safeUserId)
}

export async function recordTrackingError(userId, message) {
  const safeUserId = asTrimmedString(userId)
  if (!safeUserId) {
    throw new Error('userId is required')
  }

  const now = new Date().toISOString()
  const state = loadTrackingState()
  const stats = getUserStats(state, safeUserId)
  setUserStats(state, safeUserId, {
    ...stats,
    lastAttemptAt: now,
    lastError: asTrimmedString(message) || 'unknown tracking error',
    lastErrorAt: now,
  })
  await saveTrackingState(state)
  return getTrackingSnapshot(safeUserId)
}

export async function clearTrackingData(userId) {
  const safeUserId = asTrimmedString(userId)
  if (!safeUserId) {
    throw new Error('userId is required')
  }

  const state = loadTrackingState()
  state.pendingPoints = state.pendingPoints.filter((item) => item.userId !== safeUserId)
  delete state.statsByUser[safeUserId]
  await saveTrackingState(state)
  return getTrackingSnapshot(safeUserId)
}

export async function flushPendingTracking(sendBatch, { userId, batchSize = 10 } = {}) {
  if (typeof sendBatch !== 'function') {
    throw new Error('sendBatch must be a function')
  }

  const safeUserId = asTrimmedString(userId)
  if (!safeUserId) {
    throw new Error('userId is required')
  }

  const now = new Date()
  const nowIso = now.toISOString()
  const state = loadTrackingState()
  const stats = getUserStats(state, safeUserId)
  const readyItems = state.pendingPoints
    .filter(
      (item) =>
        item.userId === safeUserId && new Date(item.availableAt).getTime() <= now.getTime()
    )
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))

  if (readyItems.length === 0) {
    setUserStats(state, safeUserId, {
      ...stats,
      lastAttemptAt: nowIso,
    })
    await saveTrackingState(state)
    return {
      sentCount: 0,
      error: '',
      snapshot: getTrackingSnapshot(safeUserId),
    }
  }

  let sentCount = 0
  let lastError = ''
  let mutableState = state
  let mutableStats = stats
  let remaining = readyItems

  while (remaining.length > 0) {
    const first = remaining[0]
    const batch = remaining.filter((item) => item.deviceId === first.deviceId).slice(0, batchSize)
    const batchIds = new Set(batch.map((item) => item.id))

    try {
      await sendBatch({
        userId: safeUserId,
        deviceId: first.deviceId,
        points: batch.map((item) => item.point),
      })

      mutableState = {
        ...mutableState,
        pendingPoints: mutableState.pendingPoints.filter((item) => !batchIds.has(item.id)),
      }
      sentCount += batch.length
      mutableStats = {
        ...mutableStats,
        lastAttemptAt: nowIso,
        lastSyncedAt: nowIso,
        lastError: '',
        lastErrorAt: null,
        totalSynced: mutableStats.totalSynced + batch.length,
      }
      remaining = remaining.filter((item) => !batchIds.has(item.id))
    } catch (error) {
      lastError = asTrimmedString(error?.message) || 'tracking sync failed'
      const retryAt = new Date(now.getTime() + computeRetryDelayMs(batch[0].attempts + 1)).toISOString()
      mutableState = {
        ...mutableState,
        pendingPoints: mutableState.pendingPoints.map((item) =>
          batchIds.has(item.id)
            ? {
                ...item,
                attempts: item.attempts + 1,
                availableAt: retryAt,
                lastError,
              }
            : item
        ),
      }
      mutableStats = {
        ...mutableStats,
        lastAttemptAt: nowIso,
        lastError,
        lastErrorAt: nowIso,
      }
      break
    }
  }

  mutableState.pendingPoints = trimPendingQueue(mutableState.pendingPoints)
  setUserStats(mutableState, safeUserId, mutableStats)
  await saveTrackingState(mutableState)
  return {
    sentCount,
    error: lastError,
    snapshot: getTrackingSnapshot(safeUserId),
  }
}

export { trackingStateKey }
