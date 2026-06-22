export function createRandomId(prefix = 'id') {
  if (globalThis?.crypto?.randomUUID) {
    return `${prefix}_${globalThis.crypto.randomUUID()}`
  }

  const random = Math.random().toString(36).slice(2, 10)
  return `${prefix}_${Date.now()}_${random}`
}
