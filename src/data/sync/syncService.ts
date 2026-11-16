import { fetchText } from '../http/httpClient';
import { parseM3uInWorker, parseXmltvInWorker } from '../workers/parserWorkerClient';
import { buildXtreamXmltvUrl, fetchXtreamCatalog } from '../xtream/xtreamClient';
import {
  getCategoriesBySource,
  getChannelsBySource,
  getSeriesBySource,
  getVodBySource,
  replaceSourceCatalog,
} from '../db/catalogRepository';
import { replaceSourceEpg } from '../db/epgRepository';
import { saveSource } from '../db/userRepository';
import type { Source, SyncMetrics } from '../../domain/types';

export interface SyncSourceOptions {
  forceRefresh?: boolean;
  signal?: AbortSignal;
  onBackgroundStart?: (sourceId: string) => void;
  onBackgroundComplete?: (metrics: SyncMetrics) => void;
  onBackgroundError?: (error: unknown) => void;
}

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export function isSourceCacheStale(source: Source, nowMs = Date.now()): boolean {
  if (!source.lastSyncedAt) return true;
  const ttlMs = Math.max(1, source.cacheTtlMinutes) * 60 * 1000;
  return nowMs - source.lastSyncedAt >= ttlMs;
}

async function fetchAndPersistCatalog(
  source: Source,
  signal?: AbortSignal,
): Promise<{
  updatedSource: Source;
  metrics: SyncMetrics;
}> {
  const startedAt = Date.now();

  if (source.type === 'm3u') {
    const response = await fetchText(source.url, { signal });
    const parsed = await parseM3uInWorker(response.data, source.id);

    await replaceSourceCatalog({
      sourceId: source.id,
      categories: parsed.categories,
      channels: parsed.channels,
      vodItems: parsed.vodItems,
      series: parsed.series,
    });

    const updatedSource: Source = {
      ...source,
      epgUrl: source.epgUrl || parsed.detectedEpgUrl,
      lastSyncedAt: Date.now(),
    };
    await saveSource(updatedSource);

    return {
      updatedSource,
      metrics: {
        sourceId: source.id,
        durationMs: Date.now() - startedAt,
        categoriesCount: parsed.categories.length,
        channelsCount: parsed.channels.length,
        vodCount: parsed.vodItems.length,
        seriesCount: parsed.series.length,
        epgProgramsCount: 0,
        fromCache: false,
        revalidatedInBackground: false,
      },
    };
  }

  // Xtream Codes
  const xtreamData = await fetchXtreamCatalog(source, { signal });
  await replaceSourceCatalog({
    sourceId: source.id,
    categories: xtreamData.categories,
    channels: xtreamData.channels,
    vodItems: xtreamData.vodItems,
    series: xtreamData.series,
  });

  const updatedSource: Source = {
    ...source,
    accountInfo: xtreamData.accountInfo,
    epgUrl: source.epgUrl || buildXtreamXmltvUrl(source),
    lastSyncedAt: Date.now(),
  };
  await saveSource(updatedSource);

  return {
    updatedSource,
    metrics: {
      sourceId: source.id,
      durationMs: Date.now() - startedAt,
      categoriesCount: xtreamData.categories.length,
      channelsCount: xtreamData.channels.length,
      vodCount: xtreamData.vodItems.length,
      seriesCount: xtreamData.series.length,
      epgProgramsCount: 0,
      fromCache: false,
      revalidatedInBackground: false,
    },
  };
}

/**
 * Sincroniza uma fonte usando estratégia stale-while-revalidate:
 * - Se há cache local válido e `forceRefresh` é falso, retorna imediatamente do cache.
 * - Se o cache existe mas está expirado (TTL vencido), retorna o cache e revalida em segundo plano.
 */
export async function syncSource(
  source: Source,
  options?: SyncSourceOptions,
): Promise<{ updatedSource: Source; metrics: SyncMetrics }> {
  const forceRefresh = options?.forceRefresh ?? false;

  if (!forceRefresh && source.lastSyncedAt) {
    const startedAt = Date.now();
    const [categories, channels, vodItems, series] = await Promise.all([
      getCategoriesBySource(source.id),
      getChannelsBySource(source.id),
      getVodBySource(source.id),
      getSeriesBySource(source.id),
    ]);

    const hasCachedData =
      categories.length > 0 || channels.length > 0 || vodItems.length > 0 || series.length > 0;

    if (hasCachedData) {
      const stale = isSourceCacheStale(source);
      if (stale) {
        options?.onBackgroundStart?.(source.id);
        void fetchAndPersistCatalog(source, options?.signal)
          .then(({ metrics }) => {
            options?.onBackgroundComplete?.({
              ...metrics,
              revalidatedInBackground: true,
            });
          })
          .catch((err) => {
            options?.onBackgroundError?.(err);
          });
      }

      return {
        updatedSource: source,
        metrics: {
          sourceId: source.id,
          durationMs: Date.now() - startedAt,
          categoriesCount: categories.length,
          channelsCount: channels.length,
          vodCount: vodItems.length,
          seriesCount: series.length,
          epgProgramsCount: 0,
          fromCache: true,
          revalidatedInBackground: stale,
        },
      };
    }
  }

  return fetchAndPersistCatalog(source, options?.signal);
}

export async function syncEpgForSource(
  source: Source,
  options?: { signal?: AbortSignal; nowMs?: number },
): Promise<{ updatedSource: Source; programsCount: number }> {
  const epgUrl =
    source.epgUrl || (source.type === 'xtream' ? buildXtreamXmltvUrl(source) : undefined);

  if (!epgUrl) {
    return { updatedSource: source, programsCount: 0 };
  }

  const channels = await getChannelsBySource(source.id);
  const allowedChannelIds = new Set<string>();
  for (let i = 0; i < channels.length; i++) {
    const epgId = channels[i]?.epgChannelId;
    if (epgId) {
      allowedChannelIds.add(epgId);
    }
  }

  const nowMs = options?.nowMs ?? Date.now();
  const windowDays = Math.max(1, source.epgWindowDays || 2);
  const windowStartMs = nowMs - 2 * 60 * 60 * 1000;
  const windowEndMs = nowMs + windowDays * ONE_DAY_MS;

  const response = await fetchText(epgUrl, { signal: options?.signal, timeoutMs: 30000 });
  const parsed = await parseXmltvInWorker(response.data, {
    sourceId: source.id,
    windowStartMs,
    windowEndMs,
    allowedChannelIds: allowedChannelIds.size > 0 ? allowedChannelIds : undefined,
  });

  await replaceSourceEpg(source.id, parsed.programs);

  const updatedSource: Source = {
    ...source,
    lastEpgSyncedAt: Date.now(),
  };
  await saveSource(updatedSource);

  return {
    updatedSource,
    programsCount: parsed.programs.length,
  };
}
