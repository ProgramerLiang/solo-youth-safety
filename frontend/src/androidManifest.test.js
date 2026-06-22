import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs/promises'
import path from 'node:path'

const manifestPath = path.resolve('android/app/src/main/AndroidManifest.xml')

test('AndroidManifest 禁用 allowBackup 且 GPS feature 显式非必需', async () => {
  const manifest = await fs.readFile(manifestPath, 'utf8')

  assert.match(manifest, /<application\b[^>]*\bandroid:allowBackup="false"/)
  assert.match(
    manifest,
    /<uses-feature\b[^>]*\bandroid:name="android\.hardware\.location\.gps"[^>]*\bandroid:required="false"[^>]*\/>/,
  )
})
