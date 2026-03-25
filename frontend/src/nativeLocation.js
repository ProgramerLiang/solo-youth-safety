import { Capacitor, registerPlugin } from '@capacitor/core'
import { Geolocation } from '@capacitor/geolocation'

const SystemLocationBridge = registerPlugin('SystemLocationBridge')

function getErrorMessage(error) {
  if (typeof error?.message === 'string' && error.message.trim()) {
    return error.message.trim()
  }
  return 'unknown error'
}

function decoratePosition(position, sourceLabel, providerChannel, providerName, fallbackFrom = '') {
  return {
    ...position,
    sourceLabel,
    providerChannel,
    providerName,
    fallbackFrom,
  }
}

function shouldFallbackToSystemLocation(error) {
  const message = getErrorMessage(error).toLowerCase()
  if (
    message.includes('location permission was denied') ||
    message.includes('permission denied') ||
    message.includes('user denied geolocation') ||
    message.includes('location services are not enabled') ||
    message.includes('location disabled')
  ) {
    return false
  }

  return (
    message.includes('google play services not available') ||
    message.includes('location unavailable') ||
    message.includes('timeout') ||
    message.includes('could not obtain location') ||
    message.includes('fused')
  )
}

export async function getNativeCurrentPosition(options) {
  if (!Capacitor.isNativePlatform()) {
    return Geolocation.getCurrentPosition(options)
  }

  try {
    const position = await Geolocation.getCurrentPosition(options)
    return decoratePosition(position, 'native', 'gms', 'fused', '')
  } catch (primaryError) {
    if (!shouldFallbackToSystemLocation(primaryError)) {
      throw primaryError
    }

    try {
      const position = await SystemLocationBridge.getCurrentPosition(options)
      return decoratePosition(
        position,
        'native',
        typeof position?.providerChannel === 'string' ? position.providerChannel : 'system',
        typeof position?.providerName === 'string' ? position.providerName : 'system',
        'gms'
      )
    } catch (fallbackError) {
      throw new Error(
        `双通道定位失败：GMS=${getErrorMessage(primaryError)}；System=${getErrorMessage(fallbackError)}`
      )
    }
  }
}
