import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getCurrentAndNextProgram } from '../../data/db/epgRepository';
import type { EpgProgram } from '../../domain/types';
import { usePlayerStore } from '../../domain/stores/playerStore';
import { Button } from '../components/Button';

function formatTimeSec(totalSec: number): string {
  if (!Number.isFinite(totalSec) || totalSec <= 0) return '00:00';
  const s = Math.floor(totalSec);
  const hours = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const secs = s % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return hours > 0 ? `${hours}:${pad(mins)}:${pad(secs)}` : `${pad(mins)}:${pad(secs)}`;
}

export function PlayerControlsOverlay() {
  const { t } = useTranslation();
  const status = usePlayerStore((s) => s.status);
  const error = usePlayerStore((s) => s.error);
  const currentMedia = usePlayerStore((s) => s.currentMedia);
  const positionSec = usePlayerStore((s) => s.positionSec);
  const durationSec = usePlayerStore((s) => s.durationSec);
  const aspectRatio = usePlayerStore((s) => s.aspectRatio);
  const engineType = usePlayerStore((s) => s.engineType);
  const audioTracks = usePlayerStore((s) => s.audioTracks);
  const subtitleTracks = usePlayerStore((s) => s.subtitleTracks);
  const qualityLevels = usePlayerStore((s) => s.qualityLevels);
  const activeAudioTrackId = usePlayerStore((s) => s.activeAudioTrackId);
  const activeSubtitleTrackId = usePlayerStore((s) => s.activeSubtitleTrackId);
  const activeQualityLevelId = usePlayerStore((s) => s.activeQualityLevelId);
  const channelNumberBuffer = usePlayerStore((s) => s.channelNumberBuffer);
  const isControlsVisible = usePlayerStore((s) => s.isControlsVisible);
  const autoplayCountdownSec = usePlayerStore((s) => s.autoplayCountdownSec);

  const togglePlayPause = usePlayerStore((s) => s.togglePlayPause);
  const jumpBackward = usePlayerStore((s) => s.jumpBackward);
  const jumpForward = usePlayerStore((s) => s.jumpForward);
  const switchToPreviousChannel = usePlayerStore((s) => s.switchToPreviousChannel);
  const cycleAspectRatio = usePlayerStore((s) => s.cycleAspectRatio);
  const setAudioTrack = usePlayerStore((s) => s.setAudioTrack);
  const setSubtitleTrack = usePlayerStore((s) => s.setSubtitleTrack);
  const setQualityLevel = usePlayerStore((s) => s.setQualityLevel);
  const setMiniEpgVisible = usePlayerStore((s) => s.setMiniEpgVisible);
  const retryNow = usePlayerStore((s) => s.retryNow);
  const switchEngine = usePlayerStore((s) => s.switchEngine);
  const playNextEpisode = usePlayerStore((s) => s.playNextEpisode);
  const cancelAutoplay = usePlayerStore((s) => s.cancelAutoplay);

  const [epg, setEpg] = useState<{ current?: EpgProgram; next?: EpgProgram }>({});

  useEffect(() => {
    let active = true;
    if (!currentMedia?.epgChannelId) {
      setEpg({});
      return;
    }
    void getCurrentAndNextProgram(currentMedia.epgChannelId).then((res) => {
      if (active) setEpg(res);
    });
    return () => {
      active = false;
    };
  }, [currentMedia?.id, currentMedia?.epgChannelId]);

  const cycleAudio = () => {
    if (audioTracks.length === 0) return;
    const idx = audioTracks.findIndex((a) => a.id === activeAudioTrackId);
    const next = audioTracks[(idx + 1) % audioTracks.length];
    if (next) setAudioTrack(next.id);
  };

  const cycleSubtitle = () => {
    if (subtitleTracks.length === 0) return;
    if (!activeSubtitleTrackId) {
      const first = subtitleTracks[0];
      if (first) setSubtitleTrack(first.id);
      return;
    }
    const idx = subtitleTracks.findIndex((s) => s.id === activeSubtitleTrackId);
    const next = subtitleTracks[idx + 1];
    setSubtitleTrack(next ? next.id : null);
  };

  const cycleQuality = () => {
    if (qualityLevels.length === 0) return;
    if (activeQualityLevelId === 'auto') {
      const first = qualityLevels[0];
      if (first) setQualityLevel(first.id);
      return;
    }
    const idx = qualityLevels.findIndex((q) => q.id === activeQualityLevelId);
    const next = qualityLevels[idx + 1];
    setQualityLevel(next ? next.id : 'auto');
  };

  const progressPct =
    durationSec > 0 ? Math.min(100, Math.max(0, (positionSec / durationSec) * 100)) : 0;

  return (
    <div className="ntv-player-hud">
      {channelNumberBuffer ? (
        <div className="ntv-player-osd-number">{channelNumberBuffer}</div>
      ) : null}

      {status === 'buffering' || status === 'loading' ? (
        <div className="ntv-player-status-pill">{t('player.buffering')}</div>
      ) : null}

      {error ? (
        <div className="ntv-player-error-box" role="alert">
          <h3>{error.message}</h3>
          <div className="ntv-player-error-actions">
            <Button focusKey="player-retry" autoFocus onPress={() => void retryNow()}>
              {t('player.retry')}
            </Button>
            <Button
              variant="secondary"
              focusKey="player-switch-engine"
              onPress={() => void switchEngine()}
            >
              {t('player.switchEngine')} ({engineType})
            </Button>
          </div>
        </div>
      ) : null}

      {autoplayCountdownSec !== null ? (
        <div className="ntv-player-next-ep">
          <span>{t('player.nextEpisodeIn', { seconds: autoplayCountdownSec })}</span>
          <div className="ntv-player-next-ep__actions">
            <Button focusKey="player-next-now" autoFocus onPress={() => void playNextEpisode()}>
              {t('player.playNow')}
            </Button>
            <Button variant="secondary" focusKey="player-next-cancel" onPress={cancelAutoplay}>
              {t('player.cancel')}
            </Button>
          </div>
        </div>
      ) : null}

      {isControlsVisible && currentMedia ? (
        <div className="ntv-player-bar">
          <div className="ntv-player-bar__meta">
            <div className="ntv-player-bar__title-row">
              {currentMedia.channelNumber !== undefined ? (
                <span className="ntv-player-bar__chno">{currentMedia.channelNumber}</span>
              ) : null}
              <h2 className="ntv-player-bar__title">{currentMedia.title}</h2>
              {currentMedia.isLive ? (
                <span className="ntv-player-badge-live">{t('player.live')}</span>
              ) : null}
              <span className="ntv-player-badge-engine">{engineType.toUpperCase()}</span>
            </div>

            {epg.current || epg.next ? (
              <div className="ntv-player-bar__epg">
                {epg.current ? (
                  <span>
                    <strong>{t('player.now')}:</strong> {epg.current.title}
                  </span>
                ) : null}
                {epg.next ? (
                  <span>
                    <strong>{t('player.next')}:</strong> {epg.next.title}
                  </span>
                ) : null}
              </div>
            ) : null}
          </div>

          {!currentMedia.isLive ? (
            <div className="ntv-player-progress">
              <span>{formatTimeSec(positionSec)}</span>
              <div className="ntv-player-progress__track">
                <div className="ntv-player-progress__fill" style={{ width: `${progressPct}%` }} />
              </div>
              <span>{formatTimeSec(durationSec)}</span>
            </div>
          ) : null}

          <div className="ntv-player-bar__controls">
            <Button focusKey="player-play-pause" autoFocus onPress={togglePlayPause}>
              {status === 'playing' ? t('player.pause') : t('player.play')}
            </Button>
            {!currentMedia.isLive ? (
              <>
                <Button variant="secondary" focusKey="player-rw" onPress={() => jumpBackward(10)}>
                  -10s
                </Button>
                <Button variant="secondary" focusKey="player-ff" onPress={() => jumpForward(10)}>
                  +10s
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="secondary"
                  focusKey="player-prev-ch"
                  onPress={() => void switchToPreviousChannel()}
                >
                  {t('player.previousChannel')}
                </Button>
                <Button
                  variant="secondary"
                  focusKey="player-mini-epg"
                  onPress={() => setMiniEpgVisible(true)}
                >
                  {t('player.miniGuide')}
                </Button>
              </>
            )}

            {audioTracks.length > 0 ? (
              <Button variant="ghost" focusKey="player-audio" onPress={cycleAudio}>
                {t('player.audio')}:{' '}
                {audioTracks.find((a) => a.id === activeAudioTrackId)?.label ?? '1'}
              </Button>
            ) : null}

            {subtitleTracks.length > 0 ? (
              <Button variant="ghost" focusKey="player-subs" onPress={cycleSubtitle}>
                {t('player.subtitles')}:{' '}
                {subtitleTracks.find((s) => s.id === activeSubtitleTrackId)?.label ??
                  t('player.subtitlesOff')}
              </Button>
            ) : null}

            {qualityLevels.length > 0 ? (
              <Button variant="ghost" focusKey="player-quality" onPress={cycleQuality}>
                {t('player.quality')}:{' '}
                {qualityLevels.find((q) => q.id === activeQualityLevelId)?.label ??
                  t('player.qualityAuto')}
              </Button>
            ) : null}

            <Button variant="ghost" focusKey="player-aspect" onPress={cycleAspectRatio}>
              {t('player.aspectRatio')}: {aspectRatio}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
