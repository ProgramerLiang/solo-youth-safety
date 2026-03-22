import { Geolocation } from '@capacitor/geolocation'
import { isNativePlatform } from './nativeActions'

const defaultPositionOptions = {
  enableHighAccuracy: true,
  timeout: 10000,
  maximumAge: 3000,
}

const samplingProfiles = {
  initial: {
    attempts: 2,
    targetAccuracy: 50,
    pauseMs: 900,
    retryTimeout: 5000,
  },
  manual: {
    attempts: 3,
    targetAccuracy: 35,
    pauseMs: 1000,
    retryTimeout: 4500,
  },
  sos: {
    attempts: 3,
    targetAccuracy: 30,
    pauseMs: 1200,
    retryTimeout: 4500,
  },
  tracking: {
    attempts: 2,
    targetAccuracy: 60,
    pauseMs: 700,
    retryTimeout: 3500,
  },
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

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function toAccuracyScore(value) {
  const accuracy = Number(value)
  return Number.isFinite(accuracy) && accuracy > 0 ? accuracy : Number.POSITIVE_INFINITY
}

function roundAccuracy(value) {
  const accuracy = toAccuracyScore(value)
  return Number.isFinite(accuracy) ? Number(accuracy.toFixed(1)) : null
}

export function describeLocationAccuracy(accuracy) {
  const score = toAccuracyScore(accuracy)
  if (!Number.isFinite(score)) {
    return {
      level: 'unknown',
      label: '未知',
      hint: '定位模块未返回可用精度',
    }
  }
  if (score <= 20) {
    return {
      level: 'excellent',
      label: '很准',
      hint: '精度很好，可直接用于 SOS 和轨迹采样',
    }
  }
  if (score <= 50) {
    return {
      level: 'good',
      label: '良好',
      hint: '精度可接受，适合当前 MVP 场景',
    }
  }
  if (score <= 100) {
    return {
      level: 'fair',
      label: '一般',
      hint: '可继续使用，但建议靠近窗口或室外后再次刷新',
    }
  }
  return {
    level: 'weak',
    label: '较弱',
    hint: '精度偏弱，建议移动到空旷区域、窗口附近或室外重试',
  }
}

function buildLocation(position, source) {
  const accuracy = roundAccuracy(position.coords.accuracy)
  const accuracyInfo = describeLocationAccuracy(accuracy)

  return {
    lat: position.coords.latitude,
    lng: position.coords.longitude,
    accuracy: accuracy ?? undefined,
    accuracyLevel: accuracyInfo.level,
    accuracyLabel: accuracyInfo.label,
    accuracyHint: accuracyInfo.hint,
    speed: Number.isFinite(Number(position.coords.speed)) ? Number(position.coords.speed) : 0,
    heading: Number.isFinite(Number(position.coords.heading)) ? Number(position.coords.heading) : 0,
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

function buildSamplingProfile(reason) {
  return samplingProfiles[reason] || samplingProfiles.manual
}

function buildAttemptOptions(profile, force, attemptIndex) {
  return {
    ...defaultPositionOptions,
    timeout: attemptIndex === 0 ? defaultPositionOptions.timeout : profile.retryTimeout,
    maximumAge: attemptIndex === 0 && !force ? defaultPositionOptions.maximumAge : 0,
  }
}

function shouldReplaceBest(bestLocation, nextLocation) {
  if (!bestLocation) {
    return true
  }
  const bestScore = toAccuracyScore(bestLocation.accuracy)
  const nextScore = toAccuracyScore(nextLocation.accuracy)
  if (nextScore < bestScore) {
    return true
  }
  return nextScore === bestScore && nextLocation.capturedAt > bestLocation.capturedAt
}

async function sampleBestLocation(getPosition, source, reason, force) {
  const profile = buildSamplingProfile(reason)
  const errors = []
  let bestLocation = null
  let successCount = 0
  let attemptedCount = 0

  for (let attemptIndex = 0; attemptIndex < profile.attempts; attemptIndex += 1) {
    attemptedCount = attemptIndex + 1
    try {
      const position = await getPosition(buildAttemptOptions(profile, force, attemptIndex))
      const location = buildLocation(position, source)
      successCount += 1
      if (shouldReplaceBest(bestLocation, location)) {
        bestLocation = location
      }
      if (toAccuracyScore(bestLocation?.accuracy) <= profile.targetAccuracy) {
        break
      }
    } catch (error) {
      errors.push(getErrorMessage(error))
    }

    const hasNextAttempt = attemptIndex < profile.attempts - 1
    if (hasNextAttempt && toAccuracyScore(bestLocation?.accuracy) > profile.targetAccuracy) {
      await wait(profile.pauseMs)
    }
  }

  return {
    location: bestLocation,
    sampling: {
      attemptedCount,
      successCount,
      errorCount: errors.length,
      targetAccuracy: profile.targetAccuracy,
      reachedTarget: toAccuracyScore(bestLocation?.accuracy) <= profile.targetAccuracy,
      errors,
    },
    lastError: errors[errors.length - 1] || '',
  }
}

function getSuccessPrefix(reason, platform) {
  if (reason === 'initial') {
    return '首次权限申请完成，已获取当前位置'
  }
  if (reason === 'sos') {
    return platform === 'web' ? 'SOS 前已刷新浏览器位置' : 'SOS 前已刷新当前位置'
  }
  if (reason === 'tracking') {
    return '轨迹采样已刷新当前位置'
  }
  return platform === 'web' ? '浏览器已获取当前位置' : '已刷新当前位置'
}

function buildSuccessMessage(reason, platform, sampling, location) {
  const prefix = getSuccessPrefix(reason, platform)
  if (!location || sampling.attemptedCount <= 1) {
    return prefix
  }

  const outcome = sampling.reachedTarget ? '已采用精度最佳结果' : '已采用当前最佳结果'
  const partialFailure = sampling.errorCount > 0 ? '，已忽略失败采样' : ''
  const accuracyInfo = describeLocationAccuracy(location.accuracy)
  const weakHint = accuracyInfo.level === 'weak' ? '；当前精度仍偏弱' : ''
  return `${prefix}（${sampling.attemptedCount} 次采样成功 ${sampling.successCount} 次，${outcome}${partialFailure}${weakHint}）`
}

function buildFailureMessage(platform, sampling, lastError) {
  const prefix = platform === 'web' ? '浏览器定位失败' : '定位刷新失败'
  if (sampling.attemptedCount > 1) {
    return `${prefix}：连续 ${sampling.attemptedCount} 次采样均未成功，最后错误: ${lastError || 'unknown error'}`
  }
  return `${prefix}: ${lastError || 'unknown error'}`
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
      sampling: null,
      message: 'web 端不执行原生权限申请',
    }
  }

  if (isNativePlatform()) {
    try {
      const state = await getNativePermissionState(requestIfNeeded)
      if (state !== 'granted') {
        return {
          platform: 'native',
          locationPermission: state,
          location: null,
          sampling: null,
          message: '定位权限未授予，无法刷新当前位置',
        }
      }

      const sampled = await sampleBestLocation(
        (options) => Geolocation.getCurrentPosition(options),
        'native',
        reason,
        force
      )
      if (!sampled.location) {
        return {
          platform: 'native',
          locationPermission: state,
          location: null,
          sampling: sampled.sampling,
          message: buildFailureMessage('native', sampled.sampling, sampled.lastError),
        }
      }

      return {
        platform: 'native',
        locationPermission: state,
        location: sampled.location,
        sampling: sampled.sampling,
        message: buildSuccessMessage(reason, 'native', sampled.sampling, sampled.location),
      }
    } catch (error) {
      return {
        platform: 'native',
        locationPermission: 'error',
        location: null,
        sampling: null,
        message: `定位刷新失败: ${getErrorMessage(error)}`,
      }
    }
  }

  try {
    const sampled = await sampleBestLocation(getBrowserPosition, 'browser', reason, force)
    if (!sampled.location) {
      return {
        platform: 'web',
        locationPermission: 'error',
        location: null,
        sampling: sampled.sampling,
        message: buildFailureMessage('web', sampled.sampling, sampled.lastError),
      }
    }

    return {
      platform: 'web',
      locationPermission: 'granted',
      location: sampled.location,
      sampling: sampled.sampling,
      message: buildSuccessMessage(reason, 'web', sampled.sampling, sampled.location),
    }
  } catch (error) {
    return {
      platform: 'web',
      locationPermission: 'error',
      location: null,
      sampling: null,
      message: `浏览器定位失败: ${getErrorMessage(error)}`,
    }
  }
}

export async function requestInitialPermissions() {
  return refreshCurrentLocation({ reason: 'initial', requestIfNeeded: true, force: false })
}
