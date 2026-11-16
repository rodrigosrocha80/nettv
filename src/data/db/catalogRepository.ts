import { getDb, withQuotaRecovery } from './database';
import type { Category, Channel, ContentKind, Series, VodItem } from '../../domain/types';

const BATCH_SIZE = 1500;

async function deleteBySourceInStore(
  storeName: 'categories' | 'channels' | 'vod' | 'series',
  sourceId: string,
): Promise<void> {
  const db = await getDb();
  const tx = db.transaction(storeName, 'readwrite');
  const index = tx.store.index('by_source');
  let cursor = await index.openKeyCursor(sourceId);
  while (cursor) {
    await tx.store.delete(cursor.primaryKey);
    cursor = await cursor.continue();
  }
  await tx.done;
}

async function putInBatches<T extends Category | Channel | VodItem | Series>(
  storeName: 'categories' | 'channels' | 'vod' | 'series',
  items: T[],
): Promise<void> {
  if (items.length === 0) return;
  const db = await getDb();

  for (let offset = 0; offset < items.length; offset += BATCH_SIZE) {
    const end = Math.min(offset + BATCH_SIZE, items.length);
    const tx = db.transaction(storeName, 'readwrite');
    for (let i = offset; i < end; i++) {
      const item = items[i];
      if (item) {
        void tx.store.put(item);
      }
    }
    await tx.done;
  }
}

export interface SaveCatalogPayload {
  sourceId: string;
  categories: Category[];
  channels: Channel[];
  vodItems: VodItem[];
  series: Series[];
}

export async function replaceSourceCatalog(payload: SaveCatalogPayload): Promise<void> {
  await withQuotaRecovery(async () => {
    await Promise.all([
      deleteBySourceInStore('categories', payload.sourceId),
      deleteBySourceInStore('channels', payload.sourceId),
      deleteBySourceInStore('vod', payload.sourceId),
      deleteBySourceInStore('series', payload.sourceId),
    ]);

    await putInBatches('categories', payload.categories);
    await putInBatches('channels', payload.channels);
    await putInBatches('vod', payload.vodItems);
    await putInBatches('series', payload.series);
  });
}

export async function clearSourceCatalog(sourceId: string): Promise<void> {
  await Promise.all([
    deleteBySourceInStore('categories', sourceId),
    deleteBySourceInStore('channels', sourceId),
    deleteBySourceInStore('vod', sourceId),
    deleteBySourceInStore('series', sourceId),
  ]);
}

export async function getCategoriesBySource(
  sourceId: string,
  kind?: ContentKind,
): Promise<Category[]> {
  const db = await getDb();
  const rows = kind
    ? await db.getAllFromIndex('categories', 'by_source_kind', [sourceId, kind])
    : await db.getAllFromIndex('categories', 'by_source', sourceId);
  return rows.sort((a, b) => a.order - b.order);
}

export async function getChannelsBySource(sourceId: string): Promise<Channel[]> {
  const db = await getDb();
  return db.getAllFromIndex('channels', 'by_source', sourceId);
}

export async function getChannelsByCategory(categoryId: string): Promise<Channel[]> {
  const db = await getDb();
  return db.getAllFromIndex('channels', 'by_category', categoryId);
}

export async function getVodBySource(sourceId: string): Promise<VodItem[]> {
  const db = await getDb();
  return db.getAllFromIndex('vod', 'by_source', sourceId);
}

export async function getVodByCategory(categoryId: string): Promise<VodItem[]> {
  const db = await getDb();
  return db.getAllFromIndex('vod', 'by_category', categoryId);
}

export async function getSeriesBySource(sourceId: string): Promise<Series[]> {
  const db = await getDb();
  return db.getAllFromIndex('series', 'by_source', sourceId);
}

export async function getSeriesByCategory(categoryId: string): Promise<Series[]> {
  const db = await getDb();
  return db.getAllFromIndex('series', 'by_category', categoryId);
}

export async function updateSeriesDetails(series: Series): Promise<void> {
  const db = await getDb();
  await db.put('series', series);
}

export interface CatalogSearchResults {
  channels: Channel[];
  vodItems: VodItem[];
  series: Series[];
}

export async function searchCatalog(
  query: string,
  options?: { sourceId?: string; limitPerKind?: number },
): Promise<CatalogSearchResults> {
  const normalized = query.trim().toLowerCase();
  const limit = options?.limitPerKind ?? 50;
  if (!normalized) {
    return { channels: [], vodItems: [], series: [] };
  }

  const db = await getDb();
  const prefixRange = IDBKeyRange.bound(normalized, `${normalized}\uffff`);

  const collectMatches = async <T extends { id: string; sourceId: string }>(
    storeName: 'channels' | 'vod' | 'series',
    getText: (item: T) => string,
  ): Promise<T[]> => {
    const results: T[] = [];
    const seen = new Set<string>();

    // 1. Busca rápida por prefixo via índice `by_name` em uma única chamada IDB
    const prefixHits = (await db.getAllFromIndex(
      storeName,
      'by_name',
      prefixRange,
      limit,
    )) as unknown as T[];

    for (let i = 0; i < prefixHits.length && results.length < limit; i++) {
      const val = prefixHits[i];
      if (!val) continue;
      if (!options?.sourceId || val.sourceId === options.sourceId) {
        results.push(val);
        seen.add(val.id);
      }
    }

    if (results.length >= limit) {
      return results;
    }

    // 2. Completa com busca por substring em memória a partir de uma única leitura em lote
    const pool = (options?.sourceId
      ? await db.getAllFromIndex(storeName, 'by_source', options.sourceId)
      : await db.getAll(storeName)) as unknown as T[];

    for (let i = 0; i < pool.length && results.length < limit; i++) {
      const val = pool[i];
      if (!val) continue;
      if (!seen.has(val.id) && getText(val).indexOf(normalized) !== -1) {
        results.push(val);
        seen.add(val.id);
      }
    }

    return results;
  };

  const [channels, vodItems, series] = await Promise.all([
    collectMatches<Channel>('channels', (c) => c.nameLower),
    collectMatches<VodItem>('vod', (v) => v.titleLower),
    collectMatches<Series>('series', (s) => s.titleLower),
  ]);

  return { channels, vodItems, series };
}
