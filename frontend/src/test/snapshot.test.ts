import { beforeEach, describe, expect, it } from 'vitest'
import packageJson from '../../package.json'
import { exportSnapshot } from '../data/snapshot'

beforeEach(() => {
  localStorage.clear()
})

describe('exportSnapshot', () => {
  it('uses the package version as the snapshot schema marker', async () => {
    const snapshot = await exportSnapshot()

    expect(snapshot.version).toBe(packageJson.version)
  })
})
