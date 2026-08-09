import { getCurrentPosition } from './locationProvider'
import type { LocationResult } from '../native/nativeLocation'

export async function getSosLocation(): Promise<LocationResult | null> {
  return getCurrentPosition()
}
