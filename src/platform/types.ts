export type RemoteKey =
  | 'UP'
  | 'DOWN'
  | 'LEFT'
  | 'RIGHT'
  | 'OK'
  | 'BACK'
  | 'PLAY'
  | 'PAUSE'
  | 'PLAY_PAUSE'
  | 'STOP'
  | 'FAST_FORWARD'
  | 'REWIND'
  | 'CH_UP'
  | 'CH_DOWN'
  | 'RED'
  | 'GREEN'
  | 'YELLOW'
  | 'BLUE'
  | 'INFO'
  | 'NUM_0'
  | 'NUM_1'
  | 'NUM_2'
  | 'NUM_3'
  | 'NUM_4'
  | 'NUM_5'
  | 'NUM_6'
  | 'NUM_7'
  | 'NUM_8'
  | 'NUM_9';

export interface DeviceInfo {
  platform: 'tizen' | 'browser';
  modelName: string;
  osVersion: string;
  userAgent: string;
}

export type RemoteKeyListener = (key: RemoteKey) => void;
export type VisibilityListener = (isHidden: boolean) => void;

export interface PlatformAdapter {
  readonly isTizen: boolean;
  init(): void;
  dispose(): void;
  getDeviceInfo(): DeviceInfo;
  onRemoteKey(listener: RemoteKeyListener): () => void;
  onVisibilityChange(listener: VisibilityListener): () => void;
  exitApp(): void;
}
