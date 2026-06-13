export const DEFAULT_TEMPLATE = '[SOS] 用户{userId}触发报警，位置({lat},{lng}) 地图:{mapUrl} 时间:{time}'
export const SIMPLE_TEMPLATE = '[SOS]{time} {userId} @({lat},{lng})'

export interface TemplateVars {
  userId: string
  deviceId: string
  lat: string
  lng: string
  time: string
  mapUrl: string
}

export function renderTemplate(template: string | null | undefined, vars: TemplateVars): string {
  const tpl = (template ?? '').trim() || DEFAULT_TEMPLATE
  return tpl
    .replace(/\{userId\}/g, vars.userId)
    .replace(/\{deviceId\}/g, vars.deviceId)
    .replace(/\{lat\}/g, vars.lat)
    .replace(/\{lng\}/g, vars.lng)
    .replace(/\{time\}/g, vars.time)
    .replace(/\{mapUrl\}/g, vars.mapUrl)
}

export function getDefaultTemplate(): string {
  return DEFAULT_TEMPLATE
}

export function getSimpleTemplate(): string {
  return SIMPLE_TEMPLATE
}

export function getAvailablePlaceholders(): string[] {
  return ['{userId}', '{deviceId}', '{lat}', '{lng}', '{time}', '{mapUrl}']
}

export function buildMapUrl(lat: number, lng: number): string {
  return `https://uri.amap.com/marker?position=${lng},${lat}`
}