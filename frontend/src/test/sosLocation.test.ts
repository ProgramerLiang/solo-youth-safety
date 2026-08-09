import { describe, expect, it, vi } from 'vitest'
import { getSosLocation } from '../data/sosLocation'

const nativeLocation = vi.hoisted(() => ({
  getCurrentPosition: vi.fn(),
}))

vi.mock('../data/locationProvider', () => nativeLocation)

describe('getSosLocation', () => {
  it('returns a fresh provider position without requiring a tracking queue append', async () => {
    nativeLocation.getCurrentPosition.mockResolvedValue({ lat: 31.23, lng: 121.47, accuracy: 8 })

    await expect(getSosLocation()).resolves.toEqual({ lat: 31.23, lng: 121.47, accuracy: 8 })
    expect(nativeLocation.getCurrentPosition).toHaveBeenCalledOnce()
  })

  it('returns null when the provider cannot return a position', async () => {
    nativeLocation.getCurrentPosition.mockResolvedValue(null)

    await expect(getSosLocation()).resolves.toBeNull()
  })
})
