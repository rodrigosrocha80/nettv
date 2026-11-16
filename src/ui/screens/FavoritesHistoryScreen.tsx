import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useCatalogStore } from '../../domain/stores/catalogStore';
import { usePlayerStore } from '../../domain/stores/playerStore';
import { useProfileStore } from '../../domain/stores/profileStore';
import { Carousel } from '../components/Carousel';
import { EmptyState } from '../components/EmptyState';
import { MediaCard } from '../components/MediaCard';

export interface FavoritesHistoryScreenProps {
  onOpenPlayer: () => void;
}

export function FavoritesHistoryScreen({ onOpenPlayer }: FavoritesHistoryScreenProps) {
  const { t } = useTranslation();
  const favorites = useProfileStore((s) => s.favorites);
  const history = useProfileStore((s) => s.history);
  const channels = useCatalogStore((s) => s.channels);
  const vodItems = useCatalogStore((s) => s.vodItems);
  const loadMedia = usePlayerStore((s) => s.loadMedia);

  const channelMap = useMemo(() => new Map(channels.map((c) => [c.id, c])), [channels]);
  const vodMap = useMemo(() => new Map(vodItems.map((v) => [v.id, v])), [vodItems]);

  const favItems = useMemo(() => {
    return favorites
      .map((f) => {
        if (f.kind === 'live') {
          const c = channelMap.get(f.itemId);
          return c
            ? {
                id: c.id,
                title: c.name,
                url: c.streamUrl,
                kind: 'live' as const,
                isLive: true,
                imageUrl: c.logoUrl,
              }
            : null;
        }
        const v = vodMap.get(f.itemId);
        return v
          ? {
              id: v.id,
              title: v.title,
              url: v.streamUrl,
              kind: 'vod' as const,
              isLive: false,
              imageUrl: v.posterUrl,
            }
          : null;
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);
  }, [favorites, channelMap, vodMap]);

  const histItems = useMemo(() => {
    return history
      .map((h) => {
        const v = vodMap.get(h.itemId);
        if (!v) return null;
        const pct = h.durationSec > 0 ? Math.round((h.positionSec / h.durationSec) * 100) : 0;
        return {
          id: v.id,
          title: v.title,
          url: v.streamUrl,
          positionSec: h.positionSec,
          imageUrl: v.posterUrl,
          progress: pct,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);
  }, [history, vodMap]);

  return (
    <section className="ntv-screen">
      <h1 className="ntv-screen-title">{t('nav.favorites')}</h1>

      {favItems.length === 0 && histItems.length === 0 ? (
        <EmptyState title={t('common.emptyTitle')} description={t('favorites.emptyHint')} />
      ) : null}

      {favItems.length > 0 ? (
        <Carousel title={t('home.favorites')} focusKey="FAV_PAGE_LIST">
          {favItems.map((item) => (
            <MediaCard
              key={item.id}
              title={item.title}
              imageUrl={item.imageUrl}
              badge={item.isLive ? t('player.live') : undefined}
              focusKey={`FAV_ITEM_${item.id}`}
              onPress={() => {
                void loadMedia({
                  id: item.id,
                  title: item.title,
                  url: item.url,
                  kind: item.kind,
                  isLive: item.isLive,
                  logoUrl: item.imageUrl,
                });
                onOpenPlayer();
              }}
            />
          ))}
        </Carousel>
      ) : null}

      {histItems.length > 0 ? (
        <Carousel title={t('favorites.historyTitle')} focusKey="HIST_PAGE_LIST">
          {histItems.map((item) => (
            <MediaCard
              key={item.id}
              title={item.title}
              imageUrl={item.imageUrl}
              progressPercent={item.progress}
              focusKey={`HIST_ITEM_${item.id}`}
              onPress={() => {
                void loadMedia({
                  id: item.id,
                  title: item.title,
                  url: item.url,
                  kind: 'vod',
                  isLive: false,
                  startPositionSec: item.positionSec,
                  logoUrl: item.imageUrl,
                });
                onOpenPlayer();
              }}
            />
          ))}
        </Carousel>
      ) : null}
    </section>
  );
}
