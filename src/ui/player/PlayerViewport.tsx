import { useEffect, useRef } from 'react';
import { usePlayerStore } from '../../domain/stores/playerStore';
import { usePlatform } from '../focus/PlatformContext';
import { MiniEpgOverlay } from './MiniEpgOverlay';
import { PlayerControlsOverlay } from './PlayerControlsOverlay';
import '../styles/player.css';

export interface PlayerViewportProps {
  onExit?: () => void;
}

export function PlayerViewport({ onExit }: PlayerViewportProps) {
  const platform = usePlatform();
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const engineType = usePlayerStore((s) => s.engineType);
  const activeSubtitleText = usePlayerStore((s) => s.activeSubtitleText);
  const setVideoElement = usePlayerStore((s) => s.setVideoElement);

  useEffect(() => {
    setVideoElement(videoRef.current);
    return () => {
      setVideoElement(null);
    };
  }, [setVideoElement, engineType]);

  // Ciclo de vida: suspender ao ir para segundo plano e restaurar ao voltar
  useEffect(() => {
    if (!platform) return;
    return platform.onVisibilityChange((isHidden) => {
      const store = usePlayerStore.getState();
      if (isHidden) {
        store.suspend();
      } else {
        store.resume();
      }
    });
  }, [platform]);

  // Reconexão automática em queda de rede
  useEffect(() => {
    const handleOnline = () => {
      const store = usePlayerStore.getState();
      if (store.status === 'error' && store.currentMedia) {
        void store.retryNow();
      }
    };
    window.addEventListener('online', handleOnline);
    return () => {
      window.removeEventListener('online', handleOnline);
    };
  }, []);

  // Teclas de mídia e zapping do controle remoto
  useEffect(() => {
    if (!platform) return;
    return platform.onRemoteKey((key) => {
      const store = usePlayerStore.getState();
      switch (key) {
        case 'PLAY':
          store.play();
          break;
        case 'PAUSE':
          store.pause();
          break;
        case 'PLAY_PAUSE':
          store.togglePlayPause();
          break;
        case 'STOP':
          store.stop();
          onExit?.();
          break;
        case 'FAST_FORWARD':
          store.jumpForward(10);
          store.setControlsVisible(true);
          break;
        case 'REWIND':
          store.jumpBackward(10);
          store.setControlsVisible(true);
          break;
        case 'CH_UP':
          void store.channelUp();
          break;
        case 'CH_DOWN':
          void store.channelDown();
          break;
        case 'INFO':
          store.setControlsVisible(!store.isControlsVisible);
          break;
        case 'BACK':
          if (store.isMiniEpgVisible) {
            store.setMiniEpgVisible(false);
          } else if (store.isControlsVisible) {
            store.setControlsVisible(false);
          } else {
            store.stop();
            onExit?.();
          }
          break;
        default:
          if (key.indexOf('NUM_') === 0) {
            store.pushChannelDigit(key.slice(4));
          }
          break;
      }
    });
  }, [platform, onExit]);

  return (
    <div className="ntv-player-viewport">
      {engineType === 'avplay' ? (
        <object
          id="av-player"
          type="application/avplayer"
          className="ntv-player-surface"
          aria-label="Samsung AVPlay"
        />
      ) : (
        <video ref={videoRef} className="ntv-player-surface" playsInline />
      )}

      {activeSubtitleText ? (
        <div className="ntv-player-subtitle-box" aria-live="polite">
          {activeSubtitleText}
        </div>
      ) : null}

      <PlayerControlsOverlay />
      <MiniEpgOverlay />
    </div>
  );
}
