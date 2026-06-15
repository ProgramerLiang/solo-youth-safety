import { storage } from './storage'
import { runLocationSelfTest } from '../native/nativeLocation'
import type { LocationSelfTestReport } from '../native/nativeLocation'

export const LOCATION_SELF_TEST_KEY = 'safety_v2_location_self_test'

export async function loadLocationSelfTestReport(): Promise<LocationSelfTestReport | null> {
  return storage.getJson<LocationSelfTestReport>(LOCATION_SELF_TEST_KEY)
}

export async function saveLocationSelfTestReport(report: LocationSelfTestReport): Promise<void> {
  await storage.setJson(LOCATION_SELF_TEST_KEY, report)
}

export async function runAndSaveLocationSelfTest(now = new Date()): Promise<LocationSelfTestReport> {
  const report = await runLocationSelfTest(now)
  await saveLocationSelfTestReport(report)
  return report
}
