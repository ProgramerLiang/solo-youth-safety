import { isNativePlatform } from './nativeActions'

const API_BASE = 'http://127.0.0.1:8000/api/v1'
const DEFAULT_USER = 'u_123'
const defaultTemplate = '[SOS] 用户{userId}触发报警，位置({lat},{lng}) 时间:{time}'
const localDbKey = 'safety_local_backend_v1'

function isLocalBackendEnabled() {
  const forced = globalThis?.localStorage?.getItem('safety_force_local_backend') === '1'
  return isNativePlatform() || forced
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
      return { emergencyConfigByUser: {}, sosEvents: [] }
    }
    const parsed = JSON.parse(raw)
    return {
      emergencyConfigByUser: parsed.emergencyConfigByUser || {},
      sosEvents: parsed.sosEvents || [],
    }
  } catch {
    return { emergencyConfigByUser: {}, sosEvents: [] }
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

export { API_BASE, DEFAULT_USER }
