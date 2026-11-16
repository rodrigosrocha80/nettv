import type {
  DeviceInfo,
  PlatformAdapter,
  RemoteKey,
  RemoteKeyListener,
  VisibilityListener,
} from './types';

const TIZEN_KEYS_TO_REGISTER = [
  'MediaPlay',
  'MediaPause',
  'MediaPlayPause',
  'MediaStop',
  'MediaFastForward',
  'MediaRewind',
  'ChannelUp',
  'ChannelDown',
  'ColorF0Red',
  'ColorF1Green',
  'ColorF2Yellow',
  'ColorF3Blue',
  'Info',
  '0',
  '1',
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  '8',
  '9',
] as const;

const KEYCODE_MAP: Record<number, RemoteKey> = {
  37: 'LEFT',
  38: 'UP',
  39: 'RIGHT',
  40: 'DOWN',
  13: 'OK',
  10009: 'BACK',
  27: 'BACK',
  415: 'PLAY',
  19: 'PAUSE',
  10252: 'PLAY_PAUSE',
  413: 'STOP',
  417: 'FAST_FORWARD',
  412: 'REWIND',
  427: 'CH_UP',
  428: 'CH_DOWN',
  403: 'RED',
  404: 'GREEN',
  405: 'YELLOW',
  406: 'BLUE',
  457: 'INFO',
  48: 'NUM_0',
  49: 'NUM_1',
  50: 'NUM_2',
  51: 'NUM_3',
  52: 'NUM_4',
  53: 'NUM_5',
  54: 'NUM_6',
  55: 'NUM_7',
  56: 'NUM_8',
  57: 'NUM_9',
};

const KEYNAME_MAP: Record<string, RemoteKey> = {
  ArrowLeft: 'LEFT',
  ArrowUp: 'UP',
  ArrowRight: 'RIGHT',
  ArrowDown: 'DOWN',
  Enter: 'OK',
  XF86Back: 'BACK',
};

export class TizenPlatform implements PlatformAdapter {
  readonly isTizen = true;
  private keyListeners = new Set<RemoteKeyListener>();
  private visibilityListeners = new Set<VisibilityListener>();
  private initialized = false;

  init(): void {
    if (this.initialized) return;
    this.initialized = true;

    const inputDevice = window.tizen?.tvinputdevice;
    if (inputDevice) {
      for (const keyName of TIZEN_KEYS_TO_REGISTER) {
        try {
          inputDevice.registerKey(keyName);
        } catch {
          // Alguns modelos/emuladores podem não suportar todas as teclas opcionais
        }
      }
    }

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
    let modelName = 'Samsung Smart TV';
    let osVersion = 'Tizen';

    try {
      const model = window.webapis?.productinfo?.getModel?.();
      if (model) modelName = model;
    } catch {
      // Fallback silencioso
    }

    try {
      const tizenVer = window.tizen?.systeminfo?.getCapability(
        'http://tizen.org/feature/platform.version',
      );
      if (typeof tizenVer === 'string' && tizenVer.length > 0) {
        osVersion = `Tizen ${tizenVer}`;
      }
    } catch {
      // Fallback silencioso
    }

    return {
      platform: 'tizen',
      modelName,
      osVersion,
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
    try {
      window.tizen?.application?.getCurrentApplication().exit();
    } catch {
      // Fallback caso executado fora do container completo
    }
  }

  private handleKeyDown = (event: KeyboardEvent): void => {
    const mapped = KEYCODE_MAP[event.keyCode] ?? KEYNAME_MAP[event.key];
    if (!mapped) return;

    if (mapped === 'BACK') {
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
