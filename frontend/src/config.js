export const appVersion = __APP_VERSION__

const defaultDevApiBaseUrl = 'http://127.0.0.1:8000'
const rawApiBaseUrl = (import.meta.env.VITE_API_BASE_URL || '').trim()

function resolveApiBaseUrl() {
  if (rawApiBaseUrl) {
    return rawApiBaseUrl.replace(/\/$/, '')
  }

  if (import.meta.env.DEV) {
    return defaultDevApiBaseUrl
  }

  throw new Error(
    'Missing VITE_API_BASE_URL for production build/runtime. Set it to your deployed backend origin, for example https://api.example.com.',
  )
}

export const apiBaseUrl = resolveApiBaseUrl()
export const apiBasePath = `${apiBaseUrl}/api/v1`
export const apiToken = (import.meta.env.VITE_API_TOKEN || '').trim()
