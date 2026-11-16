import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useCatalogStore } from '../../domain/stores/catalogStore';
import { usePlayerStore } from '../../domain/stores/playerStore';
import { useSourceStore } from '../../domain/stores/sourceStore';
import { Carousel } from '../components/Carousel';
import { EmptyState } from '../components/EmptyState';
import { MediaCard } from '../components/MediaCard';
import { VirtualKeyboard } from '../components/VirtualKeyboard';

export interface SearchScreenProps {
  onOpenPlayer: () => void;
}

export function SearchScreen({ onOpenPlayer }: SearchScreenProps) {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const activeSourceId = useSourceStore((s) => s.activeSourceId);
  const searchResults = useCatalogStore((s) => s.searchResults);
  const isSearching = useCatalogStore((s) => s.isSearching);
  const search = useCatalogStore((s) => s.search);
  const loadMedia = usePlayerStore((s) => s.loadMedia);

  const handleQueryChange = (next: string) => {
    setQuery(next);
    void search(next, activeSourceId ?? undefined);
  };

  const hasResults =
    searchResults.channels.length > 0 ||
    searchResults.vodItems.length > 0 ||
    searchResults.series.length > 0;

  return (
    <section className="ntv-screen">
      <h1 className="ntv-screen-title">{t('nav.search')}</h1>

      <VirtualKeyboard
        value={query}
        onChange={handleQueryChange}
        onSubmit={(val) => void search(val, activeSourceId ?? undefined)}
        placeholder={t('search.placeholder')}
        focusKey="GLOBAL_SEARCH_KB"
      />

      {isSearching ? <p className="ntv-screen-subtitle">{t('common.loading')}</p> : null}

      {!isSearching && query.trim() && !hasResults ? (
        <EmptyState title={t('search.noResults')} description={t('search.noResultsHint')} />
      ) : null}

      {searchResults.channels.length > 0 ? (
        <Carousel title={t('nav.live')} focusKey="SEARCH_RES_LIVE">
          {searchResults.channels.map((ch) => (
            <MediaCard
              key={ch.id}
              title={ch.name}
              imageUrl={ch.logoUrl}
              badge={t('player.live')}
              focusKey={`SEARCH_CH_${ch.id}`}
              onPress={() => {
                void loadMedia({
                  id: ch.id,
                  title: ch.name,
                  url: ch.streamUrl,
                  kind: 'live',
                  isLive: true,
                  channelNumber: ch.number,
                  epgChannelId: ch.epgChannelId,
                  logoUrl: ch.logoUrl,
                });
                onOpenPlayer();
              }}
            />
          ))}
        </Carousel>
      ) : null}

      {searchResults.vodItems.length > 0 ? (
        <Carousel title={t('nav.movies')} focusKey="SEARCH_RES_VOD">
          {searchResults.vodItems.map((vod) => (
            <MediaCard
              key={vod.id}
              title={vod.title}
              imageUrl={vod.posterUrl}
              focusKey={`SEARCH_VOD_${vod.id}`}
              onPress={() => {
                void loadMedia({
                  id: vod.id,
                  title: vod.title,
                  url: vod.streamUrl,
                  kind: 'vod',
                  isLive: false,
                  logoUrl: vod.posterUrl,
                });
                onOpenPlayer();
              }}
            />
          ))}
        </Carousel>
      ) : null}

      {searchResults.series.length > 0 ? (
        <Carousel title={t('nav.series')} focusKey="SEARCH_RES_SERIES">
          {searchResults.series.map((ser) => (
            <MediaCard
              key={ser.id}
              title={ser.title}
              imageUrl={ser.posterUrl}
              focusKey={`SEARCH_SER_${ser.id}`}
            />
          ))}
        </Carousel>
      ) : null}
    </section>
  );
}
