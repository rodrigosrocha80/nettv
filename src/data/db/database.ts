import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import {
  DataLayerError,
  type Category,
  type Channel,
  type ContentKind,
  type EpgProgram,
  type FavoriteItem,
  type HistoryItem,
  type Profile,
  type Series,
  type Source,
  type VodItem,
} from '../../domain/types';

export const DB_NAME = 'nettv-db';
export const DB_VERSION = 1;

export interface NetTvDbSchema extends DBSchema {
  sources: {
    key: string;
    value: Source;
  };
  profiles: {
    key: string;
    value: Profile;
  };
  categories: {
    key: string;
    value: Category;
    indexes: {
      by_source: string;
      by_source_kind: [string, ContentKind];
    };
  };
  channels: {
    key: string;
    value: Channel;
    indexes: {
      by_source: string;
      by_category: string;
      by_epg_id: string;
      by_name: string;
    };
  };
  vod: {
    key: string;
    value: VodItem;
    indexes: {
      by_source: string;
      by_category: string;
      by_name: string;
    };
  };
  series: {
    key: string;
    value: Series;
    indexes: {
      by_source: string;
      by_category: string;
      by_name: string;
    };
  };
  epg: {
    key: string;
    value: EpgProgram;
    indexes: {
      by_source: string;
      by_channel_time: [string, number];
      by_end: number;
    };
  };
  favorites: {
    key: string;
    value: FavoriteItem;
    indexes: {
      by_profile: string;
    };
  };
  history: {
    key: string;
    value: HistoryItem;
    indexes: {
      by_profile: string;
    };
  };
}

let dbPromise: Promise<IDBPDatabase<NetTvDbSchema>> | null = null;

export function getDb(): Promise<IDBPDatabase<NetTvDbSchema>> {
  if (!dbPromise) {
    dbPromise = openDB<NetTvDbSchema>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('sources')) {
          db.createObjectStore('sources', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('profiles')) {
          db.createObjectStore('profiles', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('categories')) {
          const catStore = db.createObjectStore('categories', { keyPath: 'id' });
          catStore.createIndex('by_source', 'sourceId');
          catStore.createIndex('by_source_kind', ['sourceId', 'kind']);
        }
        if (!db.objectStoreNames.contains('channels')) {
          const chStore = db.createObjectStore('channels', { keyPath: 'id' });
          chStore.createIndex('by_source', 'sourceId');
          chStore.createIndex('by_category', 'categoryId');
          chStore.createIndex('by_epg_id', 'epgChannelId');
          chStore.createIndex('by_name', 'nameLower');
        }
        if (!db.objectStoreNames.contains('vod')) {
          const vodStore = db.createObjectStore('vod', { keyPath: 'id' });
          vodStore.createIndex('by_source', 'sourceId');
          vodStore.createIndex('by_category', 'categoryId');
          vodStore.createIndex('by_name', 'titleLower');
        }
        if (!db.objectStoreNames.contains('series')) {
          const seriesStore = db.createObjectStore('series', { keyPath: 'id' });
          seriesStore.createIndex('by_source', 'sourceId');
          seriesStore.createIndex('by_category', 'categoryId');
          seriesStore.createIndex('by_name', 'titleLower');
        }
        if (!db.objectStoreNames.contains('epg')) {
          const epgStore = db.createObjectStore('epg', { keyPath: 'id' });
          epgStore.createIndex('by_source', 'sourceId');
          epgStore.createIndex('by_channel_time', ['channelEpgId', 'startMs']);
          epgStore.createIndex('by_end', 'endMs');
        }
        if (!db.objectStoreNames.contains('favorites')) {
          const favStore = db.createObjectStore('favorites', { keyPath: 'id' });
          favStore.createIndex('by_profile', 'profileId');
        }
        if (!db.objectStoreNames.contains('history')) {
          const histStore = db.createObjectStore('history', { keyPath: 'id' });
          histStore.createIndex('by_profile', 'profileId');
        }
      },
    });
  }
  return dbPromise;
}

export async function resetDbConnectionForTests(): Promise<void> {
  if (dbPromise) {
    const db = await dbPromise;
    db.close();
    dbPromise = null;
  }
}

export function isQuotaExceededError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const name = (err as { name?: string }).name;
  return name === 'QuotaExceededError' || name === 'NS_ERROR_DOM_QUOTA_REACHED';
}

export async function purgeExpiredEpg(cutoffMs = Date.now()): Promise<number> {
  const db = await getDb();
  const tx = db.transaction('epg', 'readwrite');
  const index = tx.store.index('by_end');
  const range = IDBKeyRange.upperBound(cutoffMs, true);
  let deleted = 0;

  let cursor = await index.openCursor(range);
  while (cursor) {
    await cursor.delete();
    deleted++;
    cursor = await cursor.continue();
  }
  await tx.done;
  return deleted;
}

export async function withQuotaRecovery<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (err) {
    if (!isQuotaExceededError(err)) {
      throw err;
    }
    await purgeExpiredEpg(Date.now());
    try {
      return await operation();
    } catch (retryErr) {
      if (isQuotaExceededError(retryErr)) {
        throw new DataLayerError(
          'QUOTA_EXCEEDED',
          'Espaço de armazenamento local insuficiente. Limpe o cache ou remova fontes antigas.',
          { cause: retryErr },
        );
      }
      throw retryErr;
    }
  }
}
