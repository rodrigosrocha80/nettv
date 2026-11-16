import { create } from 'zustand';
import {
  getCategoriesBySource,
  getChannelsBySource,
  getSeriesBySource,
  getVodBySource,
  searchCatalog,
  updateSeriesDetails,
  type CatalogSearchResults,
} from '../../data/db/catalogRepository';
import { fetchXtreamSeriesSeasons } from '../../data/xtream/xtreamClient';
import type { Category, Channel, Series, Source, VodItem } from '../../domain/types';

export interface CatalogState {
  loadedSourceId: string | null;
  categories: Category[];
  channels: Channel[];
  vodItems: VodItem[];
  series: Series[];
  searchResults: CatalogSearchResults;
  isLoading: boolean;
  isSearching: boolean;

  loadCatalogForSource: (sourceId: string) => Promise<void>;
  search: (query: string, sourceId?: string) => Promise<CatalogSearchResults>;
  loadSeriesDetails: (source: Source, seriesId: string) => Promise<Series | null>;
  clearCatalog: () => void;
}

const EMPTY_SEARCH: CatalogSearchResults = {
  channels: [],
  vodItems: [],
  series: [],
};

export const useCatalogStore = create<CatalogState>((set, get) => ({
  loadedSourceId: null,
  categories: [],
  channels: [],
  vodItems: [],
  series: [],
  searchResults: EMPTY_SEARCH,
  isLoading: false,
  isSearching: false,

  loadCatalogForSource: async (sourceId: string) => {
    set({ isLoading: true });
    try {
      const [categories, channels, vodItems, series] = await Promise.all([
        getCategoriesBySource(sourceId),
        getChannelsBySource(sourceId),
        getVodBySource(sourceId),
        getSeriesBySource(sourceId),
      ]);
      set({
        loadedSourceId: sourceId,
        categories,
        channels,
        vodItems,
        series,
        isLoading: false,
      });
    } catch (err) {
      set({ isLoading: false });
      throw err;
    }
  },

  search: async (query: string, sourceId?: string) => {
    const trimmed = query.trim();
    if (!trimmed) {
      set({ searchResults: EMPTY_SEARCH, isSearching: false });
      return EMPTY_SEARCH;
    }
    set({ isSearching: true });
    try {
      const results = await searchCatalog(trimmed, { sourceId, limitPerKind: 50 });
      set({ searchResults: results, isSearching: false });
      return results;
    } catch (err) {
      set({ isSearching: false });
      throw err;
    }
  },

  loadSeriesDetails: async (source: Source, seriesId: string) => {
    const existing = get().series.find((s) => s.id === seriesId);
    if (!existing) return null;
    if (existing.seasons.length > 0 || source.type !== 'xtream') {
      return existing;
    }

    const details = await fetchXtreamSeriesSeasons(source, seriesId);
    const updated: Series = {
      ...existing,
      seasons: details.seasons,
      synopsis: details.synopsis ?? existing.synopsis,
      backdropUrl: details.backdropUrl ?? existing.backdropUrl,
      year: details.year ?? existing.year,
      rating: details.rating ?? existing.rating,
    };

    await updateSeriesDetails(updated);
    set({
      series: get().series.map((s) => (s.id === seriesId ? updated : s)),
    });
    return updated;
  },

  clearCatalog: () => {
    set({
      loadedSourceId: null,
      categories: [],
      channels: [],
      vodItems: [],
      series: [],
      searchResults: EMPTY_SEARCH,
      isLoading: false,
      isSearching: false,
    });
  },
}));
