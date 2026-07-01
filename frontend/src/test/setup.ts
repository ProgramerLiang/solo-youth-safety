import '@testing-library/jest-dom'

// Guard: happy-dom may not initialise localStorage in some vitest runs.
// Provide a minimal shim so that tests relying on localStorage.clear/ .getItem/ .setItem don't crash.
if (typeof localStorage === 'undefined') {
  const store: Record<string, string> = {}
  ;(globalThis as Record<string, unknown>).localStorage = {
    getItem(key: string) { return key in store ? store[key]! : null },
    setItem(key: string, value: string) { store[key] = value },
    removeItem(key: string) { delete store[key] },
    clear() { Object.keys(store).forEach(k => delete store[k]) },
  }
}