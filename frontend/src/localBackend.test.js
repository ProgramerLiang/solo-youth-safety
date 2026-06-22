import assert from 'node:assert/strict'
import test from 'node:test'

import { createLocalBackend } from './services/localBackend.js'

function createMemoryStorage(initialValue = null) {
  let value = initialValue
  return {
    readStoredJson() {
      return value
    },
    async writeStoredJson(key, nextValue) {
      value = nextValue
    },
  }
}

function createBackend(initialValue = null) {
  const storage = createMemoryStorage(initialValue)
  return createLocalBackend({
    readStoredJson: storage.readStoredJson,
    writeStoredJson: storage.writeStoredJson,
    getIdentity: () => ({ userId: 'u_test', deviceId: 'd_test' }),
    now: () => '2026-03-25T08:00:00.000Z',
  })
}

test('local backend health matches remote contract fields', async () => {
  const backend = createBackend()
  const result = await backend.checkHealth()

  assert.equal(result.status, 'ok')
  assert.equal(result.mode, 'local')
  assert.equal(typeof result.time, 'string')
  assert.equal(typeof result.version, 'string')
})

test('local backend sos response matches remote contract shape', async () => {
  const backend = createBackend()
  await backend.saveEmergencyConfig({
    userId: 'u_test',
    callNumber: '',
    smsNumber: '13800000000',
    smsTemplate: '[SOS]{userId}',
  })

  const result = await backend.triggerSos({
    userId: 'u_test',
    deviceId: 'd_test',
    triggerType: 'manual',
    timestamp: '2026-03-25T08:00:00.000Z',
    location: { lat: 31.23, lng: 121.47, accuracy: 12 },
  })

  assert.equal(result.message, 'sos received')
  assert.equal(typeof result.eventId, 'string')
  assert.equal(result.notifications.length, 2)
})

test('local backend rejects invalid snapshot version', async () => {
  const backend = createBackend()
  await assert.rejects(
    () =>
      backend.importBundle({
        version: '9.9',
        userId: 'u_test',
      }),
    /本地快照版本不匹配/
  )
})

test('local backend rejects invalid tracking point ranges', async () => {
  const backend = createBackend()

  await assert.rejects(
    () =>
      backend.createTrackingPoints({
        userId: 'u_test',
        deviceId: 'd_test',
        points: [
          {
            lat: 91,
            lng: 121.47,
            accuracy: 12,
            speed: 0,
            heading: 20,
            timestamp: '2026-03-25T08:00:00.000Z',
          },
        ],
      }),
    /trackingPoints\[0\]\.point\.lat 超出范围/
  )
})

test('local backend rejects invalid sos trigger type and location', async () => {
  const backend = createBackend()

  await assert.rejects(
    () =>
      backend.triggerSos({
        userId: 'u_test',
        deviceId: 'd_test',
        triggerType: 'panic',
        timestamp: '2026-03-25T08:00:00.000Z',
        location: { lat: 31.23, lng: 181, accuracy: 12 },
      }),
    /sos.triggerType 无效/
  )
})

test('local backend rejects blank contacts after trim to keep create/list consistent', async () => {
  const backend = createBackend()

  await assert.rejects(
    () =>
      backend.createContact({
        userId: 'u_test',
        contact: { name: '   ', phone: ' 13800000000 ' },
      }),
    /contact.name 不能为空/
  )

  await assert.rejects(
    () =>
      backend.createContact({
        userId: 'u_test',
        contact: { name: ' Alice ', phone: ' 1 ' },
      }),
    /contact.phone 至少 3 个字符/
  )

  await backend.createContact({
    userId: 'u_test',
    contact: { name: ' Alice ', phone: ' 13800000000 ' },
  })
  const result = await backend.listContacts('u_test')

  assert.deepEqual(result.contacts, [{ id: result.contacts[0].id, name: 'Alice', phone: '13800000000' }])
})

test('local backend update contact validates trimmed values before persisting', async () => {
  const backend = createBackend()

  await backend.createContact({
    userId: 'u_test',
    contact: { name: 'Alice', phone: '13800000000' },
  })
  const { contacts } = await backend.listContacts('u_test')

  await assert.rejects(
    () =>
      backend.updateContact(contacts[0].id, {
        userId: ' u_test ',
        contact: { name: '   ', phone: ' 13900000000 ' },
      }),
    /contact.name 不能为空/
  )

  await backend.updateContact(contacts[0].id, {
    userId: ' u_test ',
    contact: { name: ' Bob ', phone: ' 13900000000 ' },
  })

  const updated = await backend.listContacts('u_test')
  assert.deepEqual(updated.contacts, [{ id: contacts[0].id, name: 'Bob', phone: '13900000000' }])
})

test('local backend inspect bundle returns trusted summary and rejects missing userId', async () => {
  const backend = createBackend()

  await assert.rejects(() => backend.inspectBundle({ contacts: [] }), /本地快照缺少 userId/)

  const inspected = await backend.inspectBundle({
    userId: '  u_bundle  ',
    config: { userId: 'u_bundle', callNumber: '120', smsNumber: '', smsTemplate: '[SOS]{userId}' },
    contacts: [{ name: ' Alice ', phone: ' 13800000000 ' }],
    trackingPoints: [
      {
        deviceId: 'd_test',
        point: {
          lat: 31.23,
          lng: 121.47,
          accuracy: 12,
          speed: 0,
          heading: 30,
          timestamp: '2026-03-25T08:00:00.000Z',
        },
      },
    ],
    sosEvents: [
      {
        deviceId: 'd_test',
        triggerType: 'manual',
        timestamp: '2026-03-25T08:05:00.000Z',
        location: { lat: 31.23, lng: 121.47, accuracy: 12 },
      },
    ],
  })

  assert.equal(inspected.bundle.userId, 'u_bundle')
  assert.deepEqual(inspected.summary, {
    userId: 'u_bundle',
    hasConfig: true,
    contactsCount: 1,
    trackingCount: 1,
    sosCount: 1,
  })
})

test('local backend import rejects invalid persisted payloads instead of silently storing them', async () => {
  const backend = createBackend()

  await assert.rejects(
    () =>
      backend.importBundle({
        userId: 'u_test',
        contacts: [{ name: '   ', phone: '13800000000' }],
        trackingPoints: [
          {
            deviceId: 'd_test',
            point: {
              lat: 31.23,
              lng: 121.47,
              accuracy: 12,
              speed: -1,
              heading: 30,
              timestamp: '2026-03-25T08:00:00.000Z',
            },
          },
        ],
      }),
    /contacts\[0\]\.name 不能为空/
  )
})

test('local backend keeps existing user data when import bundle validation fails', async () => {
  const backend = createBackend()

  await backend.saveEmergencyConfig({
    userId: 'u_test',
    callNumber: '120',
    smsNumber: '13800000000',
    smsTemplate: '[SOS]{userId}',
  })
  await backend.createContact({
    userId: 'u_test',
    contact: { name: 'Alice', phone: '13800000000' },
  })
  await backend.createTrackingPoints({
    userId: 'u_test',
    deviceId: 'd_test',
    points: [
      {
        lat: 31.23,
        lng: 121.47,
        accuracy: 12,
        speed: 0,
        heading: 20,
        timestamp: '2026-03-25T08:00:00.000Z',
      },
    ],
  })
  await backend.triggerSos({
    userId: 'u_test',
    deviceId: 'd_test',
    triggerType: 'manual',
    timestamp: '2026-03-25T08:05:00.000Z',
    location: { lat: 31.23, lng: 121.47, accuracy: 12 },
  })

  const beforeSnapshot = await backend.getSnapshot('u_test')
  const beforeContacts = await backend.listContacts('u_test')
  const beforeTimeline = await backend.getTrackingTimeline(
    'u_test',
    '2026-03-25T07:00:00.000Z',
    '2026-03-25T09:00:00.000Z'
  )
  const beforeSos = await backend.listSosEvents('u_test')

  await assert.rejects(
    () =>
      backend.importBundle({
        userId: 'u_test',
        contacts: [{ name: 'Bob', phone: '13900000000' }],
        trackingPoints: [
          {
            deviceId: 'd_test',
            point: {
              lat: 95,
              lng: 121.47,
              accuracy: 12,
              speed: 0,
              heading: 30,
              timestamp: '2026-03-25T08:10:00.000Z',
            },
          },
        ],
        sosEvents: [
          {
            deviceId: 'd_test',
            triggerType: 'manual',
            timestamp: '2026-03-25T08:15:00.000Z',
            location: { lat: 31.23, lng: 121.47, accuracy: 12 },
          },
        ],
      }),
    /trackingPoints\[0\]\.point\.lat 超出范围/
  )

  const afterSnapshot = await backend.getSnapshot('u_test')
  const afterContacts = await backend.listContacts('u_test')
  const afterTimeline = await backend.getTrackingTimeline(
    'u_test',
    '2026-03-25T07:00:00.000Z',
    '2026-03-25T09:00:00.000Z'
  )
  const afterSos = await backend.listSosEvents('u_test')

  assert.deepEqual(afterSnapshot, beforeSnapshot)
  assert.deepEqual(afterContacts, beforeContacts)
  assert.deepEqual(afterTimeline, beforeTimeline)
  assert.deepEqual(afterSos, beforeSos)
})
