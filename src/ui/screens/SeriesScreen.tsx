import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useCatalogStore } from '../../domain/stores/catalogStore';
import { usePlayerStore } from '../../domain/stores/playerStore';
import { useProfileStore } from '../../domain/stores/profileStore';
import { useSourceStore } from '../../domain/stores/sourceStore';
import type { Episode, Series } from '../../domain/types';
import { Button } from '../components/Button';
import { EmptyState } from '../components/EmptyState';
import { MediaCard } from '../components/MediaCard';
import { MediaGrid } from '../components/MediaGrid';

const PAGE_SIZE = 60;

export interface SeriesScreenProps {
  onOpenPlayer: () => void;
}

export function SeriesScreen({ onOpenPlayer }: SeriesScreenProps) {
  const { t } = useTranslation();
  const categories = useCatalogStore((s) => s.categories);
  const seriesList = useCatalogStore((s) => s.series);
  const loadSeriesDetails = useCatalogStore((s) => s.loadSeriesDetails);
  const sources = useSourceStore((s) => s.sources);
  const activeSourceId = useSourceStore((s) => s.activeSourceId);
  const history = useProfileStore((s) => s.history);
  const loadMedia = usePlayerStore((s) => s.loadMedia);
  const setNextEpisodeMedia = usePlayerStore((s) => s.setNextEpisodeMedia);

  const seriesCategories = useMemo(
    () => categories.filter((c) => c.kind === 'series'),
    [categories],
  );

  const [selectedCatId, setSelectedCatId] = useState<string>('all');
  const [selectedSeries, setSelectedSeries] = useState<Series | null>(null);
  const [selectedSeasonIdx, setSelectedSeasonIdx] = useState(0);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [visibleLimit, setVisibleLimit] = useState(PAGE_SIZE);

  const filteredSeries = useMemo(() => {
    if (selectedCatId === 'all') return seriesList;
    return seriesList.filter((s) => s.categoryId === selectedCatId);
  }, [seriesList, selectedCatId]);

  const openSeries = async (item: Series) => {
    setSelectedSeries(item);
    setSelectedSeasonIdx(0);
    const activeSource = sources.find((s) => s.id === (item.sourceId || activeSourceId));
    if (activeSource && item.seasons.length === 0) {
      setLoadingDetails(true);
      try {
        const detailed = await loadSeriesDetails(activeSource, item.id);
        if (detailed) setSelectedSeries(detailed);
      } finally {
        setLoadingDetails(false);
      }
    }
  };

  const playEpisode = (ep: Episode, allSeasonEpisodes: Episode[], idx: number) => {
    const nextEp = allSeasonEpisodes[idx + 1];
    setNextEpisodeMedia(
      nextEp
        ? {
            id: nextEp.id,
            title: `${selectedSeries?.title ?? ''} - ${nextEp.title}`,
            url: nextEp.streamUrl,
            kind: 'series',
            isLive: false,
            durationSec: nextEp.durationSec,
          }
        : null,
    );

    const hist = history.find((h) => h.kind === 'series' && h.itemId === ep.id);
    void loadMedia({
      id: ep.id,
      title: `${selectedSeries?.title ?? ''} - ${ep.title}`,
      url: ep.streamUrl,
      kind: 'series',
      isLive: false,
      startPositionSec: hist && !hist.watched ? hist.positionSec : 0,
      durationSec: ep.durationSec,
    });
    onOpenPlayer();
  };

  if (seriesList.length === 0) {
    return (
      <section className="ntv-screen">
        <h1 className="ntv-screen-title">{t('nav.series')}</h1>
        <EmptyState title={t('common.emptyTitle')} description={t('showcase.emptyDescription')} />
      </section>
    );
  }

  if (selectedSeries) {
    const currentSeason = selectedSeries.seasons[selectedSeasonIdx];
    const episodes = currentSeason?.episodes ?? [];

    return (
      <section className="ntv-screen">
        <div className="ntv-screen-header">
          <h1 className="ntv-screen-title">{selectedSeries.title}</h1>
          <Button
            variant="secondary"
            focusKey="SERIES_DETAIL_BACK"
            onPress={() => setSelectedSeries(null)}
          >
            {t('common.back')}
          </Button>
        </div>

        <div className="ntv-card-panel">
          <p className="ntv-screen-subtitle">
            {selectedSeries.synopsis ?? t('details.noSynopsis')}
          </p>

          {loadingDetails ? (
            <p className="ntv-screen-subtitle">{t('common.loading')}</p>
          ) : (
            <>
              <div className="ntv-row-actions">
                {selectedSeries.seasons.map((season, idx) => (
                  <Button
                    key={season.seasonNumber}
                    variant={idx === selectedSeasonIdx ? 'primary' : 'secondary'}
                    focusKey={`SERIES_SEASON_${season.seasonNumber}`}
                    autoFocus={idx === 0}
                    onPress={() => setSelectedSeasonIdx(idx)}
                  >
                    {season.name}
                  </Button>
                ))}
              </div>

              <div className="ntv-diag-list">
                {episodes.map((ep, idx) => {
                  const watched = history.some(
                    (h) => h.kind === 'series' && h.itemId === ep.id && h.watched,
                  );
                  return (
                    <Button
                      key={ep.id}
                      variant="secondary"
                      focusKey={`SERIES_EP_${ep.id}`}
                      onPress={() => playEpisode(ep, episodes, idx)}
                    >
                      {ep.episodeNumber}. {ep.title} {watched ? '✓' : ''}
                    </Button>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </section>
    );
  }

  return (
    <section className="ntv-screen">
      <h1 className="ntv-screen-title">{t('nav.series')}</h1>

      <div className="ntv-split-layout">
        <div className="ntv-cat-list">
          <Button
            variant={selectedCatId === 'all' ? 'primary' : 'secondary'}
            focusKey="SER_CAT_ALL"
            onPress={() => {
              setSelectedCatId('all');
              setVisibleLimit(PAGE_SIZE);
            }}
          >
            {t('common.all')} ({seriesList.length})
          </Button>
          {seriesCategories.map((cat) => (
            <Button
              key={cat.id}
              variant={selectedCatId === cat.id ? 'primary' : 'secondary'}
              focusKey={`SER_CAT_${cat.id}`}
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
          <MediaGrid focusKey="SERIES_GRID">
            {filteredSeries.slice(0, visibleLimit).map((ser) => (
              <MediaCard
                key={ser.id}
                title={ser.title}
                subtitle={ser.year ? String(ser.year) : undefined}
                imageUrl={ser.posterUrl}
                focusKey={`SER_${ser.id}`}
                onPress={() => void openSeries(ser)}
              />
            ))}
          </MediaGrid>
        </div>
      </div>
    </section>
  );
}
