import { FocusContext, useFocusable } from '@noriginmedia/norigin-spatial-navigation';
import { lazy, Suspense, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { logDiagnostic } from './domain/diagnostics';
import { useCatalogStore } from './domain/stores/catalogStore';
import { usePlayerStore } from './domain/stores/playerStore';
import { useProfileStore } from './domain/stores/profileStore';
import { useSettingsStore } from './domain/stores/settingsStore';
import { useSourceStore } from './domain/stores/sourceStore';
import { createPlatformAdapter } from './platform';
import { Button, Modal, SidebarMenu, Skeleton, Toast, type SidebarNavItem } from './ui/components';
import { FocusProvider } from './ui/focus/FocusProvider';
import { HomeScreen } from './ui/screens/HomeScreen';
import { LiveTvScreen } from './ui/screens/LiveTvScreen';
import { MoviesScreen } from './ui/screens/MoviesScreen';
import { OnboardingScreen } from './ui/screens/OnboardingScreen';
import { SeriesScreen } from './ui/screens/SeriesScreen';
import './ui/styles/screens.css';

const PlayerViewport = lazy(() =>
  import('./ui/player/PlayerViewport').then((m) => ({ default: m.PlayerViewport })),
);
const DiagnosticsScreen = lazy(() =>
  import('./ui/screens/DiagnosticsScreen').then((m) => ({ default: m.DiagnosticsScreen })),
);
const FavoritesHistoryScreen = lazy(() =>
  import('./ui/screens/FavoritesHistoryScreen').then((m) => ({
    default: m.FavoritesHistoryScreen,
  })),
);
const ProfilesScreen = lazy(() =>
  import('./ui/screens/ProfilesScreen').then((m) => ({ default: m.ProfilesScreen })),
);
const SearchScreen = lazy(() =>
  import('./ui/screens/SearchScreen').then((m) => ({ default: m.SearchScreen })),
);
const SettingsScreen = lazy(() =>
  import('./ui/screens/SettingsScreen').then((m) => ({ default: m.SettingsScreen })),
);
const DesignSystemShowcase = lazy(() =>
  import('./ui/showcase/DesignSystemShowcase').then((m) => ({ default: m.DesignSystemShowcase })),
);

type AppRoute =
  | 'home'
  | 'live'
  | 'movies'
  | 'series'
  | 'search'
  | 'favorites'
  | 'profiles'
  | 'settings'
  | 'diagnostics'
  | 'onboarding'
  | 'showcase';

function AppShellContainer({ children }: { children: ReactNode }) {
  const { ref, focusKey } = useFocusable({
    focusKey: 'APP_SHELL',
    trackChildren: true,
    focusable: false,
  });
  return (
    <FocusContext.Provider value={focusKey}>
      <div ref={ref} className="ntv-shell">
        {children}
      </div>
    </FocusContext.Provider>
  );
}

function MainContentContainer({ children }: { children: ReactNode }) {
  const { ref, focusKey } = useFocusable({
    focusKey: 'MAIN_CONTENT',
    saveLastFocusedChild: true,
    trackChildren: true,
    focusable: false,
  });
  return (
    <FocusContext.Provider value={focusKey}>
      <main ref={ref} className="ntv-content">
        {children}
      </main>
    </FocusContext.Provider>
  );
}

export function App() {
  const { t, i18n } = useTranslation();
  const platform = useMemo(() => createPlatformAdapter(), []);
  const settingsLanguage = useSettingsStore((s) => s.language);
  const fontScale = useSettingsStore((s) => s.fontScale);

  const loadProfiles = useProfileStore((s) => s.loadProfiles);
  const loadSources = useSourceStore((s) => s.loadSources);
  const sourcesLoaded = useSourceStore((s) => s.loaded);
  const sources = useSourceStore((s) => s.sources);
  const activeSourceId = useSourceStore((s) => s.activeSourceId);
  const refreshSource = useSourceStore((s) => s.refreshSource);
  const loadCatalogForSource = useCatalogStore((s) => s.loadCatalogForSource);

  const [route, setRoute] = useState<AppRoute>('home');
  const [isPlayerOpen, setIsPlayerOpen] = useState(false);
  const [showExitModal, setShowExitModal] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  useEffect(() => {
    if (i18n.language !== settingsLanguage) {
      void i18n.changeLanguage(settingsLanguage);
    }
  }, [i18n, settingsLanguage]);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const scaleMap = { normal: '100%', large: '112%', xlarge: '125%' };
    document.documentElement.style.fontSize = scaleMap[fontScale];
  }, [fontScale]);

  useEffect(() => {
    void Promise.all([loadProfiles(), loadSources()]);
  }, [loadProfiles, loadSources]);

  useEffect(() => {
    if (!sourcesLoaded) return;
    if (sources.length === 0) {
      setRoute('onboarding');
      return;
    }
    if (activeSourceId) {
      void refreshSource(activeSourceId)
        .then(() => loadCatalogForSource(activeSourceId))
        .catch((err) => {
          logDiagnostic(
            'error',
            'data',
            'Falha ao sincronizar fonte ativa.',
            err instanceof Error ? err.message : undefined,
          );
        });
    }
  }, [sourcesLoaded, sources.length, activeSourceId, refreshSource, loadCatalogForSource]);

  const navItems: SidebarNavItem[] = useMemo(
    () => [
      { id: 'home', label: t('nav.home') },
      { id: 'live', label: t('nav.live') },
      { id: 'movies', label: t('nav.movies') },
      { id: 'series', label: t('nav.series') },
      { id: 'search', label: t('nav.search') },
      { id: 'favorites', label: t('nav.favorites') },
      { id: 'profiles', label: t('nav.profiles') },
      { id: 'settings', label: t('nav.settings') },
      { id: 'showcase', label: t('nav.showcase') },
    ],
    [t],
  );

  const handleBack = useCallback(() => {
    if (isPlayerOpen) {
      return;
    }
    if (route === 'diagnostics') {
      setRoute('settings');
      return;
    }
    if (route === 'onboarding' && sources.length > 0) {
      setRoute('profiles');
      return;
    }
    setShowExitModal((prev) => !prev);
  }, [isPlayerOpen, route, sources.length]);

  const deviceInfo = useMemo(() => platform.getDeviceInfo(), [platform]);

  const openPlayer = useCallback(() => {
    setIsPlayerOpen(true);
  }, []);

  const exitPlayer = useCallback(() => {
    usePlayerStore.getState().stop();
    setIsPlayerOpen(false);
  }, []);

  return (
    <FocusProvider platform={platform} onBack={handleBack}>
      {isPlayerOpen ? (
        <div style={{ width: '100vw', height: '100vh' }}>
          <Suspense fallback={<Skeleton width="100%" height="100%" />}>
            <PlayerViewport onExit={exitPlayer} />
          </Suspense>
        </div>
      ) : (
        <AppShellContainer>
          <SidebarMenu
            brand={t('app.name')}
            items={navItems}
            activeId={route === 'diagnostics' ? 'settings' : route}
            onSelect={(id) => setRoute(id as AppRoute)}
            footer={
              <div style={{ fontSize: '18px', color: 'var(--color-text-muted)' }}>
                {deviceInfo.platform === 'tizen' ? 'Tizen TV' : 'Browser'} • {deviceInfo.osVersion}
              </div>
            }
          />

          <MainContentContainer>
            <Suspense fallback={<Skeleton width="100%" height="240px" />}>
              {route === 'onboarding' && (
                <OnboardingScreen
                  onComplete={() => setRoute('home')}
                  onCancel={sources.length > 0 ? () => setRoute('profiles') : undefined}
                />
              )}
              {route === 'home' && (
                <HomeScreen
                  onOpenPlayer={openPlayer}
                  onGoToOnboarding={() => setRoute('onboarding')}
                />
              )}
              {route === 'live' && <LiveTvScreen onOpenPlayer={openPlayer} />}
              {route === 'movies' && <MoviesScreen onOpenPlayer={openPlayer} />}
              {route === 'series' && <SeriesScreen onOpenPlayer={openPlayer} />}
              {route === 'search' && <SearchScreen onOpenPlayer={openPlayer} />}
              {route === 'favorites' && <FavoritesHistoryScreen onOpenPlayer={openPlayer} />}
              {route === 'profiles' && (
                <ProfilesScreen onAddSource={() => setRoute('onboarding')} onNotify={setToastMsg} />
              )}
              {route === 'settings' && (
                <SettingsScreen
                  onOpenDiagnostics={() => setRoute('diagnostics')}
                  onNotify={setToastMsg}
                  onDataCleared={() => setRoute('onboarding')}
                />
              )}
              {route === 'diagnostics' && <DiagnosticsScreen onBack={() => setRoute('settings')} />}
              {route === 'showcase' && <DesignSystemShowcase />}
            </Suspense>
          </MainContentContainer>
        </AppShellContainer>
      )}

      <Toast message={toastMsg} onDismiss={() => setToastMsg(null)} />

      <Modal
        isOpen={showExitModal}
        title={t('app.exitModalTitle')}
        focusKey="EXIT_CONFIRM_MODAL"
        onClose={() => setShowExitModal(false)}
      >
        <p className="ntv-modal-body">{t('app.exitModalDescription')}</p>
        <div>
          <Button
            autoFocus
            variant="secondary"
            focusKey="EXIT_CANCEL"
            onPress={() => setShowExitModal(false)}
          >
            {t('common.cancel')}
          </Button>
          <Button
            variant="danger"
            focusKey="EXIT_CONFIRM"
            onPress={() => {
              platform.exitApp();
              setShowExitModal(false);
            }}
          >
            {t('common.exit')}
          </Button>
        </div>
      </Modal>
    </FocusProvider>
  );
}

export default App;
