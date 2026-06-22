import { apiBasePath, apiToken } from '../config.js'

function buildHeaders(userId, headers = {}) {
  const nextHeaders = {
    'Content-Type': 'application/json',
    ...headers,
  }
  if (userId) {
    nextHeaders['X-User-Id'] = userId
  }
  if (apiToken) {
    nextHeaders['X-Api-Token'] = apiToken
  }
  return nextHeaders
}

function isJsonContentType(contentType = '') {
  return /(^|\s|,)(application\/json|[^\s;,]+\+json)(;|$)/i.test(contentType)
}

async function parseErrorResponse(response) {
  try {
    const payload = await response.json()
    return payload?.detail || JSON.stringify(payload)
  } catch {
    return (await response.text()) || 'request failed'
  }
}

async function parseSuccessResponse(response) {
  if (response.status === 204 || response.status === 205) {
    return null
  }

  const text = await response.text()
  if (!text) {
    return null
  }

  if (isJsonContentType(response.headers.get('content-type') || '')) {
    return JSON.parse(text)
  }

  return text
}

async function request(path, { userId = '', headers = {}, ...options } = {}) {
  const response = await fetch(`${apiBasePath}${path}`, {
    headers: buildHeaders(userId, headers),
    ...options,
  })
  if (!response.ok) {
    throw new Error(await parseErrorResponse(response))
  }
  return parseSuccessResponse(response)
}

export function createRemoteApi() {
  return {
    checkHealth() {
      return request('/health')
    },
    getEmergencyConfig(userId) {
      const q = new URLSearchParams({ userId })
      return request(`/emergency/config?${q.toString()}`, { userId })
    },
    saveEmergencyConfig(payload) {
      return request('/emergency/config', {
        method: 'POST',
        userId: payload?.userId,
        body: JSON.stringify(payload),
      })
    },
    triggerSos(payload) {
      return request('/sos/events', {
        method: 'POST',
        userId: payload?.userId,
        body: JSON.stringify(payload),
      })
    },
    listSosEvents(userId, limit = 20) {
      const q = new URLSearchParams({ userId, limit: String(limit) })
      return request(`/sos/events?${q.toString()}`, { userId })
    },
    createTrackingPoints(payload) {
      return request('/tracking/points', {
        method: 'POST',
        userId: payload?.userId,
        body: JSON.stringify(payload),
      })
    },
    getTrackingTimeline({ userId, from, to }) {
      const q = new URLSearchParams({ userId, from, to })
      return request(`/tracking/timeline?${q.toString()}`, { userId })
    },
    listContacts(userId) {
      const q = new URLSearchParams({ userId })
      return request(`/contacts?${q.toString()}`, { userId })
    },
    createContact(payload) {
      return request('/contacts', {
        method: 'POST',
        userId: payload?.userId,
        body: JSON.stringify(payload),
      })
    },
    updateContact(contactId, payload) {
      return request(`/contacts/${contactId}`, {
        method: 'PUT',
        userId: payload?.userId,
        body: JSON.stringify(payload),
      })
    },
    deleteContact(contactId, userId) {
      const q = new URLSearchParams({ userId })
      return request(`/contacts/${contactId}?${q.toString()}`, {
        method: 'DELETE',
        userId,
      })
    },
  }
}

export { parseSuccessResponse, request }
