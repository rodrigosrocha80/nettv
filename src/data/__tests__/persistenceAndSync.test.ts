import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetDbConnectionForTests } from '../db/database';
import { replaceSourceCatalog, searchCatalog } from '../db/catalogRepository';
import { getCurrentAndNextProgram, replaceSourceEpg } from '../db/epgRepository';
import { clearAllUserData } from '../db/userRepository';
import { syncSource } from '../sync/syncService';
import { useProfileStore } from '../../domain/stores/profileStore';
import { useSourceStore } from '../../domain/stores/sourceStore';
import type { Source } from '../../domain/types';

describe('IndexedDB persistence, search, EPG, stores & stale-while-revalidate', () => {
  beforeEach(async () => {
    await clearAllUserData();
    useProfileStore.getState().resetStore();
    useSourceStore.getState().resetStore();
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await resetDbConnectionForTests();
  });

  it('persists 5,000 items in IndexedDB and searches by prefix/substring quickly', async () => {
    const channels = Array.from({ length: 5000 }, (_, i) => ({
      id: `src-1:live:${i}`,
      sourceId: 'src-1',
      categoryId: 'src-1:live:cat1',
      name: i === 4242 ? 'Canal Especial Globo' : `Canal Genérico ${i}`,
      nameLower: (i === 4242 ? 'Canal Especial Globo' : `Canal Genérico ${i}`).toLowerCase(),
      streamUrl: `https://cdn.example.com/${i}.m3u8`,
      epgChannelId: i === 4242 ? 'globo.br' : undefined,
    }));

    const startSave = performance.now();
    await replaceSourceCatalog({
      sourceId: 'src-1',
      categories: [
        { id: 'src-1:live:cat1', sourceId: 'src-1', kind: 'live', name: 'Abertos', order: 0 },
      ],
      channels,
      vodItems: [],
      series: [],
    });
    const saveMs = performance.now() - startSave;

    const startSearch = performance.now();
    const res = await searchCatalog('especial', { sourceId: 'src-1' });
    const searchMs = performance.now() - startSearch;

    expect(res.channels).toHaveLength(1);
    expect(res.channels[0]?.name).toBe('Canal Especial Globo');
    expect(saveMs).toBeLessThan(12000);
    expect(searchMs).toBeLessThan(1000);
  }, 15000);

  it('queries current and next EPG program accurately', async () => {
    const now = Date.UTC(2026, 10, 16, 12, 30, 0);
    await replaceSourceEpg('src-1', [
      {
        id: 'p1',
        sourceId: 'src-1',
        channelEpgId: 'globo.br',
        title: 'Jornal Hoje',
        startMs: Date.UTC(2026, 10, 16, 12, 0, 0),
        endMs: Date.UTC(2026, 10, 16, 13, 0, 0),
      },
      {
        id: 'p2',
        sourceId: 'src-1',
        channelEpgId: 'globo.br',
        title: 'Sessão da Tarde',
        startMs: Date.UTC(2026, 10, 16, 13, 0, 0),
        endMs: Date.UTC(2026, 10, 16, 15, 0, 0),
      },
    ]);

    const { current, next } = await getCurrentAndNextProgram('globo.br', now);
    expect(current?.title).toBe('Jornal Hoje');
    expect(next?.title).toBe('Sessão da Tarde');
  });

  it('implements stale-while-revalidate and persists profiles, favorites and history', async () => {
    const m3uBody = `#EXTM3U
#EXTINF:-1 tvg-id="c1" group-title="Geral",Canal Um
https://cdn.example.com/1.m3u8
`;
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(() => Promise.resolve(new Response(m3uBody, { status: 200 })));

    // 1. Cria perfil, favorito e histórico
    const profile = await useProfileStore.getState().createProfile({
      name: 'Rodrigo',
      avatarId: 'avatar-1',
      pin: '4321',
    });
    expect(await useProfileStore.getState().verifyProfilePin(profile.id, '4321')).toBe(true);
    await useProfileStore.getState().toggleFavorite('src-1:live:1', 'live');
    await useProfileStore.getState().recordHistory('src-1:vod:9', 'vod', 95, 100);

    // Simula reinício do app limpando Zustand e recarregando do IndexedDB
    useProfileStore.getState().resetStore();
    await useProfileStore.getState().loadProfiles();
    expect(useProfileStore.getState().profiles).toHaveLength(1);
    expect(useProfileStore.getState().favorites).toHaveLength(1);
    expect(useProfileStore.getState().history[0]?.watched).toBe(true);

    // 2. Adiciona fonte e sincroniza pela primeira vez
    const source: Source = await useSourceStore.getState().addSource({
      name: 'Lista Principal',
      type: 'm3u',
      url: 'https://cdn.example.com/playlist.m3u',
      cacheTtlMinutes: 60,
    });

    const firstSync = await syncSource(source);
    expect(firstSync.metrics.fromCache).toBe(false);
    expect(firstSync.metrics.channelsCount).toBe(1);
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    // 3. Cache válido: retorna do cache sem chamar fetch
    const freshCacheSync = await syncSource(firstSync.updatedSource);
    expect(freshCacheSync.metrics.fromCache).toBe(true);
    expect(freshCacheSync.metrics.revalidatedInBackground).toBe(false);
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    // 4. Cache expirado: retorna do cache imediatamente e revalida em segundo plano
    const expiredSource: Source = {
      ...firstSync.updatedSource,
      lastSyncedAt: Date.now() - 120 * 60 * 1000,
    };
    let bgDone = false;
    const staleSync = await syncSource(expiredSource, {
      onBackgroundComplete: () => {
        bgDone = true;
      },
    });
    expect(staleSync.metrics.fromCache).toBe(true);
    expect(staleSync.metrics.revalidatedInBackground).toBe(true);

    // Aguarda microtasks da revalidação em segundo plano
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(bgDone).toBe(true);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });
});
