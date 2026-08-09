import { describe, expect, it } from 'vitest'
import { saveExportFile } from '../native/nativeExport'

describe('native export contract', () => {
  it('falls back cleanly on web when Android Downloads is unavailable', async () => {
    await expect(saveExportFile('test.json', 'application/json', '{}')).resolves.toEqual({ saved: false, location: null })
  })
})
