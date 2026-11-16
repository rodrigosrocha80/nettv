import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AvplayState } from '../../platform/tizen';
import { selectPlayerEngine } from '../engineSelector';
import { AvplayEngine } from '../engines/AvplayEngine';
import { detectStreamFormat } from '../formatDetector';
import { findActiveCue, parseSubtitles } from '../subtitleParser';

describe('player core utilities & AvplayEngine', () => {
  afterEach(() => {
    delete window.webapis;
    vi.restoreAllMocks();
  });

  it('detects stream format from URLs', () => {
    expect(detectStreamFormat('https://cdn.example.com/live/ch1.m3u8?token=abc')).toBe('hls');
    expect(detectStreamFormat('https://cdn.example.com/vod/manifest.mpd')).toBe('dash');
    expect(detectStreamFormat('http://iptv.example.com/live/u/p/123.ts')).toBe('mpegts');
    expect(detectStreamFormat('https://cdn.example.com/movie/u/p/456.mp4')).toBe('progressive');
  });

  it('selects AvplayEngine on Tizen and HtmlVideoEngine on browser', () => {
    expect(
      selectPlayerEngine({
        isTizen: true,
        hasAvplay: true,
        streamUrl: 'http://host/live/1.ts',
      }),
    ).toEqual({ engineType: 'avplay', format: 'mpegts' });

    expect(
      selectPlayerEngine({
        isTizen: false,
        hasAvplay: false,
        streamUrl: 'https://host/stream.m3u8',
      }),
    ).toEqual({ engineType: 'html5', format: 'hls' });
  });

  it('parses SRT and WebVTT subtitles and locates active cue', () => {
    const srt = `1
00:00:01,000 --> 00:00:03,500
<i>Olá</i> mundo!

2
00:00:05,000 --> 00:00:08,000
Segunda linha`;

    const cues = parseSubtitles(srt);
    expect(cues).toHaveLength(2);
    expect(findActiveCue(cues, 0.5)).toBeNull();
    expect(findActiveCue(cues, 2.0)).toBe('Olá mundo!');
    expect(findActiveCue(cues, 6.0)).toBe('Segunda linha');

    const vtt = `WEBVTT

00:10.000 --> 00:12.500 align:start
Fala VTT`;
    const vttCues = parseSubtitles(vtt);
    expect(vttCues).toHaveLength(1);
    expect(findActiveCue(vttCues, 11)).toBe('Fala VTT');
  });

  it('drives AvplayEngine lifecycle and releases previous instance', async () => {
    let state: AvplayState = 'NONE';
    const mockAvplay = {
      open: vi.fn(() => {
        state = 'IDLE';
      }),
      close: vi.fn(() => {
        state = 'NONE';
      }),
      prepare: vi.fn(),
      prepareAsync: vi.fn((ok: () => void) => {
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
      getCurrentTime: vi.fn(() => 15000),
      getDuration: vi.fn(() => 60000),
      setDisplayRect: vi.fn(),
      setDisplayMethod: vi.fn(),
      getTotalTrackInfo: vi.fn(() => [
        { type: 'AUDIO' as const, index: 1, extra_info: '{"language":"por"}' },
        { type: 'TEXT' as const, index: 2, extra_info: '{"language":"eng"}' },
      ]),
      setSelectTrack: vi.fn(),
      setSilentSubtitle: vi.fn(),
      setListener: vi.fn(),
    };
    window.webapis = { avplay: mockAvplay };

    const engine = new AvplayEngine();
    const statuses: string[] = [];

    await engine.load(
      {
        id: 'vod-1',
        title: 'Filme Teste',
        url: 'https://cdn.example.com/movie.mp4',
        kind: 'vod',
        isLive: false,
        startPositionSec: 15,
      },
      {
        onStatusChange: (s) => statuses.push(s),
      },
    );

    expect(mockAvplay.open).toHaveBeenCalledTimes(1);
    expect(mockAvplay.seekTo).toHaveBeenCalledWith(15000);
    expect(mockAvplay.play).toHaveBeenCalledTimes(1);
    expect(statuses).toContain('playing');

    engine.setAspectRatio('zoom');
    expect(mockAvplay.setDisplayMethod).toHaveBeenCalledWith('PLAYER_DISPLAY_MODE_CROPPED_FULL');

    engine.setAudioTrack('av-audio-1');
    expect(mockAvplay.setSelectTrack).toHaveBeenCalledWith('AUDIO', 1);

    engine.dispose();
    expect(mockAvplay.stop).toHaveBeenCalledTimes(1);
    expect(mockAvplay.close).toHaveBeenCalledTimes(1);
  });
});
