import { getPersistedIdentity } from './identity.js'
import { isNativePlatform } from './nativeActions.js'
import { readStoredJson, writeStoredJson } from './storage.js'
import { defaultSmsTemplate, renderSmsTemplate } from './template.js'

const API_BASE = 'http://127.0.0.1:8000/api/v1'
const DEFAULT_USER = getPersistedIdentity().userId
const DEFAULT_DEVICE_ID = getPersistedIdentity().deviceId
const localDbKey = 'safety_local_backend_v1'
const localBundleVersion = '1.0'
const NOTIFICATION_CHANNELS = ['call', 'sms']
const NOTIFICATION_STATUSES = [
  'sent',
  'skipped',
  'failed',
  'dispatched',
  'triggered',
  'attempted',
  'permission-denied',
  'partial-success',
]

function getDefaultUserId() {
  return getPersistedIdentity().userId
}

function getDefaultDeviceId() {
  return getPersistedIdentity().deviceId
}

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

function loadLocalDb() {
  const parsed = readStoredJson(localDbKey)
  if (!parsed) {
    return createEmptyLocalDb()
  }
  return {
    emergencyConfigByUser: parsed.emergencyConfigByUser || {},
    sosEvents: parsed.sosEvents || [],
    contactsByUser: parsed.contactsByUser || {},
    trackingPoints: parsed.trackingPoints || [],
  }
}

async function saveLocalDb(db) {
  await writeStoredJson(localDbKey, db)
}

function createContactId() {
  const random = Math.random().toString(36).slice(2, 10)
  return `contact_${Date.now()}_${random}`
}

function createSosEventId() {
  const random = Math.random().toString(36).slice(2, 10)
  return `sos_${Date.now()}_${random}`
}

function normalizeNotificationRecord(item) {
  const channel = asTrimmedString(item?.channel)
  const status = asTrimmedString(item?.status)
  if (!NOTIFICATION_CHANNELS.includes(channel) || !NOTIFICATION_STATUSES.includes(status)) {
    return null
  }
  return {
    channel,
    destination: asTrimmedString(item?.destination) || null,
    status,
    detail: asTrimmedString(item?.detail),
  }
}

function normalizeNotificationList(notifications = []) {
  return notifications.map((item) => normalizeNotificationRecord(item)).filter(Boolean)
}

function normalizeSosEventRecord(item, index = 0) {
  const label = `sosEvents[${index}]`
  const userId = asTrimmedString(item?.userId)
  const deviceId = asTrimmedString(item?.deviceId)
  const timestamp = asTrimmedString(item?.timestamp)
  if (!userId || !deviceId || !timestamp) {
    return null
  }
  try {
    return {
      id: asTrimmedString(item?.id) || createSosEventId(),
      userId,
      deviceId,
      triggerType: asTrimmedString(item?.triggerType) || 'manual',
      timestamp,
      location: normalizeImportedLocation(item?.location, label),
      notifications: normalizeNotificationList(item?.notifications || []),
    }
  } catch {
    return null
  }
}

function normalizeSosEventList(events = []) {
  return events.map((item, index) => normalizeSosEventRecord(item, index)).filter(Boolean)
}

function normalizeContactRecord(contact) {
  const name = asTrimmedString(contact?.name)
  const phone = asTrimmedString(contact?.phone)
  if (!name || !phone) {
    return null
  }
  return {
    id: asTrimmedString(contact?.id) || createContactId(),
    name,
    phone,
  }
}

function normalizeContactList(contacts = []) {
  return contacts.map((contact) => normalizeContactRecord(contact)).filter(Boolean)
}

function normalizeConfig(payload) {
  const call = typeof payload.callNumber === 'string' ? payload.callNumber.trim() : ''
  const sms = typeof payload.smsNumber === 'string' ? payload.smsNumber.trim() : ''
  const smsTemplate = payload.smsTemplate?.trim() ? payload.smsTemplate : defaultSmsTemplate

  return {
    userId: payload.userId,
    callNumber: call || null,
    smsNumber: sms || null,
    smsTemplate,
  }
}

function asTrimmedString(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function toFiniteNumber(value, label) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) {
    throw new Error(`${label} 必须为数字`)
  }
  return parsed
}

function normalizeImportedLocation(location, label) {
  if (!location || typeof location !== 'object' || Array.isArray(location)) {
    throw new Error(`${label} 缺少 location`)
  }
  return {
    lat: toFiniteNumber(location.lat, `${label}.lat`),
    lng: toFiniteNumber(location.lng, `${label}.lng`),
    accuracy: Number.isFinite(Number(location.accuracy)) ? Number(location.accuracy) : 12,
  }
}

function normalizeImportedContact(contact, index) {
  const normalized = normalizeContactRecord(contact)
  if (!normalized) {
    throw new Error(`contacts[${index}] 缺少 name 或 phone`)
  }
  return normalized
}

function normalizeImportedTrackingRecord(item, userId, index) {
  const label = `trackingPoints[${index}].point`
  const point = item?.point
  const timestamp = asTrimmedString(point?.timestamp)
  if (!timestamp) {
    throw new Error(`${label}.timestamp 缺失`)
  }
  return {
    userId,
    deviceId: asTrimmedString(item?.deviceId) || getDefaultDeviceId(),
    point: {
      lat: toFiniteNumber(point.lat, `${label}.lat`),
      lng: toFiniteNumber(point.lng, `${label}.lng`),
      accuracy: Number.isFinite(Number(point.accuracy)) ? Number(point.accuracy) : 12,
      speed: Number.isFinite(Number(point.speed)) ? Number(point.speed) : 0,
      heading: Number.isFinite(Number(point.heading)) ? Number(point.heading) : 0,
      timestamp,
    },
  }
}

function normalizeImportedSosEvent(item, userId, index) {
  const normalized = normalizeSosEventRecord({ ...item, userId }, index)
  if (!normalized) {
    throw new Error(`sosEvents[${index}] 格式无效`)
  }
  return normalized
}

function normalizeImportedConfig(config, userId) {
  const configUserId = asTrimmedString(config?.userId) || userId
  if (configUserId !== userId) {
    throw new Error('config.userId 与快照 userId 不一致')
  }
  return normalizeConfig({
    userId,
    callNumber: config?.callNumber ?? '',
    smsNumber: config?.smsNumber ?? '',
    smsTemplate: config?.smsTemplate ?? defaultSmsTemplate,
  })
}

function normalizeImportedBundle(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('本地快照格式无效')
  }
  if (payload.version && payload.version !== localBundleVersion) {
    throw new Error(`本地快照版本不匹配，期望 ${localBundleVersion}`)
  }
  const userId = asTrimmedString(payload.userId)
  if (!userId) {
    throw new Error('本地快照缺少 userId')
  }
  return {
    userId,
    config: payload.config == null ? null : normalizeImportedConfig(payload.config, userId),
    contacts: Array.isArray(payload.contacts)
      ? payload.contacts.map((item, index) => normalizeImportedContact(item, index))
      : [],
    trackingPoints: Array.isArray(payload.trackingPoints)
      ? payload.trackingPoints.map((item, index) =>
          normalizeImportedTrackingRecord(item, userId, index)
        )
      : [],
    sosEvents: Array.isArray(payload.sosEvents)
      ? payload.sosEvents.map((item, index) => normalizeImportedSosEvent(item, userId, index))
      : [],
  }
}

export function getStandardErrorMessage(status, fallback = '') {
  if (status === 401) {
    return '身份信息缺失，请刷新页面后重试'
  }
  if (status === 403) {
    return '当前身份无权访问该数据，请确认使用的是同一用户/设备'
  }
  if (status === 422) {
    return '请求参数不完整或身份信息格式无效，请检查后重试'
  }
  if (status >= 500) {
    return '服务暂时不可用，请稍后重试。'
  }
  return fallback || '请求失败，请稍后重试。'
}

function extractErrorDetail(payload) {
  if (!payload) {
    return ''
  }
  if (typeof payload === 'string') {
    return payload.trim()
  }
  if (typeof payload.detail === 'string') {
    return payload.detail.trim()
  }
  if (Array.isArray(payload.detail)) {
    const message = payload.detail
      .map((item) => {
        if (typeof item === 'string') {
          return item.trim()
        }
        if (item && typeof item.msg === 'string') {
          return item.msg.trim()
        }
        return ''
      })
      .filter(Boolean)
      .join('；')
    return message
  }
  if (typeof payload.message === 'string') {
    return payload.message.trim()
  }
  return ''
}

async function readErrorPayload(res) {
  const contentType = res.headers.get('content-type') || ''
  if (contentType.includes('application/json')) {
    try {
      const data = await res.json()
      return extractErrorDetail(data)
    } catch {
      return ''
    }
  }

  try {
    const text = (await res.text()).trim()
    if (!text) {
      return ''
    }
    if (text.startsWith('<')) {
      return ''
    }
    return text
  } catch {
    return ''
  }
}

function buildRemoteRequestHeaders(customHeaders = {}) {
  const identity = getPersistedIdentity()
  return {
    'Content-Type': 'application/json',
    'X-Safety-User-Id': identity.userId,
    'X-Safety-Device-Id': identity.deviceId,
    'X-Safety-Client-Mode': 'remote',
    ...customHeaders,
  }
}

async function request(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: buildRemoteRequestHeaders(options.headers),
  })
  if (!res.ok) {
    const detail = await readErrorPayload(res)
    throw new Error(getStandardErrorMessage(res.status, detail))
  }
  return res.json()
}

async function checkHealthLocal() {
  return { status: 'ok', time: new Date().toISOString(), mode: 'local' }
}

async function getEmergencyConfigLocal(userId = getDefaultUserId()) {
  const db = loadLocalDb()
  return (
    db.emergencyConfigByUser[userId] || {
      userId,
      callNumber: null,
      smsNumber: null,
      smsTemplate: defaultSmsTemplate,
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
  await saveLocalDb(db)
  return normalized
}

async function triggerSosLocal(payload) {
  if (!payload?.userId || !payload?.deviceId || !payload?.timestamp) {
    throw new Error('invalid sos payload')
  }

  const db = loadLocalDb()
  const cfg =
    db.emergencyConfigByUser[payload.userId] ||
    normalizeConfig({ userId: payload.userId, callNumber: '', smsNumber: '', smsTemplate: '' })

  const notifications = []
  if (cfg.callNumber) {
    notifications.push({
      channel: 'call',
      destination: cfg.callNumber,
      status: 'triggered',
      detail: 'local simulated call trigger',
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
      status: 'dispatched',
      detail: `local simulated sms dispatch: ${renderSmsTemplate(cfg.smsTemplate, payload)}`,
    })
  } else {
    notifications.push({
      channel: 'sms',
      destination: null,
      status: 'skipped',
      detail: 'smsNumber is empty',
    })
  }

  const event = {
    id: createSosEventId(),
    ...payload,
    notifications,
  }
  db.sosEvents.push(event)
  await saveLocalDb(db)

  return {
    message: 'sos received (local)',
    count: db.sosEvents.length,
    eventId: event.id,
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
  await saveLocalDb(db)
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

async function listSosEventsLocal(userId = getDefaultUserId(), limit = 20) {
  if (!userId) {
    throw new Error('userId is required')
  }
  const db = loadLocalDb()
  const events = normalizeSosEventList(db.sosEvents)
  db.sosEvents = events
  await saveLocalDb(db)

  const filtered = events
    .filter((item) => item.userId === userId)
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))

  return { userId, count: filtered.length, items: filtered.slice(0, limit) }
}

async function listContactsLocal(userId = getDefaultUserId()) {
  if (!userId) {
    throw new Error('userId is required')
  }
  const db = loadLocalDb()
  const contacts = normalizeContactList(db.contactsByUser[userId] || [])
  db.contactsByUser[userId] = contacts
  await saveLocalDb(db)
  return { userId, contacts }
}

async function createContactLocal(payload) {
  if (!payload?.userId || !payload?.contact?.name || !payload?.contact?.phone) {
    throw new Error('invalid contact payload')
  }

  const db = loadLocalDb()
  const existing = normalizeContactList(db.contactsByUser[payload.userId] || [])
  const contact = normalizeContactRecord(payload.contact)
  existing.push(contact)
  db.contactsByUser[payload.userId] = existing
  await saveLocalDb(db)
  return { message: 'contact added', count: existing.length, contact }
}

async function updateContactLocal(contactId, payload) {
  if (!contactId || !payload?.userId || !payload?.contact?.name || !payload?.contact?.phone) {
    throw new Error('invalid contact payload')
  }

  const db = loadLocalDb()
  const existing = normalizeContactList(db.contactsByUser[payload.userId] || [])
  const index = existing.findIndex((item) => item.id === contactId)
  if (index === -1) {
    throw new Error('contact not found')
  }
  existing[index] = { id: contactId, name: payload.contact.name.trim(), phone: payload.contact.phone.trim() }
  db.contactsByUser[payload.userId] = existing
  await saveLocalDb(db)
  return { message: 'contact updated', count: existing.length, contact: existing[index] }
}

async function deleteContactLocal(contactId, userId = getDefaultUserId()) {
  if (!contactId || !userId) {
    throw new Error('contactId/userId are required')
  }

  const db = loadLocalDb()
  const existing = normalizeContactList(db.contactsByUser[userId] || [])
  const next = existing.filter((item) => item.id !== contactId)
  if (next.length === existing.length) {
    throw new Error('contact not found')
  }
  db.contactsByUser[userId] = next
  await saveLocalDb(db)
  return { message: 'contact deleted', count: next.length }
}

export function isLocalBackendMode() {
  return isLocalBackendEnabled()
}

export async function getLocalBackendSnapshot(userId = getDefaultUserId()) {
  const db = loadLocalDb()
  const contacts = normalizeContactList(db.contactsByUser[userId] || [])
  const trackingPoints = db.trackingPoints.filter((item) => item.userId === userId)
  const sosEvents = normalizeSosEventList(db.sosEvents).filter((item) => item.userId === userId)
  const latestSos = sosEvents
    .slice()
    .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
    .at(-1)?.timestamp || null

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

export async function exportLocalBackendBundle(userId = getDefaultUserId()) {
  const db = loadLocalDb()
  const contacts = normalizeContactList(db.contactsByUser[userId] || [])
  const trackingPoints = db.trackingPoints.filter((item) => item.userId === userId)
  const sosEvents = normalizeSosEventList(db.sosEvents).filter((item) => item.userId === userId)

  return {
    mode: 'local',
    version: localBundleVersion,
    exportedAt: new Date().toISOString(),
    userId,
    config: db.emergencyConfigByUser[userId] || null,
    contacts,
    trackingPoints,
    sosEvents,
    summary: {
      hasConfig: Boolean(db.emergencyConfigByUser[userId]),
      contactsCount: contacts.length,
      trackingCount: trackingPoints.length,
      sosCount: sosEvents.length,
    },
  }
}

export async function importLocalBackendBundle(payload) {
  const bundle = normalizeImportedBundle(payload)
  const db = loadLocalDb()

  if (bundle.config) {
    db.emergencyConfigByUser[bundle.userId] = bundle.config
  } else {
    delete db.emergencyConfigByUser[bundle.userId]
  }

  db.contactsByUser[bundle.userId] = bundle.contacts
  db.sosEvents = db.sosEvents.filter((item) => item.userId !== bundle.userId)
  db.trackingPoints = db.trackingPoints.filter((item) => item.userId !== bundle.userId)
  db.sosEvents.push(...bundle.sosEvents)
  db.trackingPoints.push(...bundle.trackingPoints)
  await saveLocalDb(db)

  return {
    bundle,
    snapshot: await getLocalBackendSnapshot(bundle.userId),
  }
}

export async function clearLocalBackendData(userId = getDefaultUserId()) {
  const db = loadLocalDb()
  delete db.emergencyConfigByUser[userId]
  delete db.contactsByUser[userId]
  db.sosEvents = db.sosEvents.filter((item) => item.userId !== userId)
  db.trackingPoints = db.trackingPoints.filter((item) => item.userId !== userId)
  await saveLocalDb(db)
  return getLocalBackendSnapshot(userId)
}

export async function checkHealth() {
  if (isLocalBackendEnabled()) {
    return checkHealthLocal()
  }
  return request('/health')
}

export async function getEmergencyConfig(userId = getDefaultUserId()) {
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

export async function listSosEvents(userId = getDefaultUserId(), limit = 20) {
  if (isLocalBackendEnabled()) {
    return listSosEventsLocal(userId, limit)
  }
  const q = new URLSearchParams({ userId, limit: String(limit) })
  return request(`/sos/events?${q.toString()}`)
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

export async function listContacts(userId = getDefaultUserId()) {
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

export async function updateContact(contactId, payload) {
  if (isLocalBackendEnabled()) {
    return updateContactLocal(contactId, payload)
  }
  return request(`/contacts/${contactId}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
}

export async function deleteContact(contactId, userId = getDefaultUserId()) {
  if (isLocalBackendEnabled()) {
    return deleteContactLocal(contactId, userId)
  }
  const q = new URLSearchParams({ userId })
  return request(`/contacts/${contactId}?${q.toString()}`, {
    method: 'DELETE',
  })
}

export { API_BASE, DEFAULT_USER }
