import type {
  DeviceInfo,
  PlatformAdapter,
  RemoteKey,
  RemoteKeyListener,
  VisibilityListener,
} from './types';

const BROWSER_KEY_MAP: Record<string, RemoteKey> = {
  ArrowLeft: 'LEFT',
  ArrowUp: 'UP',
  ArrowRight: 'RIGHT',
  ArrowDown: 'DOWN',
  Enter: 'OK',
  Escape: 'BACK',
  Backspace: 'BACK',
  ' ': 'PLAY_PAUSE',
  p: 'PLAY',
  P: 'PLAY',
  s: 'STOP',
  S: 'STOP',
  f: 'FAST_FORWARD',
  F: 'FAST_FORWARD',
  r: 'REWIND',
  R: 'REWIND',
  PageUp: 'CH_UP',
  PageDown: 'CH_DOWN',
  F1: 'RED',
  F2: 'GREEN',
  F3: 'YELLOW',
  F4: 'BLUE',
  i: 'INFO',
  I: 'INFO',
  '0': 'NUM_0',
  '1': 'NUM_1',
  '2': 'NUM_2',
  '3': 'NUM_3',
  '4': 'NUM_4',
  '5': 'NUM_5',
  '6': 'NUM_6',
  '7': 'NUM_7',
  '8': 'NUM_8',
  '9': 'NUM_9',
};

export class BrowserMockPlatform implements PlatformAdapter {
  readonly isTizen = false;
  private keyListeners = new Set<RemoteKeyListener>();
  private visibilityListeners = new Set<VisibilityListener>();
  private initialized = false;

  init(): void {
    if (this.initialized) return;
    this.initialized = true;

    window.addEventListener('keydown', this.handleKeyDown);
    document.addEventListener('visibilitychange', this.handleVisibilityChange);
  }

  dispose(): void {
    if (!this.initialized) return;
    this.initialized = false;

    window.removeEventListener('keydown', this.handleKeyDown);
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    this.keyListeners.clear();
    this.visibilityListeners.clear();
  }

  getDeviceInfo(): DeviceInfo {
    return {
      platform: 'browser',
      modelName: 'Browser Simulator',
      osVersion: navigator.platform || 'Web',
      userAgent: navigator.userAgent,
    };
  }

  onRemoteKey(listener: RemoteKeyListener): () => void {
    this.keyListeners.add(listener);
    return () => {
      this.keyListeners.delete(listener);
    };
  }

  onVisibilityChange(listener: VisibilityListener): () => void {
    this.visibilityListeners.add(listener);
    return () => {
      this.visibilityListeners.delete(listener);
    };
  }

  exitApp(): void {
    // Em navegador não fechamos a aba programaticamente; apenas registramos a intenção
    console.info('[BrowserMockPlatform] exitApp() invoked');
  }

  private handleKeyDown = (event: KeyboardEvent): void => {
    const target = event.target as HTMLElement | null;
    const isInput =
      target !== null &&
      (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);

    // Não interceptar digitação normal dentro de inputs (exceto Escape)
    if (isInput && event.key !== 'Escape') {
      return;
    }

    const mapped = BROWSER_KEY_MAP[event.key];
    if (!mapped) return;

    if (mapped === 'BACK' || mapped === 'PLAY_PAUSE' || mapped.startsWith('F')) {
      event.preventDefault();
    }

    for (const listener of this.keyListeners) {
      listener(mapped);
    }
  };

  private handleVisibilityChange = (): void => {
    const hidden = document.hidden;
    for (const listener of this.visibilityListeners) {
      listener(hidden);
    }
  };
}
