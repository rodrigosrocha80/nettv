import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useCatalogStore } from '../../domain/stores/catalogStore';
import { usePlayerStore } from '../../domain/stores/playerStore';
import { useProfileStore } from '../../domain/stores/profileStore';
import type { VodItem } from '../../domain/types';
import { Button } from '../components/Button';
import { EmptyState } from '../components/EmptyState';
import { MediaCard } from '../components/MediaCard';
import { MediaGrid } from '../components/MediaGrid';

const PAGE_SIZE = 60;

export interface MoviesScreenProps {
  onOpenPlayer: () => void;
}

export function MoviesScreen({ onOpenPlayer }: MoviesScreenProps) {
  const { t } = useTranslation();
  const categories = useCatalogStore((s) => s.categories);
  const vodItems = useCatalogStore((s) => s.vodItems);
  const favorites = useProfileStore((s) => s.favorites);
  const history = useProfileStore((s) => s.history);
  const toggleFavorite = useProfileStore((s) => s.toggleFavorite);
  const loadMedia = usePlayerStore((s) => s.loadMedia);

  const vodCategories = useMemo(() => categories.filter((c) => c.kind === 'vod'), [categories]);

  const [selectedCatId, setSelectedCatId] = useState<string>('all');
  const [selectedMovie, setSelectedMovie] = useState<VodItem | null>(null);
  const [visibleLimit, setVisibleLimit] = useState(PAGE_SIZE);

  const filteredMovies = useMemo(() => {
    if (selectedCatId === 'all') return vodItems;
    return vodItems.filter((v) => v.categoryId === selectedCatId);
  }, [vodItems, selectedCatId]);

  const visibleMovies = useMemo(
    () => filteredMovies.slice(0, visibleLimit),
    [filteredMovies, visibleLimit],
  );

  if (vodItems.length === 0) {
    return (
      <section className="ntv-screen">
        <h1 className="ntv-screen-title">{t('nav.movies')}</h1>
        <EmptyState title={t('common.emptyTitle')} description={t('showcase.emptyDescription')} />
      </section>
    );
  }

  if (selectedMovie) {
    const isFav = favorites.some((f) => f.kind === 'vod' && f.itemId === selectedMovie.id);
    const hist = history.find((h) => h.kind === 'vod' && h.itemId === selectedMovie.id);
    const canResume = Boolean(hist && hist.positionSec > 5 && !hist.watched);

    const playMovie = (resume: boolean) => {
      void loadMedia({
        id: selectedMovie.id,
        title: selectedMovie.title,
        url: selectedMovie.streamUrl,
        kind: 'vod',
        isLive: false,
        startPositionSec: resume && hist ? hist.positionSec : 0,
        durationSec: selectedMovie.durationSec,
        logoUrl: selectedMovie.posterUrl,
      });
      onOpenPlayer();
    };

    return (
      <section className="ntv-screen">
        <div className="ntv-screen-header">
          <h1 className="ntv-screen-title">{selectedMovie.title}</h1>
          <Button
            variant="secondary"
            focusKey="MOVIE_DETAIL_BACK"
            onPress={() => setSelectedMovie(null)}
          >
            {t('common.back')}
          </Button>
        </div>

        <div className="ntv-card-panel ntv-detail-hero">
          {selectedMovie.posterUrl ? (
            <img
              src={selectedMovie.posterUrl}
              alt={selectedMovie.title}
              className="ntv-detail-poster"
            />
          ) : (
            <div className="ntv-detail-poster" />
          )}

          <div className="ntv-screen">
            <div className="ntv-row-actions">
              {selectedMovie.year ? <span>{selectedMovie.year}</span> : null}
              {selectedMovie.rating ? <span>★ {selectedMovie.rating}</span> : null}
            </div>
            <p className="ntv-screen-subtitle">
              {selectedMovie.synopsis ?? t('details.noSynopsis')}
            </p>
            <div className="ntv-row-actions">
              {canResume ? (
                <Button focusKey="MOVIE_RESUME" autoFocus onPress={() => playMovie(true)}>
                  {t('details.resume')}
                </Button>
              ) : null}
              <Button
                variant={canResume ? 'secondary' : 'primary'}
                focusKey="MOVIE_PLAY"
                autoFocus={!canResume}
                onPress={() => playMovie(false)}
              >
                {canResume ? t('details.playFromStart') : t('player.play')}
              </Button>
              <Button
                variant="ghost"
                focusKey="MOVIE_FAV"
                onPress={() => void toggleFavorite(selectedMovie.id, 'vod')}
              >
                {isFav ? t('details.removeFavorite') : t('details.addFavorite')}
              </Button>
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="ntv-screen">
      <h1 className="ntv-screen-title">{t('nav.movies')}</h1>

      <div className="ntv-split-layout">
        <div className="ntv-cat-list">
          <Button
            variant={selectedCatId === 'all' ? 'primary' : 'secondary'}
            focusKey="VOD_CAT_ALL"
            onPress={() => {
              setSelectedCatId('all');
              setVisibleLimit(PAGE_SIZE);
            }}
          >
            {t('common.all')} ({vodItems.length})
          </Button>
          {vodCategories.map((cat) => (
            <Button
              key={cat.id}
              variant={selectedCatId === cat.id ? 'primary' : 'secondary'}
              focusKey={`VOD_CAT_${cat.id}`}
              onPress={() => {
                setSelectedCatId(cat.id);
                setVisibleLimit(PAGE_SIZE);
              }}
            >
              {cat.name}
            </Button>
          ))}
        </div>

        <div>
          <MediaGrid focusKey="VOD_GRID">
            {visibleMovies.map((vod) => (
              <MediaCard
                key={vod.id}
                title={vod.title}
                subtitle={vod.year ? String(vod.year) : undefined}
                imageUrl={vod.posterUrl}
                focusKey={`VOD_${vod.id}`}
                onPress={() => setSelectedMovie(vod)}
              />
            ))}
          </MediaGrid>
          {filteredMovies.length > visibleLimit ? (
            <div style={{ marginTop: '16px' }}>
              <Button
                variant="secondary"
                focusKey="VOD_LOAD_MORE"
                onPress={() => setVisibleLimit((n) => n + PAGE_SIZE)}
              >
                {t('common.loadMore')}
              </Button>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
