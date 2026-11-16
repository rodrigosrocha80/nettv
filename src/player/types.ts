import type { ContentKind } from '../domain/types';

export type PlayerStatus = 'idle' | 'loading' | 'buffering' | 'playing' | 'paused' | 'error';

export type StreamFormat = 'hls' | 'dash' | 'mpegts' | 'progressive';

export type AspectRatioMode = 'fit' | '16:9' | '4:3' | 'zoom';

export type EngineType = 'avplay' | 'html5';

export type PlayerErrorCode =
  | 'STREAM_ERROR'
  | 'CODEC_UNSUPPORTED'
  | 'NETWORK_DROP'
  | 'FORMAT_UNSUPPORTED_IN_BROWSER'
  | 'ENGINE_UNAVAILABLE';

export interface PlayerError {
  code: PlayerErrorCode;
  message: string;
  recoverable: boolean;
}

export interface AudioTrack {
  id: string;
  index: number;
  label: string;
  language?: string;
}

export interface SubtitleTrack {
  id: string;
  index: number;
  label: string;
  language?: string;
  externalUrl?: string;
}

export interface QualityLevel {
  id: string;
  index: number;
  label: string;
  height?: number;
  bitrate?: number;
}

export interface MediaSourceInput {
  id: string;
  title: string;
  url: string;
  kind: ContentKind;
  isLive: boolean;
  startPositionSec?: number;
  durationSec?: number;
  channelNumber?: number;
  epgChannelId?: string;
  logoUrl?: string;
  externalSubtitles?: Array<{
    label: string;
    language?: string;
    url: string;
  }>;
}

export interface PlayerCallbacks {
  onStatusChange?: (status: PlayerStatus) => void;
  onProgress?: (positionSec: number, durationSec: number) => void;
  onBufferingProgress?: (percent: number) => void;
  onTracksChanged?: (tracks: {
    audio: AudioTrack[];
    subtitles: SubtitleTrack[];
    qualities: QualityLevel[];
  }) => void;
  onSubtitleText?: (text: string | null) => void;
  onEnded?: () => void;
  onError?: (error: PlayerError) => void;
}

export interface PlayerEngine {
  readonly type: EngineType;
  load(input: MediaSourceInput, callbacks: PlayerCallbacks): Promise<void>;
  play(): Promise<void>;
  pause(): void;
  stop(): void;
  seek(positionSec: number): void;
  jumpForward(seconds: number): void;
  jumpBackward(seconds: number): void;
  setAspectRatio(mode: AspectRatioMode): void;
  setAudioTrack(trackId: string): void;
  setSubtitleTrack(trackId: string | null): void;
  setQualityLevel(levelId: string): void; // 'auto' ou id numérico
  suspend(): void;
  resume(): void;
  dispose(): void;
}
