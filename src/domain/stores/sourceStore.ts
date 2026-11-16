import { create } from 'zustand';
import { clearSourceCatalog } from '../../data/db/catalogRepository';
import { clearSourceEpg } from '../../data/db/epgRepository';
import { deleteSource, getAllSources, saveSource } from '../../data/db/userRepository';
import { syncEpgForSource, syncSource } from '../../data/sync/syncService';
import { validateSourceUrl } from '../security';
import {
  DataLayerError,
  type Source,
  type SourceType,
  type SyncMetrics,
  type SyncStatus,
} from '../types';

const ACTIVE_SOURCE_KEY = 'nettv:activeSourceId';
const DEFAULT_CACHE_TTL_MINUTES = 720; // 12h
const DEFAULT_EPG_WINDOW_DAYS = 2; // hoje + 2 dias

function generateSourceId(): string {
  return `src-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function readStoredActiveSourceId(): string | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage.getItem(ACTIVE_SOURCE_KEY) : null;
  } catch {
    return null;
  }
}

function writeStoredActiveSourceId(id: string | null): void {
  try {
    if (typeof localStorage === 'undefined') return;
    if (id) {
      localStorage.setItem(ACTIVE_SOURCE_KEY, id);
    } else {
      localStorage.removeItem(ACTIVE_SOURCE_KEY);
    }
  } catch {
    // Ignora falha de localStorage
  }
}

export interface AddSourceInput {
  name: string;
  type: SourceType;
  url: string;
  username?: string;
  password?: string;
  epgUrl?: string;
  cacheTtlMinutes?: number;
  epgWindowDays?: number;
}

export interface SourceState {
  sources: Source[];
  activeSourceId: string | null;
  syncStatus: SyncStatus;
  lastError: DataLayerError | null;
  lastMetrics: SyncMetrics | null;
  loaded: boolean;

  loadSources: () => Promise<void>;
  addSource: (input: AddSourceInput) => Promise<Source>;
  updateSource: (source: Source) => Promise<void>;
  removeSource: (sourceId: string) => Promise<void>;
  selectSource: (sourceId: string) => void;
  refreshSource: (
    sourceId: string,
    options?: { forceRefresh?: boolean; syncEpg?: boolean },
  ) => Promise<SyncMetrics | null>;
  clearError: () => void;
  resetStore: () => void;
}

export const useSourceStore = create<SourceState>((set, get) => ({
  sources: [],
  activeSourceId: null,
  syncStatus: 'idle',
  lastError: null,
  lastMetrics: null,
  loaded: false,

  loadSources: async () => {
    const sources = await getAllSources();
    const storedId = readStoredActiveSourceId();
    const activeSourceId = sources.find((s) => s.id === storedId)?.id ?? sources[0]?.id ?? null;
    if (activeSourceId) {
      writeStoredActiveSourceId(activeSourceId);
    }
    set({ sources, activeSourceId, loaded: true });
  },

  addSource: async (input) => {
    const validation = validateSourceUrl(input.url);
    if (!validation.valid) {
      throw new DataLayerError('INVALID_URL', 'URL da fonte inválida. Use http:// ou https://.');
    }

    const source: Source = {
      id: generateSourceId(),
      name: input.name.trim() || 'Minha Lista',
      type: input.type,
      url: validation.normalizedUrl,
      username: input.username?.trim() || undefined,
      password: input.password || undefined,
      epgUrl: input.epgUrl?.trim() || undefined,
      cacheTtlMinutes: input.cacheTtlMinutes ?? DEFAULT_CACHE_TTL_MINUTES,
      epgWindowDays: input.epgWindowDays ?? DEFAULT_EPG_WINDOW_DAYS,
      createdAt: Date.now(),
    };

    await saveSource(source);
    const sources = [...get().sources, source];
    const shouldSelect = get().activeSourceId === null;
    if (shouldSelect) {
      writeStoredActiveSourceId(source.id);
    }
    set({
      sources,
      activeSourceId: shouldSelect ? source.id : get().activeSourceId,
    });
    return source;
  },

  updateSource: async (source) => {
    await saveSource(source);
    set({
      sources: get().sources.map((s) => (s.id === source.id ? source : s)),
    });
  },

  removeSource: async (sourceId) => {
    await Promise.all([
      deleteSource(sourceId),
      clearSourceCatalog(sourceId),
      clearSourceEpg(sourceId),
    ]);
    const remaining = get().sources.filter((s) => s.id !== sourceId);
    const wasActive = get().activeSourceId === sourceId;
    const nextActive = wasActive ? (remaining[0]?.id ?? null) : get().activeSourceId;
    if (wasActive) {
      writeStoredActiveSourceId(nextActive);
    }
    set({ sources: remaining, activeSourceId: nextActive });
  },

  selectSource: (sourceId) => {
    writeStoredActiveSourceId(sourceId);
    set({ activeSourceId: sourceId });
  },

  refreshSource: async (sourceId, options) => {
    const target = get().sources.find((s) => s.id === sourceId);
    if (!target) return null;

    set({ syncStatus: 'syncing', lastError: null });

    try {
      const { updatedSource, metrics } = await syncSource(target, {
        forceRefresh: options?.forceRefresh,
        onBackgroundStart: () => {
          set({ syncStatus: 'revalidating' });
        },
        onBackgroundComplete: (bgMetrics) => {
          set({ syncStatus: 'idle', lastMetrics: bgMetrics });
          void getAllSources().then((fresh) => set({ sources: fresh }));
        },
        onBackgroundError: (err) => {
          const dataErr =
            err instanceof DataLayerError
              ? err
              : new DataLayerError('NETWORK_ERROR', 'Falha na atualização em segundo plano.');
          set({ syncStatus: 'error', lastError: dataErr });
        },
      });

      let finalSource = updatedSource;
      let epgProgramsCount = 0;

      if (options?.syncEpg) {
        const epgRes = await syncEpgForSource(updatedSource);
        finalSource = epgRes.updatedSource;
        epgProgramsCount = epgRes.programsCount;
      }

      const finalMetrics: SyncMetrics = {
        ...metrics,
        epgProgramsCount,
      };

      set({
        sources: get().sources.map((s) => (s.id === finalSource.id ? finalSource : s)),
        syncStatus: metrics.revalidatedInBackground ? 'revalidating' : 'idle',
        lastMetrics: finalMetrics,
      });

      return finalMetrics;
    } catch (err) {
      const dataErr =
        err instanceof DataLayerError
          ? err
          : new DataLayerError(
              'NETWORK_ERROR',
              err instanceof Error ? err.message : 'Erro desconhecido ao sincronizar fonte.',
            );
      set({ syncStatus: 'error', lastError: dataErr });
      throw dataErr;
    }
  },

  clearError: () => set({ lastError: null }),

  resetStore: () => {
    set({
      sources: [],
      activeSourceId: null,
      syncStatus: 'idle',
      lastError: null,
      lastMetrics: null,
      loaded: false,
    });
  },
}));
