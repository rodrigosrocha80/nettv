import Hls from 'hls.js';
import { fetchText } from '../../data/http/httpClient';
import { detectStreamFormat } from '../formatDetector';
import { findActiveCue, parseSubtitles, type SubtitleCue } from '../subtitleParser';
import type {
  AspectRatioMode,
  AudioTrack,
  EngineType,
  MediaSourceInput,
  PlayerCallbacks,
  PlayerEngine,
  QualityLevel,
  SubtitleTrack,
} from '../types';

export class HtmlVideoEngine implements PlayerEngine {
  readonly type: EngineType = 'html5';
  private video: HTMLVideoElement | null = null;
  private hls: Hls | null = null;
  private callbacks: PlayerCallbacks = {};
  private currentInput: MediaSourceInput | null = null;
  private cleanupFns: Array<() => void> = [];
  private externalCues: SubtitleCue[] = [];
  private activeExternalSubId: string | null = null;
  private disposed = false;

  constructor(videoElement?: HTMLVideoElement | null) {
    this.video = videoElement ?? null;
  }

  attachVideoElement(videoElement: HTMLVideoElement | null): void {
    this.video = videoElement;
  }

  private cleanupPlayback(): void {
    for (let i = 0; i < this.cleanupFns.length; i++) {
      this.cleanupFns[i]?.();
    }
    this.cleanupFns = [];

    if (this.hls) {
      this.hls.destroy();
      this.hls = null;
    }

    if (this.video) {
      this.video.pause();
      this.video.removeAttribute('src');
      this.video.load();
    }
  }

  private bindVideoEvents(video: HTMLVideoElement, input: MediaSourceInput): void {
    const onWaiting = () => {
      if (!this.disposed) this.callbacks.onStatusChange?.('buffering');
    };
    const onPlaying = () => {
      if (!this.disposed) this.callbacks.onStatusChange?.('playing');
    };
    const onPause = () => {
      if (!this.disposed && !video.ended) this.callbacks.onStatusChange?.('paused');
    };
    const onEnded = () => {
      if (!this.disposed) this.callbacks.onEnded?.();
    };
    const onTimeUpdate = () => {
      if (this.disposed) return;
      const pos = video.currentTime || 0;
      const dur = Number.isFinite(video.duration) ? video.duration : (input.durationSec ?? 0);
      this.callbacks.onProgress?.(pos, dur);

      if (this.activeExternalSubId && this.externalCues.length > 0) {
        this.callbacks.onSubtitleText?.(findActiveCue(this.externalCues, pos));
      }
    };
    const onError = () => {
      if (this.disposed) return;
      this.callbacks.onError?.({
        code: 'STREAM_ERROR',
        message: 'Falha ao reproduzir o stream de vídeo no player HTML5.',
        recoverable: true,
      });
    };

    video.addEventListener('waiting', onWaiting);
    video.addEventListener('playing', onPlaying);
    video.addEventListener('pause', onPause);
    video.addEventListener('ended', onEnded);
    video.addEventListener('timeupdate', onTimeUpdate);
    video.addEventListener('error', onError);

    this.cleanupFns.push(() => {
      video.removeEventListener('waiting', onWaiting);
      video.removeEventListener('playing', onPlaying);
      video.removeEventListener('pause', onPause);
      video.removeEventListener('ended', onEnded);
      video.removeEventListener('timeupdate', onTimeUpdate);
      video.removeEventListener('error', onError);
    });
  }

  private buildExternalSubtitleTracks(input: MediaSourceInput): SubtitleTrack[] {
    if (!input.externalSubtitles) return [];
    return input.externalSubtitles.map((ext, idx) => ({
      id: `ext-sub-${idx}`,
      index: idx,
      label: ext.label,
      language: ext.language,
      externalUrl: ext.url,
    }));
  }

  async load(input: MediaSourceInput, callbacks: PlayerCallbacks): Promise<void> {
    this.disposed = false;
    this.callbacks = callbacks;
    this.currentInput = input;
    this.externalCues = [];
    this.activeExternalSubId = null;

    this.cleanupPlayback();

    const video = this.video;
    if (!video) {
      callbacks.onError?.({
        code: 'ENGINE_UNAVAILABLE',
        message: 'Elemento <video> não montado.',
        recoverable: false,
      });
      return;
    }

    const format = detectStreamFormat(input.url);
    if (format === 'mpegts') {
      callbacks.onError?.({
        code: 'FORMAT_UNSUPPORTED_IN_BROWSER',
        message:
          'Streams MPEG-TS (.ts) requerem o motor nativo AVPlay na TV/emulador Samsung Tizen.',
        recoverable: false,
      });
      return;
    }

    callbacks.onStatusChange?.('loading');
    this.bindVideoEvents(video, input);

    const extSubs = this.buildExternalSubtitleTracks(input);

    if (format === 'hls' && Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: input.isLive,
      });
      this.hls = hls;

      const emitHlsTracks = () => {
        const audio: AudioTrack[] = hls.audioTracks.map((t, idx) => ({
          id: `hls-audio-${idx}`,
          index: idx,
          label: t.name || t.lang || `Áudio ${idx + 1}`,
          language: t.lang,
        }));
        const embeddedSubs: SubtitleTrack[] = hls.subtitleTracks.map((t, idx) => ({
          id: `hls-sub-${idx}`,
          index: idx,
          label: t.name || t.lang || `Legenda ${idx + 1}`,
          language: t.lang,
        }));
        const qualities: QualityLevel[] = hls.levels.map((lvl, idx) => ({
          id: `hls-lvl-${idx}`,
          index: idx,
          label: lvl.height ? `${lvl.height}p` : `${Math.round(lvl.bitrate / 1000)} kbps`,
          height: lvl.height,
          bitrate: lvl.bitrate,
        }));

        this.callbacks.onTracksChanged?.({
          audio,
          subtitles: [...embeddedSubs, ...extSubs],
          qualities,
        });
      };

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        if (this.disposed) return;
        emitHlsTracks();
        if (input.startPositionSec && input.startPositionSec > 1 && !input.isLive) {
          video.currentTime = input.startPositionSec;
        }
        void video.play().catch(() => {
          this.callbacks.onStatusChange?.('paused');
        });
      });

      hls.on(Hls.Events.AUDIO_TRACKS_UPDATED, emitHlsTracks);
      hls.on(Hls.Events.SUBTITLE_TRACKS_UPDATED, emitHlsTracks);

      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (this.disposed || !data.fatal) return;
        if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
          this.callbacks.onError?.({
            code: 'NETWORK_DROP',
            message: 'Queda de rede durante o streaming HLS.',
            recoverable: true,
          });
        } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
          hls.recoverMediaError();
        } else {
          this.callbacks.onError?.({
            code: 'STREAM_ERROR',
            message: 'Erro fatal no stream HLS.',
            recoverable: true,
          });
        }
      });

      hls.loadSource(input.url);
      hls.attachMedia(video);
      return;
    }

    // Fallback nativo (Safari/Tizen HLS nativo ou MP4/WebM progressivo)
    this.callbacks.onTracksChanged?.({ audio: [], subtitles: extSubs, qualities: [] });
    video.src = input.url;
    if (input.startPositionSec && input.startPositionSec > 1 && !input.isLive) {
      video.currentTime = input.startPositionSec;
    }
    try {
      await video.play();
    } catch {
      this.callbacks.onStatusChange?.('paused');
    }
  }

  async play(): Promise<void> {
    if (!this.video) return;
    await this.video.play();
    this.callbacks.onStatusChange?.('playing');
  }

  pause(): void {
    if (!this.video) return;
    this.video.pause();
    this.callbacks.onStatusChange?.('paused');
  }

  stop(): void {
    this.cleanupPlayback();
    this.callbacks.onSubtitleText?.(null);
    this.callbacks.onStatusChange?.('idle');
  }

  seek(positionSec: number): void {
    if (!this.video) return;
    this.video.currentTime = Math.max(0, positionSec);
  }

  jumpForward(seconds: number): void {
    if (!this.video) return;
    this.video.currentTime = Math.max(0, (this.video.currentTime || 0) + seconds);
  }

  jumpBackward(seconds: number): void {
    if (!this.video) return;
    this.video.currentTime = Math.max(0, (this.video.currentTime || 0) - seconds);
  }

  setAspectRatio(mode: AspectRatioMode): void {
    if (!this.video) return;
    const style = this.video.style;
    switch (mode) {
      case '16:9':
        style.objectFit = 'fill';
        style.width = '100%';
        style.height = '100%';
        break;
      case '4:3':
        style.objectFit = 'fill';
        style.width = '75%';
        style.height = '100%';
        break;
      case 'zoom':
        style.objectFit = 'cover';
        style.width = '100%';
        style.height = '100%';
        break;
      case 'fit':
      default:
        style.objectFit = 'contain';
        style.width = '100%';
        style.height = '100%';
        break;
    }
  }

  setAudioTrack(trackId: string): void {
    if (!this.hls || trackId.indexOf('hls-audio-') !== 0) return;
    const idx = Number.parseInt(trackId.slice(10), 10);
    if (Number.isFinite(idx)) {
      this.hls.audioTrack = idx;
    }
  }

  setSubtitleTrack(trackId: string | null): void {
    this.callbacks.onSubtitleText?.(null);

    if (!trackId) {
      this.activeExternalSubId = null;
      this.externalCues = [];
      if (this.hls) this.hls.subtitleTrack = -1;
      return;
    }

    if (trackId.indexOf('ext-sub-') === 0) {
      if (this.hls) this.hls.subtitleTrack = -1;
      const idx = Number.parseInt(trackId.slice(8), 10);
      const ext = this.currentInput?.externalSubtitles?.[idx];
      if (!ext) return;
      this.activeExternalSubId = trackId;
      void fetchText(ext.url)
        .then((res) => {
          if (this.activeExternalSubId === trackId) {
            this.externalCues = parseSubtitles(res.data);
          }
        })
        .catch(() => {
          this.externalCues = [];
        });
      return;
    }

    if (this.hls && trackId.indexOf('hls-sub-') === 0) {
      this.activeExternalSubId = null;
      this.externalCues = [];
      const idx = Number.parseInt(trackId.slice(8), 10);
      if (Number.isFinite(idx)) {
        this.hls.subtitleTrack = idx;
      }
    }
  }

  setQualityLevel(levelId: string): void {
    if (!this.hls) return;
    if (levelId === 'auto') {
      this.hls.currentLevel = -1;
      return;
    }
    if (levelId.indexOf('hls-lvl-') === 0) {
      const idx = Number.parseInt(levelId.slice(8), 10);
      if (Number.isFinite(idx)) {
        this.hls.currentLevel = idx;
      }
    }
  }

  suspend(): void {
    this.pause();
  }

  resume(): void {
    void this.play();
  }

  dispose(): void {
    this.disposed = true;
    this.externalCues = [];
    this.activeExternalSubId = null;
    this.cleanupPlayback();
    this.callbacks = {};
    this.currentInput = null;
  }
}
