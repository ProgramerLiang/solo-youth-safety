const API_BASE = 'http://127.0.0.1:8000/api/v1'
const DEFAULT_USER = 'u_123'

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

export async function checkHealth() {
  return request('/health')
}

export async function getEmergencyConfig(userId = DEFAULT_USER) {
  const q = new URLSearchParams({ userId })
  return request(`/emergency/config?${q.toString()}`)
}

export async function saveEmergencyConfig(payload) {
  return request('/emergency/config', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function triggerSos(payload) {
  return request('/sos/events', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export { DEFAULT_USER }
