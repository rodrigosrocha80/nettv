import { getDb, withQuotaRecovery } from './database';
import type { EpgProgram } from '../../domain/types';

const EPG_BATCH_SIZE = 2000;

export async function clearSourceEpg(sourceId: string): Promise<void> {
  const db = await getDb();
  const tx = db.transaction('epg', 'readwrite');
  const index = tx.store.index('by_source');
  let cursor = await index.openKeyCursor(sourceId);
  while (cursor) {
    await tx.store.delete(cursor.primaryKey);
    cursor = await cursor.continue();
  }
  await tx.done;
}

export async function replaceSourceEpg(sourceId: string, programs: EpgProgram[]): Promise<void> {
  await withQuotaRecovery(async () => {
    await clearSourceEpg(sourceId);
    if (programs.length === 0) return;

    const db = await getDb();
    for (let offset = 0; offset < programs.length; offset += EPG_BATCH_SIZE) {
      const end = Math.min(offset + EPG_BATCH_SIZE, programs.length);
      const tx = db.transaction('epg', 'readwrite');
      for (let i = offset; i < end; i++) {
        const prog = programs[i];
        if (prog) {
          void tx.store.put(prog);
        }
      }
      await tx.done;
    }
  });
}

export async function getProgramsForChannel(
  channelEpgId: string,
  fromMs: number,
  toMs: number,
): Promise<EpgProgram[]> {
  if (!channelEpgId) return [];
  const db = await getDb();
  // Busca programas cujo startMs <= toMs e filtra endMs >= fromMs
  const range = IDBKeyRange.bound([channelEpgId, 0], [channelEpgId, toMs]);
  const rows = await db.getAllFromIndex('epg', 'by_channel_time', range);
  return rows.filter((p) => p.endMs >= fromMs).sort((a, b) => a.startMs - b.startMs);
}

export async function getCurrentAndNextProgram(
  channelEpgId: string,
  nowMs = Date.now(),
): Promise<{ current?: EpgProgram; next?: EpgProgram }> {
  if (!channelEpgId) return {};
  const programs = await getProgramsForChannel(channelEpgId, nowMs, nowMs + 12 * 60 * 60 * 1000);
  let current: EpgProgram | undefined;
  let next: EpgProgram | undefined;

  for (let i = 0; i < programs.length; i++) {
    const p = programs[i];
    if (!p) continue;
    if (p.startMs <= nowMs && p.endMs > nowMs) {
      current = p;
      next = programs[i + 1];
      break;
    }
    if (p.startMs > nowMs) {
      next = p;
      break;
    }
  }

  return { current, next };
}
