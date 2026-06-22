import assert from 'node:assert/strict'
import test from 'node:test'

import { Preferences } from '@capacitor/preferences'

import {
  __resetStorageStateForTests,
  readStoredString,
  writeStoredString,
} from './storage.js'

function createLocalStorageMock() {
  const store = new Map()
  return {
    getItem(key) {
      return store.has(key) ? store.get(key) : null
    },
    setItem(key, value) {
      store.set(key, String(value))
    },
    removeItem(key) {
      store.delete(key)
    },
  }
}

test('writeStoredString 在持久化成功后才更新缓存', async () => {
  const localStorage = createLocalStorageMock()
  const previousLocalStorage = globalThis.localStorage
  globalThis.localStorage = localStorage
  __resetStorageStateForTests({
    driver: 'localStorage',
    cacheEntries: [['storage_test_success', 'old-value']],
  })

  try {
    await writeStoredString('storage_test_success', 'new-value')

    assert.equal(readStoredString('storage_test_success'), 'new-value')
    assert.equal(globalThis.localStorage.getItem('storage_test_success'), 'new-value')
  } finally {
    globalThis.localStorage = previousLocalStorage
    __resetStorageStateForTests()
  }
})

test('native 写入失败且 localStorage 不可用时不会污染缓存', async () => {
  const previousLocalStorage = globalThis.localStorage
  const previousSet = Preferences.set
  const previousRemove = Preferences.remove
  delete globalThis.localStorage

  Preferences.set = async () => {
    throw new Error('native set failed')
  }
  Preferences.remove = async () => {
    throw new Error('native remove failed')
  }

  __resetStorageStateForTests({
    driver: 'preferences',
    cacheEntries: [['storage_test_failure', 'stable-value']],
  })

  try {
    await assert.rejects(
      () => writeStoredString('storage_test_failure', 'next-value'),
      /localStorage 不可用/
    )

    assert.equal(readStoredString('storage_test_failure'), 'stable-value')
  } finally {
    Preferences.set = previousSet
    Preferences.remove = previousRemove
    if (previousLocalStorage === undefined) {
      delete globalThis.localStorage
    } else {
      globalThis.localStorage = previousLocalStorage
    }
    __resetStorageStateForTests()
  }
})
