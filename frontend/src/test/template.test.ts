import { describe, it, expect } from 'vitest'
import { renderTemplate, buildMapUrl } from '../domain/template'

const vars = {
  userId: 'user_abc',
  deviceId: 'device_web_123',
  lat: '31.2304',
  lng: '121.4737',
  time: '2026-05-23 14:30:00',
  mapUrl: 'https://uri.amap.com/marker?position=121.4737,31.2304',
}

describe('template', () => {
  it('renders default template when null', () => {
    const result = renderTemplate(null, vars)
    expect(result).toContain('user_abc')
    expect(result).toContain('31.2304')
    expect(result).toContain('uri.amap.com')
  })

  it('renders custom template', () => {
    const result = renderTemplate('{userId} at {lat},{lng}', vars)
    expect(result).toBe('user_abc at 31.2304,121.4737')
  })

  it('falls back to default for whitespace-only template', () => {
    const result = renderTemplate('   ', vars)
    expect(result).toContain('user_abc')
  })

  it('buildMapUrl returns amap URI', () => {
    const url = buildMapUrl(31.2304, 121.4737)
    expect(url).toBe('https://uri.amap.com/marker?position=121.4737,31.2304')
  })
})