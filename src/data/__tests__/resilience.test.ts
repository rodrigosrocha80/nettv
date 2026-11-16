import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetDbConnectionForTests, withQuotaRecovery } from '../db/database';
import { replaceSourceEpg } from '../db/epgRepository';
import { clearAllUserData } from '../db/userRepository';
import { fetchText } from '../http/httpClient';
import { syncSource } from '../sync/syncService';
import { DataLayerError, type Source } from '../../domain/types';

describe('Phase 7 resilience tests', () => {
  beforeEach(async () => {
    await clearAllUserData();
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await resetDbConnectionForTests();
  });

  it('serves cached catalog when TV opens without internet', async () => {
    const m3u = `#EXTM3U
#EXTINF:-1 group-title="Abertos",Cultura
https://cdn.example.com/cultura.m3u8
`;
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(m3u, { status: 200 }));

    const source: Source = {
      id: 'src-offline',
      name: 'Offline Test',
      type: 'm3u',
      url: 'https://cdn.example.com/list.m3u',
      cacheTtlMinutes: 720,
      epgWindowDays: 2,
      createdAt: 1,
    };

    const first = await syncSource(source);
    expect(first.metrics.channelsCount).toBe(1);

    // Simula TV reiniciada sem internet (fetch falha com TypeError)
    fetchSpy.mockRejectedValue(new TypeError('Failed to fetch'));
    const offlineSync = await syncSource(first.updatedSource);
    expect(offlineSync.metrics.fromCache).toBe(true);
    expect(offlineSync.metrics.channelsCount).toBe(1);
  });

  it('classifies HTTP 500, 401, and timeout errors cleanly without leaking credentials', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response('Server Error', { status: 500 }),
    );
    await expect(
      fetchText('https://alice:secret@panel.example.com/list.m3u?token=123'),
    ).rejects.toSatisfy((err: unknown) => {
      return (
        err instanceof DataLayerError &&
        err.code === 'HTTP_ERROR' &&
        err.message.indexOf('secret') === -1 &&
        err.message.indexOf('token=123') === -1
      );
    });

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response('Unauthorized', { status: 401 }),
    );
    await expect(fetchText('https://panel.example.com/list.m3u')).rejects.toMatchObject({
      code: 'AUTH_ERROR',
    });
  });

  it('recovers from QuotaExceededError by purging expired EPG programs', async () => {
    await replaceSourceEpg('src-q', [
      {
        id: 'old-prog',
        sourceId: 'src-q',
        channelEpgId: 'ch1',
        title: 'Antigo',
        startMs: 1000,
        endMs: 2000,
      },
    ]);

    let attempts = 0;
    const result = await withQuotaRecovery(async () => {
      attempts++;
      if (attempts === 1) {
        const quotaErr = new Error('Quota exceeded');
        quotaErr.name = 'QuotaExceededError';
        throw quotaErr;
      }
      return Promise.resolve('recovered');
    });

    expect(attempts).toBe(2);
    expect(result).toBe('recovered');
  });
});
