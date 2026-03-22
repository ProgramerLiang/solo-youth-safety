import { isNativePlatform } from './nativeActions'

const API_BASE = 'http://127.0.0.1:8000/api/v1'
const DEFAULT_USER = 'u_123'
const defaultTemplate = '[SOS] 用户{userId}触发报警，位置({lat},{lng}) 时间:{time}'
const localDbKey = 'safety_local_backend_v1'

function isLocalBackendEnabled() {
  const forced = globalThis?.localStorage?.getItem('safety_force_local_backend') === '1'
  return isNativePlatform() || forced
}

function createEmptyLocalDb() {
  return {
    emergencyConfigByUser: {},
    sosEvents: [],
    contactsByUser: {},
    trackingPoints: [],
  }
}

function renderTemplate(template, payload) {
  return template
    .replaceAll('{userId}', payload.userId)
    .replaceAll('{deviceId}', payload.deviceId)
    .replaceAll('{lat}', String(payload.location?.lat ?? 'unknown'))
    .replaceAll('{lng}', String(payload.location?.lng ?? 'unknown'))
    .replaceAll('{time}', payload.timestamp)
}

function loadLocalDb() {
  try {
    const raw = localStorage.getItem(localDbKey)
    if (!raw) {
      return createEmptyLocalDb()
    }
    const parsed = JSON.parse(raw)
    return {
      emergencyConfigByUser: parsed.emergencyConfigByUser || {},
      sosEvents: parsed.sosEvents || [],
      contactsByUser: parsed.contactsByUser || {},
      trackingPoints: parsed.trackingPoints || [],
    }
  } catch {
    return createEmptyLocalDb()
  }
}

function saveLocalDb(db) {
  localStorage.setItem(localDbKey, JSON.stringify(db))
}

function normalizeConfig(payload) {
  const call = typeof payload.callNumber === 'string' ? payload.callNumber.trim() : ''
  const sms = typeof payload.smsNumber === 'string' ? payload.smsNumber.trim() : ''
  const smsTemplate = payload.smsTemplate?.trim() ? payload.smsTemplate : defaultTemplate

  return {
    userId: payload.userId,
    callNumber: call || null,
    smsNumber: sms || null,
    smsTemplate,
  }
}

async function request(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || 'request failed')
  }
  return res.json()
}

async function checkHealthLocal() {
  return { status: 'ok', time: new Date().toISOString(), mode: 'local' }
}

async function getEmergencyConfigLocal(userId = DEFAULT_USER) {
  const db = loadLocalDb()
  return (
    db.emergencyConfigByUser[userId] || {
      userId,
      callNumber: null,
      smsNumber: null,
      smsTemplate: defaultTemplate,
    }
  )
}

async function saveEmergencyConfigLocal(payload) {
  if (!payload?.userId) {
    throw new Error('userId is required')
  }
  const normalized = normalizeConfig(payload)
  const db = loadLocalDb()
  db.emergencyConfigByUser[normalized.userId] = normalized
  saveLocalDb(db)
  return normalized
}

async function triggerSosLocal(payload) {
  if (!payload?.userId || !payload?.deviceId || !payload?.timestamp) {
    throw new Error('invalid sos payload')
  }

  const db = loadLocalDb()
  db.sosEvents.push(payload)
  saveLocalDb(db)

  const cfg =
    db.emergencyConfigByUser[payload.userId] ||
    normalizeConfig({ userId: payload.userId, callNumber: '', smsNumber: '', smsTemplate: '' })

  const notifications = []
  if (cfg.callNumber) {
    notifications.push({
      channel: 'call',
      destination: cfg.callNumber,
      status: 'sent',
      detail: 'local simulated call dispatch',
    })
  } else {
    notifications.push({
      channel: 'call',
      destination: null,
      status: 'skipped',
      detail: 'callNumber is empty',
    })
  }

  if (cfg.smsNumber) {
    notifications.push({
      channel: 'sms',
      destination: cfg.smsNumber,
      status: 'sent',
      detail: `local simulated sms: ${renderTemplate(cfg.smsTemplate, payload)}`,
    })
  } else {
    notifications.push({
      channel: 'sms',
      destination: null,
      status: 'skipped',
      detail: 'smsNumber is empty',
    })
  }

  return {
    message: 'sos received (local)',
    count: db.sosEvents.length,
    notifications,
  }
}

async function createTrackingPointsLocal(payload) {
  if (!payload?.userId || !payload?.deviceId || !Array.isArray(payload.points)) {
    throw new Error('invalid tracking payload')
  }
  if (payload.points.length === 0) {
    throw new Error('points must not be empty')
  }

  const db = loadLocalDb()
  for (const point of payload.points) {
    db.trackingPoints.push({
      userId: payload.userId,
      deviceId: payload.deviceId,
      point,
    })
  }
  saveLocalDb(db)
  return { message: 'points stored', count: payload.points.length }
}

async function getTrackingTimelineLocal(userId, from, to) {
  if (!userId || !from || !to) {
    throw new Error('userId/from/to are required')
  }

  const fromTime = new Date(from)
  const toTime = new Date(to)
  if (Number.isNaN(fromTime.getTime()) || Number.isNaN(toTime.getTime())) {
    throw new Error('invalid datetime range')
  }
  if (fromTime > toTime) {
    throw new Error('from must be earlier than to')
  }

  const db = loadLocalDb()
  const points = db.trackingPoints
    .filter((item) => item.userId === userId)
    .map((item) => item.point)
    .filter((point) => {
      const t = new Date(point.timestamp)
      return t >= fromTime && t <= toTime
    })

  return { userId, count: points.length, points }
}

async function listContactsLocal(userId = DEFAULT_USER) {
  if (!userId) {
    throw new Error('userId is required')
  }
  const db = loadLocalDb()
  return { userId, contacts: db.contactsByUser[userId] || [] }
}

async function createContactLocal(payload) {
  if (!payload?.userId || !payload?.contact?.name || !payload?.contact?.phone) {
    throw new Error('invalid contact payload')
  }

  const db = loadLocalDb()
  const existing = db.contactsByUser[payload.userId] || []
  existing.push({ name: payload.contact.name, phone: payload.contact.phone })
  db.contactsByUser[payload.userId] = existing
  saveLocalDb(db)
  return { message: 'contact added', count: existing.length }
}

export function isLocalBackendMode() {
  return isLocalBackendEnabled()
}

export async function getLocalBackendSnapshot(userId = DEFAULT_USER) {
  const db = loadLocalDb()
  const contacts = db.contactsByUser[userId] || []
  const trackingPoints = db.trackingPoints.filter((item) => item.userId === userId)
  const sosEvents = db.sosEvents.filter((item) => item.userId === userId)
  const latestSos = sosEvents.at(-1)?.timestamp || null

  return {
    enabled: isLocalBackendEnabled(),
    userId,
    hasConfig: Boolean(db.emergencyConfigByUser[userId]),
    contactsCount: contacts.length,
    trackingCount: trackingPoints.length,
    sosCount: sosEvents.length,
    latestSos,
  }
}

export async function clearLocalBackendData(userId = DEFAULT_USER) {
  const db = loadLocalDb()
  delete db.emergencyConfigByUser[userId]
  delete db.contactsByUser[userId]
  db.sosEvents = db.sosEvents.filter((item) => item.userId !== userId)
  db.trackingPoints = db.trackingPoints.filter((item) => item.userId !== userId)
  saveLocalDb(db)
  return getLocalBackendSnapshot(userId)
}

export async function checkHealth() {
  if (isLocalBackendEnabled()) {
    return checkHealthLocal()
  }
  return request('/health')
}

export async function getEmergencyConfig(userId = DEFAULT_USER) {
  if (isLocalBackendEnabled()) {
    return getEmergencyConfigLocal(userId)
  }
  const q = new URLSearchParams({ userId })
  return request(`/emergency/config?${q.toString()}`)
}

export async function saveEmergencyConfig(payload) {
  if (isLocalBackendEnabled()) {
    return saveEmergencyConfigLocal(payload)
  }
  return request('/emergency/config', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function triggerSos(payload) {
  if (isLocalBackendEnabled()) {
    return triggerSosLocal(payload)
  }
  return request('/sos/events', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function createTrackingPoints(payload) {
  if (isLocalBackendEnabled()) {
    return createTrackingPointsLocal(payload)
  }
  return request('/tracking/points', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function getTrackingTimeline({ userId, from, to }) {
  if (isLocalBackendEnabled()) {
    return getTrackingTimelineLocal(userId, from, to)
  }
  const q = new URLSearchParams({ userId, from, to })
  return request(`/tracking/timeline?${q.toString()}`)
}

export async function listContacts(userId = DEFAULT_USER) {
  if (isLocalBackendEnabled()) {
    return listContactsLocal(userId)
  }
  const q = new URLSearchParams({ userId })
  return request(`/contacts?${q.toString()}`)
}

export async function createContact(payload) {
  if (isLocalBackendEnabled()) {
    return createContactLocal(payload)
  }
  return request('/contacts', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export { API_BASE, DEFAULT_USER }
