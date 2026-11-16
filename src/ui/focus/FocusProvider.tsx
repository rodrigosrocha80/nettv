import { useEffect, type ReactNode } from 'react';
import {
  SpatialNavigation,
  getCurrentFocusKey,
  init,
  navigateByDirection,
  pause,
  resume,
  setFocus,
} from '@noriginmedia/norigin-spatial-navigation';
import type { PlatformAdapter, RemoteKey } from '../../platform';
import { consumeModalBack, hasOpenModal } from './modalBackStack';
import { PlatformContext } from './PlatformContext';

let isSpatialNavInitialized = false;

function ensureSpatialNavInitialized() {
  if (isSpatialNavInitialized) return;
  isSpatialNavInitialized = true;
  init({
    debug: false,
    visualDebug: false,
    shouldFocusDOMNode: false,
    shouldUseNativeEvents: false,
  });
}

interface FocusProviderProps {
  platform: PlatformAdapter;
  onBack?: () => void;
  onRemoteKey?: (key: RemoteKey) => void;
  children: ReactNode;
}

export function FocusProvider({ platform, onBack, onRemoteKey, children }: FocusProviderProps) {
  // Inicializa antes dos efeitos dos filhos (useFocusable) para garantir layoutAdapter pronto
  ensureSpatialNavInitialized();

  useEffect(() => {
    resume();
    platform.init();

    const unsubscribe = platform.onRemoteKey((key) => {
      onRemoteKey?.(key);

      switch (key) {
        case 'UP':
          void navigateByDirection('up');
          break;
        case 'DOWN':
          void navigateByDirection('down');
          break;
        case 'LEFT': {
          const before = getCurrentFocusKey();
          void navigateByDirection('left');
          if (
            !hasOpenModal() &&
            before &&
            before.indexOf('SIDEBAR_') !== 0 &&
            getCurrentFocusKey() === before
          ) {
            void setFocus('SIDEBAR_MENU');
          }
          break;
        }
        case 'RIGHT':
          void navigateByDirection('right');
          break;
        case 'OK':
          SpatialNavigation.onEnterPress({ pressedKeys: {} });
          break;
        case 'BACK':
          if (!consumeModalBack()) {
            onBack?.();
          }
          break;
        default:
          break;
      }
    });

    return () => {
      unsubscribe();
      platform.dispose();
      pause();
    };
  }, [platform, onBack, onRemoteKey]);

  return <PlatformContext.Provider value={platform}>{children}</PlatformContext.Provider>;
}
