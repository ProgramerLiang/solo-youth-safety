import { useEffect } from 'react'
import { useHashRouter } from './hooks/useHashRouter'
import { useIdentityStore } from './stores/useIdentityStore'
import { useThemeStore } from './stores/useThemeStore'
import { useDevModeStore } from './stores/useDevModeStore'
import { useConfigStore } from './stores/useConfigStore'
import { useSosStore } from './stores/useSosStore'
import { useTrackingStore } from './stores/useTrackingStore'
import { useContactsStore } from './stores/useContactsStore'
import { useGeofenceStore } from './stores/useGeofenceStore'
import { usePrivacyLockStore } from './stores/usePrivacyLockStore'
import { AppShell } from './shell/AppShell'
import { HomePage } from './pages/HomePage'
import { SosPage } from './pages/SosPage'
import { HistoryPage } from './pages/HistoryPage'
import { PlaybackPage } from './pages/PlaybackPage'
import { TrackingPage } from './pages/TrackingPage'
import { ConfigPage } from './pages/ConfigPage'
import { ContactsPage } from './pages/ContactsPage'
import { ThemePage } from './pages/ThemePage'
import { ToolsPage } from './pages/ToolsPage'
import { RuleEnginePage } from './pages/RuleEnginePage'
import { MembershipPage } from './pages/MembershipPage'
import { AiPage } from './pages/AiPage'
import { ErrorBoundary } from './components/ErrorBoundary'
import type { PageId } from './types'

function pageMap(activePageId: PageId, navigate: (page: PageId) => void): React.ReactElement {
  switch (activePageId) {
    case 'home': return <HomePage onNavigate={navigate} />
    case 'sos': return <SosPage onNavigate={navigate} />
    case 'history': return <HistoryPage />
    case 'playback': return <PlaybackPage />
    case 'tracking': return <TrackingPage />
    case 'config': return <ConfigPage />
    case 'contacts': return <ContactsPage />
    case 'theme': return <ThemePage />
    case 'tools': return <ToolsPage />
    case 'smartRules': return <RuleEnginePage />
    case 'messages': return <div />
    case 'scenes': return <div />
    case 'membership': return <MembershipPage />
    case 'ai': return <AiPage />
    case 'profile': return <div />
    default: return <HomePage onNavigate={navigate} />
  }
}

export function App() {
  const initIdentity = useIdentityStore((s) => s.initialize)
  const loadThemePrefs = useThemeStore((s) => s.initialize)
  const initDevMode = useDevModeStore((s) => s.initialize)
  const initConfig = useConfigStore((s) => s.initialize)
  const initSos = useSosStore((s) => s.initialize)
  const initTracking = useTrackingStore((s) => s.initialize)
  const initContacts = useContactsStore((s) => s.initialize)
  const initGeofence = useGeofenceStore((s) => s.initialize)
  const initPrivacyLock = usePrivacyLockStore((s) => s.initialize)
  const privacyLockLoaded = usePrivacyLockStore((s) => s.loaded)
  const onboardingDone = useConfigStore((s) => s.onboardingDone)

  const { activePageId, navigate } = useHashRouter(onboardingDone)

  useEffect(() => {
    initIdentity()
    loadThemePrefs()
    initDevMode()
    initConfig()
    initSos()
    initTracking()
    initContacts()
    initGeofence()
    initPrivacyLock()
  }, [initIdentity, loadThemePrefs, initDevMode, initConfig, initSos, initTracking, initContacts, initGeofence, initPrivacyLock])

  if (!privacyLockLoaded) {
    return (
      <ErrorBoundary>
        <div aria-label="正在加载隐私设置" />
      </ErrorBoundary>
    )
  }

  return (
    <ErrorBoundary>
      <AppShell activePageId={activePageId} onNavigate={navigate}>
        {pageMap(activePageId, navigate)}
      </AppShell>
    </ErrorBoundary>
  )
}