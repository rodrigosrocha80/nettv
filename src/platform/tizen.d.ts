interface TizenInputKey {
  name: string;
  code: number;
}

interface TizenTvInputDevice {
  getSupportedKeys(): TizenInputKey[];
  registerKey(keyName: string): void;
  unregisterKey(keyName: string): void;
}

interface TizenApplication {
  exit(): void;
}

interface TizenApplicationManager {
  getCurrentApplication(): TizenApplication;
}

interface TizenSystemInfo {
  getCapability(key: string): string | boolean | number;
}

interface TizenGlobal {
  tvinputdevice?: TizenTvInputDevice;
  application?: TizenApplicationManager;
  systeminfo?: TizenSystemInfo;
}

interface WebapisProductInfo {
  getModel?(): string;
  getFirmware?(): string;
}

export type AvplayState = 'NONE' | 'IDLE' | 'READY' | 'PLAYING' | 'PAUSED';

export type AvplayDisplayMode =
  | 'PLAYER_DISPLAY_MODE_LETTER_BOX'
  | 'PLAYER_DISPLAY_MODE_ORIGIN_SIZE'
  | 'PLAYER_DISPLAY_MODE_FULL_SCREEN'
  | 'PLAYER_DISPLAY_MODE_CROPPED_FULL'
  | 'PLAYER_DISPLAY_MODE_ORIGIN_OR_LETTER'
  | 'PLAYER_DISPLAY_MODE_AUTO_ASPECT_RATIO';

export interface AvplayTrackInfo {
  type: 'AUDIO' | 'TEXT' | 'VIDEO';
  index: number;
  extra_info?: string;
}

export interface AvplayListener {
  onbufferingstart?: () => void;
  onbufferingprogress?: (percent: number) => void;
  onbufferingcomplete?: () => void;
  oncurrentplaytime?: (currentTimeMs: number) => void;
  onevent?: (eventType: string, eventData: string) => void;
  onerror?: (eventType: string) => void;
  onsubtitlechange?: (duration: number, text: string, data3?: string, data4?: string) => void;
  ondrmevent?: (drmEvent: string, drmData: string) => void;
  onstreamcompleted?: () => void;
}

interface WebapisAvplay {
  open(url: string): void;
  close(): void;
  prepare(): void;
  prepareAsync(successCallback: () => void, errorCallback?: (err: unknown) => void): void;
  play(): void;
  pause(): void;
  stop(): void;
  suspend(): void;
  restore(url?: string, resumeTimeMs?: number, prepare?: boolean): void;
  seekTo(
    milliseconds: number,
    successCallback?: () => void,
    errorCallback?: (err: unknown) => void,
  ): void;
  jumpForward(
    milliseconds: number,
    successCallback?: () => void,
    errorCallback?: (err: unknown) => void,
  ): void;
  jumpBackward(
    milliseconds: number,
    successCallback?: () => void,
    errorCallback?: (err: unknown) => void,
  ): void;
  getState(): AvplayState;
  getCurrentTime(): number;
  getDuration(): number;
  setDisplayRect(x: number, y: number, width: number, height: number): void;
  setDisplayMethod(displayMode: AvplayDisplayMode): void;
  getTotalTrackInfo(): AvplayTrackInfo[];
  setSelectTrack(type: 'AUDIO' | 'TEXT', index: number): void;
  setSilentSubtitle(onOff: boolean): void;
  setListener(listener: AvplayListener): void;
}

interface WebapisGlobal {
  productinfo?: WebapisProductInfo;
  avplay?: WebapisAvplay;
}

declare global {
  const __APP_VERSION__: string;
  interface Window {
    tizen?: TizenGlobal;
    webapis?: WebapisGlobal;
  }
}

export {};
