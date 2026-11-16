import { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { setMainEntryFocusKey } from '../focus/mainFocus';
import { useCatalogStore } from '../../domain/stores/catalogStore';
import { usePlayerStore } from '../../domain/stores/playerStore';
import { useProfileStore } from '../../domain/stores/profileStore';
import { useSourceStore } from '../../domain/stores/sourceStore';
import type { MediaSourceInput } from '../../player/types';
import { Carousel } from '../components/Carousel';
import { EmptyState } from '../components/EmptyState';
import { ErrorState } from '../components/ErrorState';
import { MediaCard } from '../components/MediaCard';
import { Skeleton } from '../components/Skeleton';

export interface HomeScreenProps {
  onOpenPlayer: () => void;
  onGoToOnboarding: () => void;
}

export function HomeScreen({ onOpenPlayer, onGoToOnboarding }: HomeScreenProps) {
  const { t } = useTranslation();
  const channels = useCatalogStore((s) => s.channels);
  const vodItems = useCatalogStore((s) => s.vodItems);
  const isLoading = useCatalogStore((s) => s.isLoading);
  const loadCatalogForSource = useCatalogStore((s) => s.loadCatalogForSource);

  const favorites = useProfileStore((s) => s.favorites);
  const history = useProfileStore((s) => s.history);
  const activeSourceId = useSourceStore((s) => s.activeSourceId);
  const lastError = useSourceStore((s) => s.lastError);
  const refreshSource = useSourceStore((s) => s.refreshSource);
  const loadMedia = usePlayerStore((s) => s.loadMedia);

  const channelMap = useMemo(() => new Map(channels.map((c) => [c.id, c])), [channels]);
  const vodMap = useMemo(() => new Map(vodItems.map((v) => [v.id, v])), [vodItems]);

  const continueWatching = useMemo(() => {
    const items: Array<{ media: MediaSourceInput; progress: number }> = [];
    for (let i = 0; i < history.length && items.length < 15; i++) {
      const h = history[i];
      if (!h || h.watched) continue;
      if (h.kind === 'vod') {
        const vod = vodMap.get(h.itemId);
        if (vod) {
          const pct = h.durationSec > 0 ? Math.round((h.positionSec / h.durationSec) * 100) : 0;
          items.push({
            media: {
              id: vod.id,
              title: vod.title,
              url: vod.streamUrl,
              kind: 'vod',
              isLive: false,
              startPositionSec: h.positionSec,
              durationSec: h.durationSec,
              logoUrl: vod.posterUrl,
            },
            progress: pct,
          });
        }
      }
    }
    return items;
  }, [history, vodMap]);

  const favoriteCards = useMemo(() => {
    const list: MediaSourceInput[] = [];
    for (let i = 0; i < favorites.length && list.length < 20; i++) {
      const fav = favorites[i];
      if (!fav) continue;
      if (fav.kind === 'live') {
        const ch = channelMap.get(fav.itemId);
        if (ch) {
          list.push({
            id: ch.id,
            title: ch.name,
            url: ch.streamUrl,
            kind: 'live',
            isLive: true,
            channelNumber: ch.number,
            epgChannelId: ch.epgChannelId,
            logoUrl: ch.logoUrl,
          });
        }
      } else if (fav.kind === 'vod') {
        const vod = vodMap.get(fav.itemId);
        if (vod) {
          list.push({
            id: vod.id,
            title: vod.title,
            url: vod.streamUrl,
            kind: 'vod',
            isLive: false,
            logoUrl: vod.posterUrl,
          });
        }
      }
    }
    return list;
  }, [favorites, channelMap, vodMap]);

  const recentVod = useMemo(() => vodItems.slice(0, 20), [vodItems]);
  const recentChannels = useMemo(() => channels.slice(0, 20), [channels]);

  useEffect(() => {
    const firstKey =
      continueWatching[0] !== undefined
        ? `HOME_CW_${continueWatching[0].media.id}`
        : favoriteCards[0] !== undefined
          ? `HOME_FAV_${favoriteCards[0].id}`
          : recentChannels[0] !== undefined
            ? `HOME_CH_${recentChannels[0].id}`
            : recentVod[0] !== undefined
              ? `HOME_VOD_${recentVod[0].id}`
              : null;
    setMainEntryFocusKey(firstKey);
    return () => setMainEntryFocusKey(null);
  }, [continueWatching, favoriteCards, recentChannels, recentVod]);

  const playItem = (media: MediaSourceInput) => {
    void loadMedia(media);
    onOpenPlayer();
  };

  if (isLoading) {
    return (
      <section className="ntv-screen">
        <h1 className="ntv-screen-title">{t('nav.home')}</h1>
        <div className="ntv-row-actions">
          <Skeleton width="260px" height="170px" />
          <Skeleton width="260px" height="170px" />
          <Skeleton width="260px" height="170px" />
        </div>
      </section>
    );
  }

  if (lastError && channels.length === 0 && vodItems.length === 0) {
    return (
      <section className="ntv-screen">
        <ErrorState
          description={t(`data.errors.${lastError.code}`)}
          retryFocusKey="HOME_RETRY"
          onRetry={() => {
            if (activeSourceId) {
              void refreshSource(activeSourceId, { forceRefresh: true }).then(() =>
                loadCatalogForSource(activeSourceId),
              );
            } else {
              onGoToOnboarding();
            }
          }}
        />
      </section>
    );
  }

  if (channels.length === 0 && vodItems.length === 0) {
    return (
      <section className="ntv-screen">
        <EmptyState title={t('common.emptyTitle')} description={t('showcase.emptyDescription')} />
      </section>
    );
  }

  return (
    <section className="ntv-screen">
      <h1 className="ntv-screen-title">{t('nav.home')}</h1>

      {continueWatching.length > 0 ? (
        <Carousel title={t('home.continueWatching')} focusKey="HOME_CONTINUE">
          {continueWatching.map((entry) => (
            <MediaCard
              key={entry.media.id}
              title={entry.media.title}
              imageUrl={entry.media.logoUrl}
              progressPercent={entry.progress}
              focusKey={`HOME_CW_${entry.media.id}`}
              onPress={() => playItem(entry.media)}
            />
          ))}
        </Carousel>
      ) : null}

      {favoriteCards.length > 0 ? (
        <Carousel title={t('home.favorites')} focusKey="HOME_FAVORITES">
          {favoriteCards.map((item) => (
            <MediaCard
              key={item.id}
              title={item.title}
              imageUrl={item.logoUrl}
              badge={item.isLive ? t('player.live') : undefined}
              focusKey={`HOME_FAV_${item.id}`}
              onPress={() => playItem(item)}
            />
          ))}
        </Carousel>
      ) : null}

      {recentChannels.length > 0 ? (
        <Carousel title={t('home.liveChannels')} focusKey="HOME_LIVE">
          {recentChannels.map((ch) => (
            <MediaCard
              key={ch.id}
              title={ch.name}
              imageUrl={ch.logoUrl}
              badge={ch.number ? `#${ch.number}` : t('player.live')}
              focusKey={`HOME_CH_${ch.id}`}
              onPress={() =>
                playItem({
                  id: ch.id,
                  title: ch.name,
                  url: ch.streamUrl,
                  kind: 'live',
                  isLive: true,
                  channelNumber: ch.number,
                  epgChannelId: ch.epgChannelId,
                  logoUrl: ch.logoUrl,
                })
              }
            />
          ))}
        </Carousel>
      ) : null}

      {recentVod.length > 0 ? (
        <Carousel title={t('home.recentlyAdded')} focusKey="HOME_VOD">
          {recentVod.map((vod) => (
            <MediaCard
              key={vod.id}
              title={vod.title}
              imageUrl={vod.posterUrl}
              subtitle={vod.year ? String(vod.year) : undefined}
              focusKey={`HOME_VOD_${vod.id}`}
              onPress={() =>
                playItem({
                  id: vod.id,
                  title: vod.title,
                  url: vod.streamUrl,
                  kind: 'vod',
                  isLive: false,
                  logoUrl: vod.posterUrl,
                })
              }
            />
          ))}
        </Carousel>
      ) : null}
    </section>
  );
}
