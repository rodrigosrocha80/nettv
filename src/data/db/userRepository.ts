import { getDb } from './database';
import type { FavoriteItem, HistoryItem, Profile, Source } from '../../domain/types';

// --- Sources ---

export async function getAllSources(): Promise<Source[]> {
  const db = await getDb();
  const list = await db.getAll('sources');
  return list.sort((a, b) => a.createdAt - b.createdAt);
}

export async function getSourceById(id: string): Promise<Source | undefined> {
  const db = await getDb();
  return db.get('sources', id);
}

export async function saveSource(source: Source): Promise<void> {
  const db = await getDb();
  await db.put('sources', source);
}

export async function deleteSource(id: string): Promise<void> {
  const db = await getDb();
  await db.delete('sources', id);
}

// --- Profiles ---

export async function getAllProfiles(): Promise<Profile[]> {
  const db = await getDb();
  const list = await db.getAll('profiles');
  return list.sort((a, b) => a.createdAt - b.createdAt);
}

export async function saveProfile(profile: Profile): Promise<void> {
  const db = await getDb();
  await db.put('profiles', profile);
}

export async function deleteProfile(id: string): Promise<void> {
  const db = await getDb();
  await db.delete('profiles', id);

  // Limpa favoritos e histórico do perfil removido
  const txFav = db.transaction('favorites', 'readwrite');
  let favCursor = await txFav.store.index('by_profile').openKeyCursor(id);
  while (favCursor) {
    await txFav.store.delete(favCursor.primaryKey);
    favCursor = await favCursor.continue();
  }
  await txFav.done;

  const txHist = db.transaction('history', 'readwrite');
  let histCursor = await txHist.store.index('by_profile').openKeyCursor(id);
  while (histCursor) {
    await txHist.store.delete(histCursor.primaryKey);
    histCursor = await histCursor.continue();
  }
  await txHist.done;
}

// --- Favorites ---

export async function getFavoritesByProfile(profileId: string): Promise<FavoriteItem[]> {
  const db = await getDb();
  const list = await db.getAllFromIndex('favorites', 'by_profile', profileId);
  return list.sort((a, b) => b.addedAt - a.addedAt);
}

export async function saveFavorite(item: FavoriteItem): Promise<void> {
  const db = await getDb();
  await db.put('favorites', item);
}

export async function removeFavorite(id: string): Promise<void> {
  const db = await getDb();
  await db.delete('favorites', id);
}

// --- History ---

export async function getHistoryByProfile(profileId: string): Promise<HistoryItem[]> {
  const db = await getDb();
  const list = await db.getAllFromIndex('history', 'by_profile', profileId);
  return list.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function saveHistoryItem(item: HistoryItem): Promise<void> {
  const db = await getDb();
  await db.put('history', item);
}

export async function clearAllUserData(): Promise<void> {
  const db = await getDb();
  const storeNames = [
    'sources',
    'profiles',
    'categories',
    'channels',
    'vod',
    'series',
    'epg',
    'favorites',
    'history',
  ] as const;

  const tx = db.transaction([...storeNames], 'readwrite');
  for (let i = 0; i < storeNames.length; i++) {
    const name = storeNames[i];
    if (name) {
      void tx.objectStore(name).clear();
    }
  }
  await tx.done;
}
