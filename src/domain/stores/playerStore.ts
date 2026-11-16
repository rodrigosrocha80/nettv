import { create } from 'zustand';
import { selectPlayerEngine } from '../../player/engineSelector';
import { AvplayEngine } from '../../player/engines/AvplayEngine';
import { HtmlVideoEngine } from '../../player/engines/HtmlVideoEngine';
import type {
  AspectRatioMode,
  AudioTrack,
  EngineType,
  MediaSourceInput,
  PlayerEngine,
  PlayerError,
  PlayerStatus,
  QualityLevel,
  SubtitleTrack,
} from '../../player/types';
import { useProfileStore } from './profileStore';

const RETRY_DELAYS_MS = [1000, 2000, 4000];
const HISTORY_SAVE_INTERVAL_SEC = 10;

export interface PlayerStoreState {
  status: PlayerStatus;
  error: PlayerError | null;
  retryCount: number;
  currentMedia: MediaSourceInput | null;
  previousMedia: MediaSourceInput | null;
  channelQueue: MediaSourceInput[];
  nextEpisodeMedia: MediaSourceInput | null;
  autoplayCountdownSec: number | null;

  positionSec: number;
  durationSec: number;
  bufferingPercent: number;
  aspectRatio: AspectRatioMode;
  engineType: EngineType;
  preferredEngine: EngineType | 'auto';

  audioTracks: AudioTrack[];
  subtitleTracks: SubtitleTrack[];
  qualityLevels: QualityLevel[];
  activeAudioTrackId: string | null;
  activeSubtitleTrackId: string | null;
  activeQualityLevelId: string;
  activeSubtitleText: string | null;

  channelNumberBuffer: string;
  isControlsVisible: boolean;
  isMiniEpgVisible: boolean;

  setVideoElement: (el: HTMLVideoElement | null) => void;
  setChannelQueue: (queue: MediaSourceInput[]) => void;
  setNextEpisodeMedia: (next: MediaSourceInput | null) => void;
  loadMedia: (input: MediaSourceInput, options?: { isRetry?: boolean }) => Promise<void>;
  togglePlayPause: () => void;
  play: () => void;
  pause: () => void;
  stop: () => void;
  seek: (positionSec: number) => void;
  jumpForward: (seconds?: number) => void;
  jumpBackward: (seconds?: number) => void;
  channelUp: () => Promise<void>;
  channelDown: () => Promise<void>;
  switchToPreviousChannel: () => Promise<void>;
  pushChannelDigit: (digit: string) => void;
  commitChannelNumberBuffer: () => Promise<void>;
  setAspectRatio: (mode: AspectRatioMode) => void;
  cycleAspectRatio: () => void;
  setAudioTrack: (trackId: string) => void;
  setSubtitleTrack: (trackId: string | null) => void;
  setQualityLevel: (levelId: string) => void;
  switchEngine: () => Promise<void>;
  retryNow: () => Promise<void>;
  playNextEpisode: () => Promise<void>;
  cancelAutoplay: () => void;
  suspend: () => void;
  resume: () => void;
  setControlsVisible: (visible: boolean) => void;
  setMiniEpgVisible: (visible: boolean) => void;
  dispose: () => void;
}

let activeEngine: PlayerEngine | null = null;
let videoElRef: HTMLVideoElement | null = null;
let pendingHtml5Input: MediaSourceInput | null = null;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let numberTimer: ReturnType<typeof setTimeout> | null = null;
let autoplayTimer: ReturnType<typeof setInterval> | null = null;
let lastHistorySavedAtSec = -1;

function clearTimers(): void {
  if (retryTimer) {
    clearTimeout(retryTimer);
    retryTimer = null;
  }
  if (numberTimer) {
    clearTimeout(numberTimer);
    numberTimer = null;
  }
  if (autoplayTimer) {
    clearInterval(autoplayTimer);
    autoplayTimer = null;
  }
}

function createEngineInstance(type: EngineType): PlayerEngine {
  if (type === 'avplay') {
    return new AvplayEngine();
  }
  return new HtmlVideoEngine(videoElRef);
}

function flushHistory(media: MediaSourceInput | null, pos: number, dur: number): void {
  if (!media || media.isLive || pos <= 0) return;
  void useProfileStore.getState().recordHistory(media.id, media.kind, pos, dur);
}

export const usePlayerStore = create<PlayerStoreState>((set, get) => {
  const scheduleRetry = (err: PlayerError) => {
    const attempt = get().retryCount;
    if (!err.recoverable || attempt >= RETRY_DELAYS_MS.length) {
      set({ status: 'error', error: err });
      return;
    }

    const delayMs = RETRY_DELAYS_MS[attempt] ?? 4000;
    set({ status: 'buffering', error: null, retryCount: attempt + 1 });

    if (retryTimer) clearTimeout(retryTimer);
    retryTimer = setTimeout(() => {
      const current = get().currentMedia;
      if (current) {
        void get().loadMedia(current, { isRetry: true });
      }
    }, delayMs);
  };

  const startAutoplayCountdown = () => {
    const next = get().nextEpisodeMedia;
    if (!next) return;
    if (autoplayTimer) clearInterval(autoplayTimer);
    set({ autoplayCountdownSec: 10 });

    autoplayTimer = setInterval(() => {
      const remaining = get().autoplayCountdownSec;
      if (remaining === null) {
        if (autoplayTimer) clearInterval(autoplayTimer);
        return;
      }
      if (remaining <= 1) {
        if (autoplayTimer) clearInterval(autoplayTimer);
        autoplayTimer = null;
        void get().playNextEpisode();
      } else {
        set({ autoplayCountdownSec: remaining - 1 });
      }
    }, 1000);
  };

  return {
    status: 'idle',
    error: null,
    retryCount: 0,
    currentMedia: null,
    previousMedia: null,
    channelQueue: [],
    nextEpisodeMedia: null,
    autoplayCountdownSec: null,

    positionSec: 0,
    durationSec: 0,
    bufferingPercent: 0,
    aspectRatio: 'fit',
    engineType: 'html5',
    preferredEngine: 'auto',

    audioTracks: [],
    subtitleTracks: [],
    qualityLevels: [],
    activeAudioTrackId: null,
    activeSubtitleTrackId: null,
    activeQualityLevelId: 'auto',
    activeSubtitleText: null,

    channelNumberBuffer: '',
    isControlsVisible: true,
    isMiniEpgVisible: false,

    setVideoElement: (el) => {
      videoElRef = el;
      if (activeEngine instanceof HtmlVideoEngine) {
        activeEngine.attachVideoElement(el);
      }
      if (el && pendingHtml5Input) {
        const queued = pendingHtml5Input;
        pendingHtml5Input = null;
        void get().loadMedia(queued, { isRetry: true });
      }
    },

    setChannelQueue: (queue) => set({ channelQueue: queue }),

    setNextEpisodeMedia: (next) => set({ nextEpisodeMedia: next }),

    loadMedia: async (input, options) => {
      if (retryTimer) {
        clearTimeout(retryTimer);
        retryTimer = null;
      }
      if (autoplayTimer) {
        clearInterval(autoplayTimer);
        autoplayTimer = null;
      }

      const prev = get().currentMedia;
      if (!options?.isRetry && prev && prev.id !== input.id) {
        flushHistory(prev, get().positionSec, get().durationSec);
      }

      const isTizen = typeof window !== 'undefined' && Boolean(window.tizen);
      const hasAvplay = typeof window !== 'undefined' && Boolean(window.webapis?.avplay);

      const selection = selectPlayerEngine({
        isTizen,
        hasAvplay,
        preferredEngine: get().preferredEngine,
        streamUrl: input.url,
      });

      if (activeEngine && activeEngine.type !== selection.engineType) {
        activeEngine.dispose();
        activeEngine = null;
      }
      if (!activeEngine) {
        activeEngine = createEngineInstance(selection.engineType);
      }

      lastHistorySavedAtSec = -1;

      set({
        status: 'loading',
        error: null,
        retryCount: options?.isRetry ? get().retryCount : 0,
        previousMedia:
          !options?.isRetry && prev && prev.id !== input.id ? prev : get().previousMedia,
        currentMedia: input,
        engineType: selection.engineType,
        positionSec: input.startPositionSec ?? 0,
        durationSec: input.durationSec ?? 0,
        audioTracks: [],
        subtitleTracks: [],
        qualityLevels: [],
        activeAudioTrackId: null,
        activeSubtitleTrackId: null,
        activeQualityLevelId: 'auto',
        activeSubtitleText: null,
        autoplayCountdownSec: null,
      });

      activeEngine.setAspectRatio(get().aspectRatio);

      if (selection.engineType === 'html5' && !videoElRef) {
        pendingHtml5Input = input;
        return;
      }
      pendingHtml5Input = null;

      await activeEngine.load(input, {
        onStatusChange: (status) => {
          if (status === 'playing') {
            set({ status, error: null, retryCount: 0 });
          } else {
            set({ status });
          }
        },
        onProgress: (pos, dur) => {
          set({ positionSec: pos, durationSec: dur });
          if (!input.isLive && Math.abs(pos - lastHistorySavedAtSec) >= HISTORY_SAVE_INTERVAL_SEC) {
            lastHistorySavedAtSec = pos;
            flushHistory(input, pos, dur);
          }
        },
        onBufferingProgress: (percent) => {
          set({ bufferingPercent: percent });
        },
        onTracksChanged: ({ audio, subtitles, qualities }) => {
          set({
            audioTracks: audio,
            subtitleTracks: subtitles,
            qualityLevels: qualities,
            activeAudioTrackId: audio[0]?.id ?? null,
          });
        },
        onSubtitleText: (text) => {
          set({ activeSubtitleText: text });
        },
        onEnded: () => {
          flushHistory(input, get().durationSec || get().positionSec, get().durationSec);
          set({ status: 'idle' });
          if (get().nextEpisodeMedia) {
            startAutoplayCountdown();
          }
        },
        onError: (err) => {
          scheduleRetry(err);
        },
      });
    },

    togglePlayPause: () => {
      const status = get().status;
      if (status === 'playing') {
        get().pause();
      } else if (status === 'paused') {
        get().play();
      }
    },

    play: () => {
      void activeEngine?.play();
    },

    pause: () => {
      flushHistory(get().currentMedia, get().positionSec, get().durationSec);
      activeEngine?.pause();
    },

    stop: () => {
      clearTimers();
      pendingHtml5Input = null;
      flushHistory(get().currentMedia, get().positionSec, get().durationSec);
      activeEngine?.stop();
      set({
        status: 'idle',
        activeSubtitleText: null,
        autoplayCountdownSec: null,
      });
    },

    seek: (positionSec) => {
      activeEngine?.seek(positionSec);
      set({ positionSec });
    },

    jumpForward: (seconds = 10) => {
      activeEngine?.jumpForward(seconds);
    },

    jumpBackward: (seconds = 10) => {
      activeEngine?.jumpBackward(seconds);
    },

    channelUp: async () => {
      const queue = get().channelQueue;
      const curr = get().currentMedia;
      if (queue.length === 0) return;
      const idx = curr ? queue.findIndex((c) => c.id === curr.id) : -1;
      const nextIdx = (idx + 1) % queue.length;
      const next = queue[nextIdx];
      if (next) {
        await get().loadMedia(next);
      }
    },

    channelDown: async () => {
      const queue = get().channelQueue;
      const curr = get().currentMedia;
      if (queue.length === 0) return;
      const idx = curr ? queue.findIndex((c) => c.id === curr.id) : 0;
      const prevIdx = (idx - 1 + queue.length) % queue.length;
      const prev = queue[prevIdx];
      if (prev) {
        await get().loadMedia(prev);
      }
    },

    switchToPreviousChannel: async () => {
      const prev = get().previousMedia;
      if (prev) {
        await get().loadMedia(prev);
      }
    },

    pushChannelDigit: (digit) => {
      if (!/^\d$/.test(digit)) return;
      const nextBuffer = (get().channelNumberBuffer + digit).slice(-4);
      set({ channelNumberBuffer: nextBuffer });

      if (numberTimer) clearTimeout(numberTimer);
      numberTimer = setTimeout(() => {
        void get().commitChannelNumberBuffer();
      }, 1500);
    },

    commitChannelNumberBuffer: async () => {
      if (numberTimer) {
        clearTimeout(numberTimer);
        numberTimer = null;
      }
      const raw = get().channelNumberBuffer;
      set({ channelNumberBuffer: '' });
      if (!raw) return;

      const num = Number.parseInt(raw, 10);
      const queue = get().channelQueue;
      const target = queue.find((c) => c.channelNumber === num) ?? queue[num - 1];
      if (target) {
        await get().loadMedia(target);
      }
    },

    setAspectRatio: (mode) => {
      set({ aspectRatio: mode });
      activeEngine?.setAspectRatio(mode);
    },

    cycleAspectRatio: () => {
      const modes: AspectRatioMode[] = ['fit', '16:9', '4:3', 'zoom'];
      const current = get().aspectRatio;
      const next = modes[(modes.indexOf(current) + 1) % modes.length] ?? 'fit';
      get().setAspectRatio(next);
    },

    setAudioTrack: (trackId) => {
      set({ activeAudioTrackId: trackId });
      activeEngine?.setAudioTrack(trackId);
    },

    setSubtitleTrack: (trackId) => {
      set({ activeSubtitleTrackId: trackId, activeSubtitleText: null });
      activeEngine?.setSubtitleTrack(trackId);
    },

    setQualityLevel: (levelId) => {
      set({ activeQualityLevelId: levelId });
      activeEngine?.setQualityLevel(levelId);
    },

    switchEngine: async () => {
      const nextPref: EngineType = get().engineType === 'avplay' ? 'html5' : 'avplay';
      set({ preferredEngine: nextPref });
      const current = get().currentMedia;
      if (current) {
        await get().loadMedia({
          ...current,
          startPositionSec: get().positionSec,
        });
      }
    },

    retryNow: async () => {
      const current = get().currentMedia;
      if (!current) return;
      set({ retryCount: 0, error: null });
      await get().loadMedia(current);
    },

    playNextEpisode: async () => {
      const next = get().nextEpisodeMedia;
      if (!next) return;
      set({ nextEpisodeMedia: null, autoplayCountdownSec: null });
      await get().loadMedia(next);
    },

    cancelAutoplay: () => {
      if (autoplayTimer) {
        clearInterval(autoplayTimer);
        autoplayTimer = null;
      }
      set({ autoplayCountdownSec: null });
    },

    suspend: () => {
      flushHistory(get().currentMedia, get().positionSec, get().durationSec);
      activeEngine?.suspend();
    },

    resume: () => {
      activeEngine?.resume();
    },

    setControlsVisible: (visible) => set({ isControlsVisible: visible }),
    setMiniEpgVisible: (visible) => set({ isMiniEpgVisible: visible }),

    dispose: () => {
      clearTimers();
      pendingHtml5Input = null;
      flushHistory(get().currentMedia, get().positionSec, get().durationSec);
      if (activeEngine) {
        activeEngine.dispose();
        activeEngine = null;
      }
      set({
        status: 'idle',
        error: null,
        retryCount: 0,
        currentMedia: null,
        activeSubtitleText: null,
        autoplayCountdownSec: null,
        channelNumberBuffer: '',
      });
    },
  };
});
