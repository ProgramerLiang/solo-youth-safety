import { Geolocation } from '@capacitor/geolocation'
import { isNativePlatform } from './nativeActions'

function parsePermissionState(status) {
  if (!status) {
    return 'unknown'
  }
  return status.location ?? status.coarseLocation ?? 'unknown'
}

export async function requestInitialPermissions() {
  if (!isNativePlatform()) {
    return {
      platform: 'web',
      locationPermission: 'not-required',
      location: null,
      message: 'web 端不执行原生权限申请',
    }
  }

  try {
    const permission = await Geolocation.requestPermissions()
    const state = parsePermissionState(permission)
    if (state !== 'granted') {
      return {
        platform: 'native',
        locationPermission: state,
        location: null,
        message: '定位权限未授予，后续可在系统设置中开启',
      }
    }

    const pos = await Geolocation.getCurrentPosition({
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 3000,
    })

    return {
      platform: 'native',
      locationPermission: state,
      location: {
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
      },
      message: '首次权限申请完成，已获取当前位置',
    }
  } catch (error) {
    return {
      platform: 'native',
      locationPermission: 'error',
      location: null,
      message: `权限申请失败: ${error.message}`,
    }
  }
}
