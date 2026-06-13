import { useState, useEffect, useCallback } from 'react'
import type { PageId } from '../types'

function parseHash(): PageId {
  const hash = window.location.hash.replace('#', '') || 'overview'
  const valid: PageId[] = ['overview', 'sos', 'history', 'playback', 'tracking', 'config', 'contacts', 'theme', 'tools']
  if (valid.includes(hash as PageId)) {
    return hash as PageId
  }
  return 'overview'
}

export function useHashRouter(onboardingDone: boolean) {
  const [activePageId, setActivePageId] = useState<PageId>(() => {
    if (!onboardingDone) return 'config'
    return parseHash()
  })

  useEffect(() => {
    const handler = () => {
      setActivePageId(parseHash())
    }
    window.addEventListener('hashchange', handler)
    return () => window.removeEventListener('hashchange', handler)
  }, [])

  useEffect(() => {
    if (!onboardingDone) {
      window.location.hash = 'config'
    }
  }, [onboardingDone])

  const navigate = useCallback((pageId: PageId) => {
    window.location.hash = pageId
  }, [])

  return { activePageId, navigate }
}