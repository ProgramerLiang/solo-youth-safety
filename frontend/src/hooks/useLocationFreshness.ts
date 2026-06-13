import { useState, useEffect } from 'react'

export type FreshnessLevel = 'fresh' | 'stale' | 'outdated' | 'unknown'
export type FreshnessTone = 'success' | 'warning' | 'error' | 'default'

const FRESH_MS = 30_000
const STALE_MS = 120_000
const RECALC_INTERVAL = 15_000

export function getFreshnessLevel(timestampMs: number | null): FreshnessLevel {
  if (timestampMs === null) return 'unknown'
  const age = Date.now() - timestampMs
  if (age < 0) return 'unknown'
  if (age <= FRESH_MS) return 'fresh'
  if (age <= STALE_MS) return 'stale'
  return 'outdated'
}

export function getFreshnessTone(level: FreshnessLevel): FreshnessTone {
  switch (level) {
    case 'fresh': return 'success'
    case 'stale': return 'warning'
    case 'outdated': return 'error'
    case 'unknown': return 'default'
  }
}

export function useLocationFreshness(timestampMs: number | null) {
  const [now, setNow] = useState(Date.now)
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), RECALC_INTERVAL)
    return () => clearInterval(id)
  }, [])

  const age = timestampMs === null ? Infinity : now - timestampMs
  let level: FreshnessLevel
  if (timestampMs === null) {
    level = 'unknown'
  } else if (age < 0) {
    level = 'unknown'
  } else if (age <= FRESH_MS) {
    level = 'fresh'
  } else if (age <= STALE_MS) {
    level = 'stale'
  } else {
    level = 'outdated'
  }
  const tone = getFreshnessTone(level)

  return { level, tone, timestamp: timestampMs }
}