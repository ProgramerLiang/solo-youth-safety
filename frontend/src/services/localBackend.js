import { defaultSmsTemplate, renderSmsTemplate, validateSmsTemplate } from '../contracts/template.js'
import { createRandomId } from '../id.js'

export const localBundleVersion = '1.0'
const localDbKey = 'safety_local_backend_v1'
const validSosTriggerTypes = ['manual', 'auto']

function getDefaultDeviceId(getIdentity) {
  return getIdentity().deviceId
}

function createEmptyLocalDb() {
  return {
    emergencyConfigByUser: {},
    sosEvents: [],
    contactsByUser: {},
    trackingPoints: [],
  }
}

function loadLocalDb(readStoredJson) {
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

async function saveLocalDb(writeStoredJson, db) {
  await writeStoredJson(localDbKey, db)
}

function asTrimmedString(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function requireNonEmptyString(value, label) {
  const normalized = asTrimmedString(value)
  if (!normalized) {
    throw new Error(`${label} 不能为空`)
  }
  return normalized
}

function toFiniteNumber(value, label) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) {
    throw new Error(`${label} 必须为数字`)
  }
  return parsed
}

function toNumberInRange(value, label, { min = -Infinity, max = Infinity } = {}) {
  const parsed = toFiniteNumber(value, label)
  if (parsed < min || parsed > max) {
    throw new Error(`${label} 超出范围`)
  }
  return parsed
}

function normalizeIsoDatetime(value, label) {
  const normalized = requireNonEmptyString(value, label)
  const parsed = new Date(normalized)
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`${label} 必须为合法时间`)
  }
  return parsed.toISOString()
}

function normalizeLocation(location, label, { defaultAccuracy = null } = {}) {
  if (!location || typeof location !== 'object' || Array.isArray(location)) {
    throw new Error(`${label} 缺少 location`)
  }

  const accuracyValue = location.accuracy
  return {
    lat: toNumberInRange(location.lat, `${label}.lat`, { min: -90, max: 90 }),
    lng: toNumberInRange(location.lng, `${label}.lng`, { min: -180, max: 180 }),
    accuracy:
      accuracyValue == null && defaultAccuracy != null
        ? defaultAccuracy
        : toNumberInRange(accuracyValue, `${label}.accuracy`, { min: 0 }),
  }
}

function normalizeTrackingPoint(point, label) {
  if (!point || typeof point !== 'object' || Array.isArray(point)) {
    throw new Error(`${label} 缺少 point`)
  }

  return {
    lat: toNumberInRange(point.lat, `${label}.lat`, { min: -90, max: 90 }),
    lng: toNumberInRange(point.lng, `${label}.lng`, { min: -180, max: 180 }),
    accuracy: toNumberInRange(point.accuracy, `${label}.accuracy`, { min: 0 }),
    speed: toNumberInRange(point.speed, `${label}.speed`, { min: 0 }),
    heading: toNumberInRange(point.heading, `${label}.heading`, { min: 0, max: 360 }),
    timestamp: normalizeIsoDatetime(point.timestamp, `${label}.timestamp`),
  }
}

function normalizeTrackingRecord(item, userId, index = 0, getIdentity) {
  const normalizedUserId = requireNonEmptyString(userId, `trackingPoints[${index}].userId`)
  const fallbackDeviceId = typeof getIdentity === 'function' ? getDefaultDeviceId(getIdentity) : ''
  return {
    userId: normalizedUserId,
    deviceId: requireNonEmptyString(
      item?.deviceId ?? fallbackDeviceId,
      `trackingPoints[${index}].deviceId`
    ),
    point: normalizeTrackingPoint(item?.point ?? item, `trackingPoints[${index}].point`),
  }
}

function normalizeNotificationRecord(item) {
  const channel = asTrimmedString(item?.channel)
  const status = asTrimmedString(item?.status)
  if (!['call', 'sms'].includes(channel) || !['sent', 'skipped'].includes(status)) {
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

function normalizeImportedLocation(location, label) {
  return normalizeLocation(location, label, { defaultAccuracy: 12 })
}

function normalizeContactRecord(contact) {
  const name = asTrimmedString(contact?.name)
  const phone = asTrimmedString(contact?.phone)
  if (!name || phone.length < 3) {
    return null
  }
  return {
    id: asTrimmedString(contact?.id) || createRandomId('contact'),
    name,
    phone,
  }
}

function normalizeRequiredContact(contact, label = 'contact') {
  const name = asTrimmedString(contact?.name)
  const phone = asTrimmedString(contact?.phone)
  if (!name) {
    throw new Error(`${label}.name 不能为空`)
  }
  if (phone.length < 3) {
    throw new Error(`${label}.phone 至少 3 个字符`)
  }
  return normalizeContactRecord({ ...contact, name, phone })
}

function normalizeContactList(contacts = []) {
  return contacts.map((contact) => normalizeContactRecord(contact)).filter(Boolean)
}

function normalizeSosPayload(payload, { preserveId = false, index = null } = {}) {
  const baseLabel = index == null ? 'sos' : `sosEvents[${index}]`
  const userId = requireNonEmptyString(payload?.userId, `${baseLabel}.userId`)
  const deviceId = requireNonEmptyString(payload?.deviceId, `${baseLabel}.deviceId`)
  const triggerType = requireNonEmptyString(payload?.triggerType, `${baseLabel}.triggerType`)
  if (!validSosTriggerTypes.includes(triggerType)) {
    throw new Error(`${baseLabel}.triggerType 无效`)
  }

  const normalized = {
    userId,
    deviceId,
    triggerType,
    timestamp: normalizeIsoDatetime(payload?.timestamp, `${baseLabel}.timestamp`),
    location: normalizeLocation(payload?.location, baseLabel),
    notifications: normalizeNotificationList(payload?.notifications || []),
  }

  if (preserveId) {
    normalized.id = asTrimmedString(payload?.id) || createRandomId('sos')
  }

  return normalized
}

function normalizeSosEventRecord(item, index = 0) {
  try {
    return normalizeSosPayload(item, { preserveId: true, index })
  } catch {
    return null
  }
}

function normalizeSosEventList(events = []) {
  return events.map((item, index) => normalizeSosEventRecord(item, index)).filter(Boolean)
}

function normalizeConfig(payload) {
  const call = typeof payload.callNumber === 'string' ? payload.callNumber.trim() : ''
  const sms = typeof payload.smsNumber === 'string' ? payload.smsNumber.trim() : ''
  const smsTemplate = validateSmsTemplate(payload.smsTemplate)

  return {
    userId: payload.userId,
    callNumber: call || null,
    smsNumber: sms || null,
    smsTemplate,
  }
}

function normalizeImportedContact(contact, index) {
  return normalizeRequiredContact(contact, `contacts[${index}]`)
}

function normalizeImportedTrackingRecord(item, userId, index, getIdentity) {
  return normalizeTrackingRecord(item, userId, index, getIdentity)
}

function normalizeImportedSosEvent(item, userId, index) {
  return {
    ...normalizeSosPayload({ ...item, userId }, { preserveId: true, index }),
  }
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

function normalizeImportedBundle(payload, getIdentity) {
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
          normalizeImportedTrackingRecord(item, userId, index, getIdentity)
        )
      : [],
    sosEvents: Array.isArray(payload.sosEvents)
      ? payload.sosEvents.map((item, index) => normalizeImportedSosEvent(item, userId, index))
      : [],
  }
}

function summarizeBundle(bundle) {
  return {
    userId: bundle.userId,
    hasConfig: Boolean(bundle.config),
    contactsCount: bundle.contacts.length,
    trackingCount: bundle.trackingPoints.length,
    sosCount: bundle.sosEvents.length,
  }
}

export function createLocalBackend({ readStoredJson, writeStoredJson, getIdentity, now = () => new Date().toISOString() }) {
  async function checkHealth() {
    return { status: 'ok', time: now(), mode: 'local', version: 'local' }
  }

  async function getEmergencyConfig(userId) {
    const db = loadLocalDb(readStoredJson)
    return (
      db.emergencyConfigByUser[userId] || {
        userId,
        callNumber: null,
        smsNumber: null,
        smsTemplate: defaultSmsTemplate,
      }
    )
  }

  async function saveEmergencyConfig(payload) {
    if (!payload?.userId) {
      throw new Error('userId is required')
    }
    const normalized = normalizeConfig(payload)
    const db = loadLocalDb(readStoredJson)
    db.emergencyConfigByUser[normalized.userId] = normalized
    await saveLocalDb(writeStoredJson, db)
    return normalized
  }

  async function triggerSos(payload) {
    const normalizedPayload = normalizeSosPayload(payload)

    const db = loadLocalDb(readStoredJson)
    const cfg =
      db.emergencyConfigByUser[normalizedPayload.userId] ||
      normalizeConfig({ userId: normalizedPayload.userId, callNumber: '', smsNumber: '', smsTemplate: '' })

    const notifications = []
    if (cfg.callNumber) {
      notifications.push({
        channel: 'call',
        destination: cfg.callNumber,
        status: 'sent',
        detail: 'simulated call dispatch',
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
        detail: `simulated sms: ${renderSmsTemplate(cfg.smsTemplate, normalizedPayload)}`,
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
      id: createRandomId('sos'),
      ...normalizedPayload,
      notifications,
    }
    db.sosEvents.push(event)
    await saveLocalDb(writeStoredJson, db)

    return {
      message: 'sos received',
      count: db.sosEvents.length,
      eventId: event.id,
      notifications,
    }
  }

  async function listSosEvents(userId, limit = 20) {
    if (!userId) {
      throw new Error('userId is required')
    }
    const db = loadLocalDb(readStoredJson)
    const events = normalizeSosEventList(db.sosEvents)
    db.sosEvents = events
    await saveLocalDb(writeStoredJson, db)

    const filtered = events
      .filter((item) => item.userId === userId)
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))

    return { userId, count: filtered.length, items: filtered.slice(0, limit) }
  }

  async function createTrackingPoints(payload) {
    if (!payload?.userId || !payload?.deviceId || !Array.isArray(payload.points)) {
      throw new Error('invalid tracking payload')
    }
    if (payload.points.length === 0) {
      throw new Error('points must not be empty')
    }

    const normalizedUserId = requireNonEmptyString(payload.userId, 'tracking.userId')
    const normalizedDeviceId = requireNonEmptyString(payload.deviceId, 'tracking.deviceId')
    const normalizedPoints = payload.points.map((point, index) =>
      normalizeTrackingRecord({ deviceId: normalizedDeviceId, point }, normalizedUserId, index)
    )

    const db = loadLocalDb(readStoredJson)
    db.trackingPoints.push(...normalizedPoints)
    await saveLocalDb(writeStoredJson, db)
    return { message: 'points stored', count: normalizedPoints.length }
  }

  async function getTrackingTimeline(userIdOrPayload, fromArg, toArg) {
    const payload =
      userIdOrPayload && typeof userIdOrPayload === 'object'
        ? userIdOrPayload
        : { userId: userIdOrPayload, from: fromArg, to: toArg }

    const userId = payload?.userId
    const from = payload?.from
    const to = payload?.to

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

    const db = loadLocalDb(readStoredJson)
    const normalizedRecords = db.trackingPoints
      .map((item, index) => {
        try {
          return normalizeTrackingRecord(item, item?.userId, index, getIdentity)
        } catch {
          return null
        }
      })
      .filter(Boolean)

    db.trackingPoints = normalizedRecords
    await saveLocalDb(writeStoredJson, db)

    const points = normalizedRecords
      .filter((item) => item.userId === userId)
      .map((item) => item.point)
      .filter((point) => {
        const t = new Date(point.timestamp)
        return t >= fromTime && t <= toTime
      })

    return { userId, count: points.length, points }
  }

  async function listContacts(userId) {
    if (!userId) {
      throw new Error('userId is required')
    }
    const db = loadLocalDb(readStoredJson)
    const contacts = normalizeContactList(db.contactsByUser[userId] || [])
    db.contactsByUser[userId] = contacts
    await saveLocalDb(writeStoredJson, db)
    return { userId, contacts }
  }

  async function createContact(payload) {
    if (!payload?.userId || !payload?.contact) {
      throw new Error('invalid contact payload')
    }

    const normalizedUserId = requireNonEmptyString(payload.userId, 'contact.userId')
    const db = loadLocalDb(readStoredJson)
    const existing = normalizeContactList(db.contactsByUser[normalizedUserId] || [])
    const contact = normalizeRequiredContact(payload.contact)
    existing.push(contact)
    db.contactsByUser[normalizedUserId] = existing
    await saveLocalDb(writeStoredJson, db)
    return { message: 'contact added', count: existing.length }
  }

  async function updateContact(contactId, payload) {
    if (!contactId || !payload?.userId || !payload?.contact) {
      throw new Error('invalid contact payload')
    }

    const normalizedContactId = requireNonEmptyString(contactId, 'contact.id')
    const normalizedUserId = requireNonEmptyString(payload.userId, 'contact.userId')
    const db = loadLocalDb(readStoredJson)
    const existing = normalizeContactList(db.contactsByUser[normalizedUserId] || [])
    const index = existing.findIndex((item) => item.id === normalizedContactId)
    if (index === -1) {
      throw new Error('contact not found')
    }
    const normalizedContact = normalizeRequiredContact({ ...payload.contact, id: normalizedContactId })
    existing[index] = normalizedContact
    db.contactsByUser[normalizedUserId] = existing
    await saveLocalDb(writeStoredJson, db)
    return { message: 'contact updated', count: existing.length }
  }

  async function deleteContact(contactId, userId) {
    if (!contactId || !userId) {
      throw new Error('contactId/userId are required')
    }

    const db = loadLocalDb(readStoredJson)
    const existing = normalizeContactList(db.contactsByUser[userId] || [])
    const next = existing.filter((item) => item.id !== contactId)
    if (next.length === existing.length) {
      throw new Error('contact not found')
    }

    db.contactsByUser[userId] = next
    await saveLocalDb(writeStoredJson, db)
    return { message: 'contact deleted', count: next.length }
  }

  async function getSnapshot(userId) {
    const db = loadLocalDb(readStoredJson)
    const contacts = normalizeContactList(db.contactsByUser[userId] || [])
    const trackingPoints = db.trackingPoints
      .map((item, index) => {
        try {
          return normalizeTrackingRecord(item, item?.userId, index, getIdentity)
        } catch {
          return null
        }
      })
      .filter(Boolean)
      .filter((item) => item.userId === userId)
    const sosEvents = normalizeSosEventList(db.sosEvents).filter((item) => item.userId === userId)
    const latestSos =
      sosEvents
        .slice()
        .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
        .at(-1)?.timestamp || null

    return {
      enabled: true,
      userId,
      hasConfig: Boolean(db.emergencyConfigByUser[userId]),
      contactsCount: contacts.length,
      trackingCount: trackingPoints.length,
      sosCount: sosEvents.length,
      latestSos,
    }
  }

  async function exportBundle(userId) {
    const db = loadLocalDb(readStoredJson)
    const contacts = normalizeContactList(db.contactsByUser[userId] || [])
    const trackingPoints = db.trackingPoints
      .map((item, index) => {
        try {
          return normalizeTrackingRecord(item, item?.userId, index, getIdentity)
        } catch {
          return null
        }
      })
      .filter(Boolean)
      .filter((item) => item.userId === userId)
    const sosEvents = normalizeSosEventList(db.sosEvents).filter((item) => item.userId === userId)

    return {
      mode: 'local',
      version: localBundleVersion,
      exportedAt: now(),
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

  async function inspectBundle(payload) {
    const bundle = normalizeImportedBundle(payload, getIdentity)
    return {
      bundle,
      summary: summarizeBundle(bundle),
    }
  }

  async function importBundle(payload) {
    const bundle = normalizeImportedBundle(payload, getIdentity)
    const db = loadLocalDb(readStoredJson)

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
    await saveLocalDb(writeStoredJson, db)

    return {
      bundle,
      snapshot: await getSnapshot(bundle.userId),
    }
  }

  async function clearData(userId) {
    const db = loadLocalDb(readStoredJson)
    delete db.emergencyConfigByUser[userId]
    delete db.contactsByUser[userId]
    db.sosEvents = db.sosEvents.filter((item) => item.userId !== userId)
    db.trackingPoints = db.trackingPoints.filter((item) => item.userId !== userId)
    await saveLocalDb(writeStoredJson, db)
    return getSnapshot(userId)
  }

  return {
    checkHealth,
    getEmergencyConfig,
    saveEmergencyConfig,
    triggerSos,
    listSosEvents,
    createTrackingPoints,
    getTrackingTimeline,
    listContacts,
    createContact,
    updateContact,
    deleteContact,
    getSnapshot,
    exportBundle,
    inspectBundle,
    importBundle,
    clearData,
  }
}
