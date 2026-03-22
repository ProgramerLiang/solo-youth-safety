import { Geolocation } from '@capacitor/geolocation'
import { isNativePlatform } from './nativeActions'

const defaultPositionOptions = {
  enableHighAccuracy: true,
  timeout: 10000,
  maximumAge: 3000,
}

function parsePermissionState(status) {
  if (!status) {
    return 'unknown'
  }
  return status.location ?? status.coarseLocation ?? 'unknown'
}

function getErrorMessage(error) {
  if (typeof error?.message === 'string' && error.message.trim()) {
    return error.message
  }
  return 'unknown error'
}

function buildLocation(position, source) {
  return {
    lat: position.coords.latitude,
    lng: position.coords.longitude,
    accuracy: position.coords.accuracy,
    capturedAt: new Date(position.timestamp ?? Date.now()).toISOString(),
    source,
  }
}

function getBrowserPosition(options) {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('当前浏览器不支持定位'))
      return
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, options)
  })
}

async function getNativePermissionState(requestIfNeeded) {
  let permission = await Geolocation.checkPermissions()
  let state = parsePermissionState(permission)
  if (state !== 'granted' && requestIfNeeded) {
    permission = await Geolocation.requestPermissions()
    state = parsePermissionState(permission)
  }
  return state
}

export async function refreshCurrentLocation({
  reason = 'manual',
  requestIfNeeded = true,
  force = true,
} = {}) {
  if (!isNativePlatform() && reason === 'initial') {
    return {
      platform: 'web',
      locationPermission: 'not-required',
      location: null,
      message: 'web 端不执行原生权限申请',
    }
  }

  const positionOptions = {
    ...defaultPositionOptions,
    maximumAge: force ? 0 : defaultPositionOptions.maximumAge,
  }

  if (isNativePlatform()) {
    try {
      const state = await getNativePermissionState(requestIfNeeded)
      if (state !== 'granted') {
        return {
          platform: 'native',
          locationPermission: state,
          location: null,
          message: '定位权限未授予，无法刷新当前位置',
        }
      }

      const position = await Geolocation.getCurrentPosition(positionOptions)
      return {
        platform: 'native',
        locationPermission: state,
        location: buildLocation(position, 'native'),
        message:
          reason === 'initial'
            ? '首次权限申请完成，已获取当前位置'
            : reason === 'sos'
              ? 'SOS 前已刷新当前位置'
              : '已刷新当前位置',
      }
    } catch (error) {
      return {
        platform: 'native',
        locationPermission: 'error',
        location: null,
        message: `定位刷新失败: ${getErrorMessage(error)}`,
      }
    }
  }

  try {
    const position = await getBrowserPosition(positionOptions)
    return {
      platform: 'web',
      locationPermission: 'granted',
      location: buildLocation(position, 'browser'),
      message: reason === 'sos' ? 'SOS 前已刷新浏览器位置' : '浏览器已获取当前位置',
    }
  } catch (error) {
    return {
      platform: 'web',
      locationPermission: 'error',
      location: null,
      message: `浏览器定位失败: ${getErrorMessage(error)}`,
    }
  }
}

export async function requestInitialPermissions() {
  return refreshCurrentLocation({ reason: 'initial', requestIfNeeded: true, force: false })
}
