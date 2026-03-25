import { Geolocation } from '@capacitor/geolocation'
import { getNativeCurrentPosition } from './nativeLocation'
import { isNativePlatform } from './nativeActions'

const defaultPositionOptions = {
  enableHighAccuracy: true,
  timeout: 10000,
  maximumAge: 3000,
}

const knownPermissionStates = new Set(['prompt', 'prompt-with-rationale', 'granted', 'denied'])

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

function normalizePermissionState(value) {
  if (typeof value !== 'string') {
    return 'unknown'
  }
  const normalized = value.trim()
  return knownPermissionStates.has(normalized) ? normalized : 'unknown'
}

function mergePermissionStates(...states) {
  const normalizedStates = states.map(normalizePermissionState)
  if (normalizedStates.includes('granted')) {
    return 'granted'
  }
  if (normalizedStates.includes('prompt-with-rationale')) {
    return 'prompt-with-rationale'
  }
  if (normalizedStates.includes('prompt')) {
    return 'prompt'
  }
  if (normalizedStates.includes('denied')) {
    return 'denied'
  }
  return 'unknown'
}

function parsePermissionState(status) {
  const location = normalizePermissionState(status?.location)
  const coarseLocation = normalizePermissionState(status?.coarseLocation)
  const preciseGranted = location === 'granted'
  const coarseGranted = coarseLocation === 'granted'
  const canAccessLocation = preciseGranted || coarseGranted

  return {
    location,
    coarseLocation,
    effective: canAccessLocation ? 'granted' : mergePermissionStates(location, coarseLocation),
    preciseGranted,
    coarseGranted,
    canAccessLocation,
  }
}

function formatPermissionStateLabel(state) {
  switch (normalizePermissionState(state)) {
    case 'granted':
      return '已允许'
    case 'prompt':
      return '待申请'
    case 'prompt-with-rationale':
      return '待再次确认'
    case 'denied':
      return '已拒绝'
    default:
      return '未知'
  }
}

function buildPermissionStateSummary(permissionState) {
  if (!permissionState) {
    return ''
  }
  return `权限状态：精确=${formatPermissionStateLabel(permissionState.location)}，大致=${formatPermissionStateLabel(permissionState.coarseLocation)}`
}

function getErrorMessage(error) {
  if (typeof error?.message === 'string' && error.message.trim()) {
    return error.message.trim()
  }
  return 'unknown error'
}

function localizeLocationError(rawMessage, platform) {
  const message = typeof rawMessage === 'string' && rawMessage.trim() ? rawMessage.trim() : 'unknown error'
  if (message.startsWith('双通道定位失败：GMS=')) {
    const body = message.replace('双通道定位失败：GMS=', '')
    const [gmsPart = '', systemPart = ''] = body.split('；System=')
    return `双通道定位失败：GMS=${localizeLocationError(gmsPart, platform)}；System=${localizeLocationError(systemPart, platform)}`
  }

  const normalized = message.toLowerCase()
  if (normalized.includes('location services are not enabled') || normalized.includes('location disabled')) {
    return '系统定位服务未开启，请先在系统设置中打开定位服务'
  }
  if (normalized.includes('google play services not available')) {
    return '设备缺少 Google Play 服务'
  }
  if (
    normalized.includes('location permission was denied') ||
    normalized.includes('user denied geolocation') ||
    normalized.includes('permission denied')
  ) {
    return platform === 'web' ? '浏览器定位权限被拒绝' : '定位权限被拒绝，请允许应用访问位置'
  }
  if (normalized.includes('timeout')) {
    return '定位超时，请移动到空旷区域、窗口附近或室外后重试'
  }
  if (normalized.includes('location unavailable')) {
    return '当前位置暂时不可用，请稍后重试'
  }
  return message
}

function buildPermissionDeniedMessage(permissionState) {
  const summary = buildPermissionStateSummary(permissionState)
  const hint =
    permissionState?.effective === 'denied'
      ? '定位权限未授予，无法刷新当前位置'
      : '定位权限状态未知，无法刷新当前位置'
  return summary ? `${hint}；${summary}` : hint
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
  const resolvedSource = typeof position?.sourceLabel === 'string' ? position.sourceLabel : source

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
    source: resolvedSource,
    providerChannel: typeof position?.providerChannel === 'string' ? position.providerChannel : resolvedSource,
    providerName: typeof position?.providerName === 'string' ? position.providerName : '',
    fallbackFrom: typeof position?.fallbackFrom === 'string' ? position.fallbackFrom : '',
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
  let parsed = parsePermissionState(permission)
  if (!parsed.canAccessLocation && requestIfNeeded) {
    permission = await Geolocation.requestPermissions()
    parsed = parsePermissionState(permission)
  }
  return parsed
}

function buildSamplingProfile(reason) {
  return samplingProfiles[reason] || samplingProfiles.manual
}

function buildAttemptOptions(profile, force, attemptIndex, enableHighAccuracy = true) {
  return {
    ...defaultPositionOptions,
    enableHighAccuracy,
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

async function sampleBestLocation(getPosition, source, reason, force, enableHighAccuracy = true) {
  const profile = buildSamplingProfile(reason)
  const errors = []
  let bestLocation = null
  let successCount = 0
  let attemptedCount = 0

  for (let attemptIndex = 0; attemptIndex < profile.attempts; attemptIndex += 1) {
    attemptedCount = attemptIndex + 1
    try {
      const position = await getPosition(
        buildAttemptOptions(profile, force, attemptIndex, enableHighAccuracy)
      )
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

function appendMessageDetails(message, details) {
  const normalizedDetails = details.filter(Boolean)
  if (normalizedDetails.length === 0) {
    return message
  }
  return `${message}；${normalizedDetails.join('；')}`
}

function buildSuccessMessage(reason, platform, sampling, location, permissionState) {
  const prefix = getSuccessPrefix(reason, platform)
  let message = prefix
  if (location && sampling.attemptedCount > 1) {
    const outcome = sampling.reachedTarget ? '已采用精度最佳结果' : '已采用当前最佳结果'
    const partialFailure = sampling.errorCount > 0 ? '，已忽略失败采样' : ''
    const accuracyInfo = describeLocationAccuracy(location.accuracy)
    const weakHint = accuracyInfo.level === 'weak' ? '；当前精度仍偏弱' : ''
    message = `${prefix}（${sampling.attemptedCount} 次采样成功 ${sampling.successCount} 次，${outcome}${partialFailure}${weakHint}）`
  }

  const details = []
  if (platform === 'native' && typeof location?.providerChannel === 'string' && location.providerChannel.startsWith('system')) {
    details.push('已回退到系统定位')
  }
  if (platform === 'native' && permissionState?.coarseGranted && !permissionState.preciseGranted) {
    details.push('当前系统仅授予大致位置')
  }
  return appendMessageDetails(message, details)
}

function buildFailureMessage(platform, sampling, lastError, permissionState) {
  const prefix = platform === 'web' ? '浏览器定位失败' : '定位刷新失败'
  const localizedError = localizeLocationError(lastError, platform)
  const summary = buildPermissionStateSummary(permissionState)

  if (sampling.attemptedCount > 1) {
    return appendMessageDetails(
      `${prefix}：连续 ${sampling.attemptedCount} 次采样均未成功，最后错误：${localizedError}`,
      [summary]
    )
  }
  return appendMessageDetails(`${prefix}：${localizedError}`, [summary])
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
      permissionDetails: null,
      message: 'web 端不执行原生权限申请',
    }
  }

  if (isNativePlatform()) {
    try {
      const permissionState = await getNativePermissionState(requestIfNeeded)
      if (!permissionState.canAccessLocation) {
        return {
          platform: 'native',
          locationPermission: permissionState.effective,
          location: null,
          sampling: null,
          permissionDetails: permissionState,
          message: buildPermissionDeniedMessage(permissionState),
        }
      }

      const sampled = await sampleBestLocation(
        (options) => getNativeCurrentPosition(options),
        'native',
        reason,
        force,
        permissionState.preciseGranted
      )
      if (!sampled.location) {
        return {
          platform: 'native',
          locationPermission: permissionState.effective,
          location: null,
          sampling: sampled.sampling,
          permissionDetails: permissionState,
          message: buildFailureMessage('native', sampled.sampling, sampled.lastError, permissionState),
        }
      }

      return {
        platform: 'native',
        locationPermission: permissionState.effective,
        location: sampled.location,
        sampling: sampled.sampling,
        permissionDetails: permissionState,
        message: buildSuccessMessage(
          reason,
          'native',
          sampled.sampling,
          sampled.location,
          permissionState
        ),
      }
    } catch (error) {
      return {
        platform: 'native',
        locationPermission: 'error',
        location: null,
        sampling: null,
        permissionDetails: null,
        message: `定位刷新失败：${localizeLocationError(getErrorMessage(error), 'native')}`,
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
        permissionDetails: null,
        message: buildFailureMessage('web', sampled.sampling, sampled.lastError, null),
      }
    }

    return {
      platform: 'web',
      locationPermission: 'granted',
      location: sampled.location,
      sampling: sampled.sampling,
      permissionDetails: null,
      message: buildSuccessMessage(reason, 'web', sampled.sampling, sampled.location, null),
    }
  } catch (error) {
    return {
      platform: 'web',
      locationPermission: 'error',
      location: null,
      sampling: null,
      permissionDetails: null,
      message: `浏览器定位失败：${localizeLocationError(getErrorMessage(error), 'web')}`,
    }
  }
}

export async function requestInitialPermissions() {
  return refreshCurrentLocation({ reason: 'initial', requestIfNeeded: true, force: false })
}
