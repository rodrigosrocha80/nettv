import { fetchText } from '../../data/http/httpClient';
import type { AvplayDisplayMode } from '../../platform/tizen';
import { findActiveCue, parseSubtitles, type SubtitleCue } from '../subtitleParser';
import type {
  AspectRatioMode,
  AudioTrack,
  EngineType,
  MediaSourceInput,
  PlayerCallbacks,
  PlayerEngine,
  SubtitleTrack,
} from '../types';

function mapDisplayMode(mode: AspectRatioMode): AvplayDisplayMode {
  switch (mode) {
    case '16:9':
      return 'PLAYER_DISPLAY_MODE_FULL_SCREEN';
    case '4:3':
      return 'PLAYER_DISPLAY_MODE_LETTER_BOX';
    case 'zoom':
      return 'PLAYER_DISPLAY_MODE_CROPPED_FULL';
    case 'fit':
    default:
      return 'PLAYER_DISPLAY_MODE_AUTO_ASPECT_RATIO';
  }
}

function parseExtraInfo(raw?: string): { language?: string; label?: string } {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as { language?: string; track_lang?: string; name?: string };
    return {
      language: parsed.language ?? parsed.track_lang,
      label: parsed.name,
    };
  } catch {
    return {};
  }
}

export class AvplayEngine implements PlayerEngine {
  readonly type: EngineType = 'avplay';
  private callbacks: PlayerCallbacks = {};
  private currentInput: MediaSourceInput | null = null;
  private disposed = false;
  private externalCues: SubtitleCue[] = [];
  private activeExternalSubId: string | null = null;
  private lastPositionMs = 0;
  private aspectRatio: AspectRatioMode = 'fit';

  private getAvplay() {
    return typeof window !== 'undefined' ? window.webapis?.avplay : undefined;
  }

  private safeClose(): void {
    const avplay = this.getAvplay();
    if (!avplay) return;
    try {
      const state = avplay.getState();
      if (state === 'PLAYING' || state === 'PAUSED' || state === 'READY') {
        avplay.stop();
      }
      if (avplay.getState() !== 'NONE') {
        avplay.close();
      }
    } catch {
      // Ignora erros de estado ao fechar instância anterior
    }
  }

  async load(input: MediaSourceInput, callbacks: PlayerCallbacks): Promise<void> {
    this.callbacks = callbacks;
    this.currentInput = input;
    this.disposed = false;
    this.externalCues = [];
    this.activeExternalSubId = null;
    this.lastPositionMs = (input.startPositionSec ?? 0) * 1000;

    const avplay = this.getAvplay();
    if (!avplay) {
      callbacks.onError?.({
        code: 'ENGINE_UNAVAILABLE',
        message: 'API webapis.avplay indisponível neste dispositivo.',
        recoverable: false,
      });
      return;
    }

    this.safeClose();
    callbacks.onStatusChange?.('loading');

    return new Promise<void>((resolve) => {
      let settled = false;
      const settle = () => {
        if (!settled) {
          settled = true;
          resolve();
        }
      };

      try {
        avplay.open(input.url);

        const width = typeof window !== 'undefined' ? window.innerWidth || 1920 : 1920;
        const height = typeof window !== 'undefined' ? window.innerHeight || 1080 : 1080;
        avplay.setDisplayRect(0, 0, width, height);
        avplay.setDisplayMethod(mapDisplayMode(this.aspectRatio));

        avplay.setListener({
          onbufferingstart: () => {
            if (!this.disposed) this.callbacks.onStatusChange?.('buffering');
          },
          onbufferingprogress: (percent) => {
            if (!this.disposed) this.callbacks.onBufferingProgress?.(percent);
          },
          onbufferingcomplete: () => {
            if (!this.disposed) this.callbacks.onStatusChange?.('playing');
          },
          oncurrentplaytime: (currentTimeMs) => {
            if (this.disposed) return;
            this.lastPositionMs = currentTimeMs;
            const durationMs = avplay.getDuration() || (input.durationSec ?? 0) * 1000;
            const posSec = currentTimeMs / 1000;
            this.callbacks.onProgress?.(posSec, durationMs / 1000);

            if (this.activeExternalSubId && this.externalCues.length > 0) {
              this.callbacks.onSubtitleText?.(findActiveCue(this.externalCues, posSec));
            }
          },
          onsubtitlechange: (_duration, text) => {
            if (!this.disposed && !this.activeExternalSubId) {
              this.callbacks.onSubtitleText?.(text ? text.replace(/<[^>]+>/g, '').trim() : null);
            }
          },
          onstreamcompleted: () => {
            if (!this.disposed) {
              this.callbacks.onEnded?.();
            }
          },
          onerror: (eventType) => {
            if (this.disposed) {
              settle();
              return;
            }
            const isCodec =
              eventType.indexOf('NOT_SUPPORTED') !== -1 || eventType.indexOf('CODEC') !== -1;
            this.callbacks.onError?.({
              code: isCodec ? 'CODEC_UNSUPPORTED' : 'STREAM_ERROR',
              message: `Erro AVPlay (${eventType}) ao reproduzir o stream.`,
              recoverable: !isCodec,
            });
            settle();
          },
        });

        avplay.prepareAsync(
          () => {
            if (this.disposed) {
              this.safeClose();
              settle();
              return;
            }

            if (input.startPositionSec && input.startPositionSec > 1 && !input.isLive) {
              try {
                avplay.seekTo(Math.floor(input.startPositionSec * 1000));
              } catch {
                // Alguns streams não suportam seek inicial
              }
            }

            this.emitTracks(input);
            avplay.play();
            this.callbacks.onStatusChange?.('playing');
            settle();
          },
          () => {
            if (!this.disposed) {
              this.callbacks.onError?.({
                code: 'STREAM_ERROR',
                message: 'Falha ao preparar o stream no AVPlay.',
                recoverable: true,
              });
            }
            settle();
          },
        );
      } catch {
        this.callbacks.onError?.({
          code: 'STREAM_ERROR',
          message: 'Erro ao inicializar reprodução no AVPlay.',
          recoverable: true,
        });
        settle();
      }
    });
  }

  private emitTracks(input: MediaSourceInput): void {
    const avplay = this.getAvplay();
    const audio: AudioTrack[] = [];
    const subtitles: SubtitleTrack[] = [];

    if (avplay) {
      try {
        const rawTracks = avplay.getTotalTrackInfo();
        for (let i = 0; i < rawTracks.length; i++) {
          const track = rawTracks[i];
          if (!track) continue;
          const extra = parseExtraInfo(track.extra_info);
          if (track.type === 'AUDIO') {
            audio.push({
              id: `av-audio-${track.index}`,
              index: track.index,
              language: extra.language,
              label: extra.label || extra.language || `Áudio ${audio.length + 1}`,
            });
          } else if (track.type === 'TEXT') {
            subtitles.push({
              id: `av-text-${track.index}`,
              index: track.index,
              language: extra.language,
              label: extra.label || extra.language || `Legenda ${subtitles.length + 1}`,
            });
          }
        }
      } catch {
        // Alguns streams ao vivo não expõem faixas imediatamente
      }
    }

    if (input.externalSubtitles) {
      for (let i = 0; i < input.externalSubtitles.length; i++) {
        const ext = input.externalSubtitles[i];
        if (!ext) continue;
        subtitles.push({
          id: `ext-sub-${i}`,
          index: i,
          label: ext.label,
          language: ext.language,
          externalUrl: ext.url,
        });
      }
    }

    this.callbacks.onTracksChanged?.({ audio, subtitles, qualities: [] });
  }

  play(): Promise<void> {
    const avplay = this.getAvplay();
    if (!avplay) return Promise.resolve();
    try {
      const state = avplay.getState();
      if (state === 'PAUSED' || state === 'READY') {
        avplay.play();
        this.callbacks.onStatusChange?.('playing');
      }
    } catch {
      // Ignora erro de estado
    }
    return Promise.resolve();
  }

  pause(): void {
    const avplay = this.getAvplay();
    if (!avplay) return;
    try {
      if (avplay.getState() === 'PLAYING') {
        avplay.pause();
        this.callbacks.onStatusChange?.('paused');
      }
    } catch {
      // Ignora erro de estado
    }
  }

  stop(): void {
    this.safeClose();
    this.callbacks.onSubtitleText?.(null);
    this.callbacks.onStatusChange?.('idle');
  }

  seek(positionSec: number): void {
    const avplay = this.getAvplay();
    if (!avplay) return;
    try {
      avplay.seekTo(Math.max(0, Math.floor(positionSec * 1000)));
    } catch {
      // Ignora em streams sem seek
    }
  }

  jumpForward(seconds: number): void {
    const avplay = this.getAvplay();
    if (!avplay) return;
    try {
      avplay.jumpForward(Math.floor(seconds * 1000));
    } catch {
      // Ignora em live sem timeshift
    }
  }

  jumpBackward(seconds: number): void {
    const avplay = this.getAvplay();
    if (!avplay) return;
    try {
      avplay.jumpBackward(Math.floor(seconds * 1000));
    } catch {
      // Ignora em live sem timeshift
    }
  }

  setAspectRatio(mode: AspectRatioMode): void {
    this.aspectRatio = mode;
    const avplay = this.getAvplay();
    if (!avplay) return;
    try {
      avplay.setDisplayMethod(mapDisplayMode(mode));
    } catch {
      // Ignora se não estiver em estado compatível
    }
  }

  setAudioTrack(trackId: string): void {
    const avplay = this.getAvplay();
    if (!avplay || trackId.indexOf('av-audio-') !== 0) return;
    const idx = Number.parseInt(trackId.slice(9), 10);
    if (!Number.isFinite(idx)) return;
    try {
      avplay.setSelectTrack('AUDIO', idx);
    } catch {
      // Ignora falha na troca dinâmica
    }
  }

  setSubtitleTrack(trackId: string | null): void {
    const avplay = this.getAvplay();
    this.callbacks.onSubtitleText?.(null);

    if (!trackId) {
      this.activeExternalSubId = null;
      this.externalCues = [];
      if (avplay) {
        try {
          avplay.setSilentSubtitle(true);
        } catch {
          // Ignora
        }
      }
      return;
    }

    if (trackId.indexOf('ext-sub-') === 0) {
      const idx = Number.parseInt(trackId.slice(8), 10);
      const ext = this.currentInput?.externalSubtitles?.[idx];
      if (!ext) return;
      this.activeExternalSubId = trackId;
      if (avplay) {
        try {
          avplay.setSilentSubtitle(true);
        } catch {
          // Ignora
        }
      }
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

    if (avplay && trackId.indexOf('av-text-') === 0) {
      this.activeExternalSubId = null;
      this.externalCues = [];
      const idx = Number.parseInt(trackId.slice(8), 10);
      if (!Number.isFinite(idx)) return;
      try {
        avplay.setSilentSubtitle(false);
        avplay.setSelectTrack('TEXT', idx);
      } catch {
        // Ignora
      }
    }
  }

  setQualityLevel(_levelId: string): void {
    // AVPlay gerencia ABR nativamente para HLS/DASH
  }

  suspend(): void {
    const avplay = this.getAvplay();
    if (!avplay) return;
    try {
      avplay.suspend();
      this.callbacks.onStatusChange?.('paused');
    } catch {
      this.pause();
    }
  }

  resume(): void {
    const avplay = this.getAvplay();
    if (!avplay || !this.currentInput) return;
    try {
      avplay.restore(this.currentInput.url, this.lastPositionMs, true);
      this.callbacks.onStatusChange?.('playing');
    } catch {
      void this.play();
    }
  }

  dispose(): void {
    this.disposed = true;
    this.externalCues = [];
    this.activeExternalSubId = null;
    this.safeClose();
    this.callbacks = {};
    this.currentInput = null;
  }
}
