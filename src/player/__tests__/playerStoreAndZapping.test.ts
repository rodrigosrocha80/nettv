import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { usePlayerStore } from '../../domain/stores/playerStore';
import type { AvplayListener, AvplayState } from '../../platform/tizen';
import type { MediaSourceInput } from '../types';

function installMockTizenAvplay(options?: { failOnFirst?: boolean }) {
  let state: AvplayState = 'NONE';
  let openCalls = 0;
  let closeCalls = 0;
  let listener: AvplayListener = {};

  const avplay = {
    open: vi.fn(() => {
      openCalls++;
      state = 'IDLE';
    }),
    close: vi.fn(() => {
      closeCalls++;
      state = 'NONE';
    }),
    prepare: vi.fn(),
    prepareAsync: vi.fn((ok: () => void) => {
      if (options?.failOnFirst && openCalls === 1) {
        listener.onerror?.('PLAYER_ERROR_CONNECTION_FAILED');
        return;
      }
      state = 'READY';
      ok();
    }),
    play: vi.fn(() => {
      state = 'PLAYING';
    }),
    pause: vi.fn(() => {
      state = 'PAUSED';
    }),
    stop: vi.fn(() => {
      state = 'IDLE';
    }),
    suspend: vi.fn(),
    restore: vi.fn(),
    seekTo: vi.fn(),
    jumpForward: vi.fn(),
    jumpBackward: vi.fn(),
    getState: vi.fn(() => state),
    getCurrentTime: vi.fn(() => 0),
    getDuration: vi.fn(() => 0),
    setDisplayRect: vi.fn(),
    setDisplayMethod: vi.fn(),
    getTotalTrackInfo: vi.fn(() => []),
    setSelectTrack: vi.fn(),
    setSilentSubtitle: vi.fn(),
    setListener: vi.fn((l: AvplayListener) => {
      listener = l;
    }),
  };

  window.tizen = {};
  window.webapis = { avplay };

  return {
    avplay,
    getCounts: () => ({ openCalls, closeCalls }),
    triggerEnded: () => listener.onstreamcompleted?.(),
  };
}

describe('playerStore state machine, retry backoff, and 100-channel zapping', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    usePlayerStore.getState().dispose();
  });

  afterEach(() => {
    usePlayerStore.getState().dispose();
    delete window.tizen;
    delete window.webapis;
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('retries recoverable stream errors with exponential backoff and recovers', async () => {
    const mock = installMockTizenAvplay({ failOnFirst: true });

    await usePlayerStore.getState().loadMedia({
      id: 'ch-retry',
      title: 'Canal Instável',
      url: 'http://cdn.example.com/live/1.ts',
      kind: 'live',
      isLive: true,
    });

    expect(usePlayerStore.getState().status).toBe('buffering');
    expect(usePlayerStore.getState().retryCount).toBe(1);

    await vi.advanceTimersByTimeAsync(1000);
    expect(mock.getCounts().openCalls).toBe(2);
    expect(usePlayerStore.getState().status).toBe('playing');
    expect(usePlayerStore.getState().retryCount).toBe(0);
  });

  it('performs 100 channel zapping switches cleanly without leaking AVPlay instances', async () => {
    const mock = installMockTizenAvplay();
    const queue: MediaSourceInput[] = Array.from({ length: 10 }, (_, i) => ({
      id: `ch-${i + 1}`,
      channelNumber: i + 1,
      title: `Canal ${i + 1}`,
      url: `http://cdn.example.com/live/${i + 1}.ts`,
      kind: 'live',
      isLive: true,
    }));

    usePlayerStore.getState().setChannelQueue(queue);
    await usePlayerStore.getState().loadMedia(queue[0]!);

    for (let i = 0; i < 100; i++) {
      await usePlayerStore.getState().channelUp();
    }

    const counts = mock.getCounts();
    expect(counts.openCalls).toBe(101);
    // Cada troca fecha a instância anterior antes de abrir a nova (100 closes antes do dispose)
    expect(counts.closeCalls).toBe(100);
    expect(usePlayerStore.getState().status).toBe('playing');

    // Testa volta ao canal anterior e digitação numérica
    const beforePrevId = usePlayerStore.getState().currentMedia?.id;
    await usePlayerStore.getState().switchToPreviousChannel();
    expect(usePlayerStore.getState().currentMedia?.id).not.toBe(beforePrevId);

    usePlayerStore.getState().pushChannelDigit('5');
    await vi.advanceTimersByTimeAsync(1600);
    expect(usePlayerStore.getState().currentMedia?.id).toBe('ch-5');
  });

  it('triggers next episode autoplay countdown when VOD/series episode ends', async () => {
    const mock = installMockTizenAvplay();

    usePlayerStore.getState().setNextEpisodeMedia({
      id: 'ep-2',
      title: 'Episódio 2',
      url: 'https://cdn.example.com/ep2.mp4',
      kind: 'series',
      isLive: false,
    });

    await usePlayerStore.getState().loadMedia({
      id: 'ep-1',
      title: 'Episódio 1',
      url: 'https://cdn.example.com/ep1.mp4',
      kind: 'series',
      isLive: false,
    });

    mock.triggerEnded();
    expect(usePlayerStore.getState().autoplayCountdownSec).toBe(10);

    await vi.advanceTimersByTimeAsync(10000);
    expect(usePlayerStore.getState().currentMedia?.id).toBe('ep-2');
    expect(usePlayerStore.getState().autoplayCountdownSec).toBeNull();
  });
});
