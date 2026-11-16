import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  authenticateXtream,
  buildXtreamXmltvUrl,
  fetchXtreamCatalog,
  fetchXtreamSeriesSeasons,
} from '../xtream/xtreamClient';
import { DataLayerError, type Source } from '../../domain/types';

const mockSource: Source = {
  id: 'src-xt',
  name: 'Meu Servidor',
  type: 'xtream',
  url: 'https://panel.example.com:8443',
  username: 'alice',
  password: 'secret',
  cacheTtlMinutes: 720,
  epgWindowDays: 2,
  createdAt: 1000,
};

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('xtreamClient', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('builds sanitized xmltv URL', () => {
    expect(buildXtreamXmltvUrl(mockSource)).toBe(
      'https://panel.example.com:8443/xmltv.php?username=alice&password=secret',
    );
  });

  it('throws AUTH_ERROR when Xtream auth fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      jsonResponse({ user_info: { auth: 0, status: 'Disabled' } }),
    );

    await expect(authenticateXtream(mockSource)).rejects.toMatchObject({
      name: 'DataLayerError',
      code: 'AUTH_ERROR',
    } satisfies Partial<DataLayerError>);
  });

  it('fetches catalog and series episodes', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const url =
        typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      if (url.indexOf('action=') === -1) {
        return Promise.resolve(
          jsonResponse({
            user_info: {
              auth: 1,
              status: 'Active',
              exp_date: '1800000000',
              active_cons: '1',
              max_connections: '2',
              allowed_output_formats: ['m3u8', 'ts'],
            },
            server_info: { timestamp_now: 1700000000 },
          }),
        );
      }
      if (url.indexOf('get_live_categories') !== -1) {
        return Promise.resolve(jsonResponse([{ category_id: '10', category_name: 'Esportes' }]));
      }
      if (url.indexOf('get_live_streams') !== -1) {
        return Promise.resolve(
          jsonResponse([
            {
              stream_id: 55,
              num: 1,
              name: 'SporTV',
              stream_icon: 'https://img.example.com/sportv.png',
              epg_channel_id: 'sportv.br',
              category_id: '10',
            },
          ]),
        );
      }
      if (url.indexOf('get_vod_categories') !== -1) {
        return Promise.resolve(jsonResponse([{ category_id: '20', category_name: 'Ação' }]));
      }
      if (url.indexOf('get_vod_streams') !== -1) {
        return Promise.resolve(
          jsonResponse([
            {
              stream_id: 99,
              name: 'Filme Ação',
              category_id: '20',
              container_extension: 'mp4',
            },
          ]),
        );
      }
      if (url.indexOf('get_series_categories') !== -1) {
        return Promise.resolve(jsonResponse([{ category_id: '30', category_name: 'Drama' }]));
      }
      if (url.indexOf('get_series_info') !== -1) {
        return Promise.resolve(
          jsonResponse({
            info: { plot: 'Sinopse teste', releaseDate: '2024-05-01', rating: '8.5' },
            episodes: {
              '1': [{ id: 701, episode_num: 1, title: 'Piloto', container_extension: 'mkv' }],
            },
          }),
        );
      }
      if (url.indexOf('get_series') !== -1) {
        return Promise.resolve(
          jsonResponse([{ series_id: 300, name: 'Breaking', category_id: '30' }]),
        );
      }
      return Promise.resolve(jsonResponse([]));
    });

    const catalog = await fetchXtreamCatalog(mockSource);
    expect(catalog.accountInfo.status).toBe('Active');
    expect(catalog.accountInfo.maxConnections).toBe(2);
    expect(catalog.channels).toHaveLength(1);
    expect(catalog.channels[0]?.streamUrl).toBe(
      'https://panel.example.com:8443/live/alice/secret/55.m3u8',
    );
    expect(catalog.vodItems[0]?.streamUrl).toBe(
      'https://panel.example.com:8443/movie/alice/secret/99.mp4',
    );
    expect(catalog.series).toHaveLength(1);

    const details = await fetchXtreamSeriesSeasons(mockSource, 'src-xt:series:300');
    expect(details.year).toBe(2024);
    expect(details.seasons).toHaveLength(1);
    expect(details.seasons[0]?.episodes[0]?.streamUrl).toBe(
      'https://panel.example.com:8443/series/alice/secret/701.mkv',
    );
  });
});
