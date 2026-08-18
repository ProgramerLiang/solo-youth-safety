import { useState, useEffect, useCallback } from 'react'
import type { PageId } from '../types'

function parseHash(): PageId {
  const hash = window.location.hash.replace('#', '') || 'home'
  const valid: PageId[] = [
    'home', 'sos', 'history', 'playback', 'tracking',
    'config', 'contacts', 'theme', 'tools', 'smartRules',
    'messages', 'scenes', 'membership', 'profile', 'ai', 'ai-config',
  ]
  if (valid.includes(hash as PageId)) {
    return hash as PageId
  }
  return 'home'
}

export function useHashRouter(_onboardingDone: boolean) {
  const [activePageId, setActivePageId] = useState<PageId>(() => parseHash())

  useEffect(() => {
    const handler = () => {
      setActivePageId(parseHash())
    }
    window.addEventListener('hashchange', handler)
    return () => window.removeEventListener('hashchange', handler)
  }, [])

  const navigate = useCallback((pageId: PageId) => {
    window.location.hash = pageId
  }, [])

  return { activePageId, navigate }
}