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
import { AppShell } from './shell/AppShell'
import { OverviewPage } from './pages/OverviewPage'
import { SosPage } from './pages/SosPage'
import { HistoryPage } from './pages/HistoryPage'
import { PlaybackPage } from './pages/PlaybackPage'
import { TrackingPage } from './pages/TrackingPage'
import { ConfigPage } from './pages/ConfigPage'
import { ContactsPage } from './pages/ContactsPage'
import { ThemePage } from './pages/ThemePage'
import { ToolsPage } from './pages/ToolsPage'
import { ErrorBoundary } from './components/ErrorBoundary'
import type { PageId } from './types'

const pageMap: Record<PageId, React.ReactElement> = {
  overview: <OverviewPage />,
  sos: <SosPage />,
  history: <HistoryPage />,
  playback: <PlaybackPage />,
  tracking: <TrackingPage />,
  config: <ConfigPage />,
  contacts: <ContactsPage />,
  theme: <ThemePage />,
  tools: <ToolsPage />,
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
  }, [initIdentity, loadThemePrefs, initDevMode, initConfig, initSos, initTracking, initContacts, initGeofence])

  return (
    <ErrorBoundary>
      <AppShell activePageId={activePageId} onNavigate={navigate}>
        {pageMap[activePageId]}
      </AppShell>
    </ErrorBoundary>
  )
}