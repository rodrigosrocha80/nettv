import { fetchJson, type HttpRequestOptions } from '../http/httpClient';
import {
  DataLayerError,
  type Category,
  type Channel,
  type Episode,
  type Season,
  type Series,
  type Source,
  type VodItem,
  type XtreamAccountInfo,
} from '../../domain/types';

interface RawXtreamUserInfo {
  auth?: number | string;
  status?: string;
  exp_date?: string | number | null;
  is_trial?: string | number;
  active_cons?: string | number;
  max_connections?: string | number;
  allowed_output_formats?: string[];
}

interface RawXtreamServerInfo {
  timestamp_now?: number;
}

interface RawXtreamAuthResponse {
  user_info?: RawXtreamUserInfo;
  server_info?: RawXtreamServerInfo;
}

interface RawXtreamCategory {
  category_id: string | number;
  category_name: string;
}

interface RawXtreamLiveStream {
  stream_id: number | string;
  num?: number;
  name: string;
  stream_icon?: string;
  epg_channel_id?: string | null;
  category_id?: string | number;
  is_adult?: string | number;
}

interface RawXtreamVodStream {
  stream_id: number | string;
  name: string;
  stream_icon?: string;
  category_id?: string | number;
  container_extension?: string;
  rating?: string | number;
}

interface RawXtreamSeriesItem {
  series_id: number | string;
  name: string;
  cover?: string;
  plot?: string;
  releaseDate?: string;
  rating?: string | number;
  backdrop_path?: string[];
  category_id?: string | number;
}

interface RawXtreamEpisode {
  id: number | string;
  episode_num?: number | string;
  title?: string;
  container_extension?: string;
  info?: {
    duration_secs?: number;
  };
}

interface RawXtreamSeriesInfoResponse {
  info?: {
    name?: string;
    cover?: string;
    plot?: string;
    releaseDate?: string;
    rating?: string | number;
    backdrop_path?: string[];
  };
  episodes?: Record<string, RawXtreamEpisode[]>;
}

export interface XtreamCatalogResult {
  accountInfo: XtreamAccountInfo;
  categories: Category[];
  channels: Channel[];
  vodItems: VodItem[];
  series: Series[];
}

function normalizeBaseUrl(url: string): string {
  return url.trim().replace(/\/+$/, '');
}

function buildApiUrl(
  source: Pick<Source, 'url' | 'username' | 'password'>,
  action?: string,
  extraParams?: Record<string, string>,
): string {
  const base = normalizeBaseUrl(source.url);
  const username = encodeURIComponent(source.username ?? '');
  const password = encodeURIComponent(source.password ?? '');
  let query = `username=${username}&password=${password}`;
  if (action) {
    query += `&action=${encodeURIComponent(action)}`;
  }
  if (extraParams) {
    const keys = Object.keys(extraParams);
    for (let i = 0; i < keys.length; i++) {
      const k = keys[i];
      if (!k) continue;
      const v = extraParams[k];
      if (v !== undefined) {
        query += `&${encodeURIComponent(k)}=${encodeURIComponent(v)}`;
      }
    }
  }
  return `${base}/player_api.php?${query}`;
}

export function buildXtreamXmltvUrl(source: Pick<Source, 'url' | 'username' | 'password'>): string {
  const base = normalizeBaseUrl(source.url);
  const username = encodeURIComponent(source.username ?? '');
  const password = encodeURIComponent(source.password ?? '');
  return `${base}/xmltv.php?username=${username}&password=${password}`;
}

function toNumber(val: string | number | undefined | null): number | undefined {
  if (val === undefined || val === null || val === '') return undefined;
  const n = typeof val === 'number' ? val : Number.parseInt(val, 10);
  return Number.isFinite(n) ? n : undefined;
}

function parseAccountInfo(raw: RawXtreamAuthResponse): XtreamAccountInfo {
  const info = raw.user_info;
  if (!info || String(info.auth) !== '1') {
    throw new DataLayerError('AUTH_ERROR', 'Credenciais Xtream inválidas ou conta inativa.');
  }

  const expSec = toNumber(info.exp_date);
  return {
    status: info.status ?? 'Active',
    expDate: expSec ? expSec * 1000 : undefined,
    isTrial: String(info.is_trial) === '1',
    activeConnections: toNumber(info.active_cons),
    maxConnections: toNumber(info.max_connections),
    allowedOutputFormats: Array.isArray(info.allowed_output_formats)
      ? info.allowed_output_formats
      : undefined,
    serverTimeMs: raw.server_info?.timestamp_now ? raw.server_info.timestamp_now * 1000 : undefined,
  };
}

export async function authenticateXtream(
  source: Pick<Source, 'url' | 'username' | 'password'>,
  options?: HttpRequestOptions,
): Promise<XtreamAccountInfo> {
  const url = buildApiUrl(source);
  const { data } = await fetchJson<RawXtreamAuthResponse>(url, options);
  return parseAccountInfo(data);
}

export async function fetchXtreamCatalog(
  source: Source,
  options?: HttpRequestOptions,
): Promise<XtreamCatalogResult> {
  const accountInfo = await authenticateXtream(source, options);
  const base = normalizeBaseUrl(source.url);
  const u = encodeURIComponent(source.username ?? '');
  const p = encodeURIComponent(source.password ?? '');

  const liveExt =
    accountInfo.allowedOutputFormats && accountInfo.allowedOutputFormats.indexOf('m3u8') !== -1
      ? 'm3u8'
      : 'ts';

  const safeFetchList = async <T>(action: string): Promise<T[]> => {
    try {
      const res = await fetchJson<T[]>(buildApiUrl(source, action), options);
      return Array.isArray(res.data) ? res.data : [];
    } catch (err) {
      if (err instanceof DataLayerError && err.code === 'AUTH_ERROR') {
        throw err;
      }
      return [];
    }
  };

  const [rawLiveCats, rawLiveStreams, rawVodCats, rawVodStreams, rawSeriesCats, rawSeriesList] =
    await Promise.all([
      safeFetchList<RawXtreamCategory>('get_live_categories'),
      safeFetchList<RawXtreamLiveStream>('get_live_streams'),
      safeFetchList<RawXtreamCategory>('get_vod_categories'),
      safeFetchList<RawXtreamVodStream>('get_vod_streams'),
      safeFetchList<RawXtreamCategory>('get_series_categories'),
      safeFetchList<RawXtreamSeriesItem>('get_series'),
    ]);

  const categories: Category[] = [];
  let order = 0;

  const pushCategories = (
    list: RawXtreamCategory[],
    kind: Category['kind'],
  ): Map<string, string> => {
    const map = new Map<string, string>();
    for (let i = 0; i < list.length; i++) {
      const item = list[i];
      if (!item) continue;
      const rawId = String(item.category_id);
      const catId = `${source.id}:${kind}:${rawId}`;
      map.set(rawId, catId);
      categories.push({
        id: catId,
        sourceId: source.id,
        kind,
        name: item.category_name || 'Sem Categoria',
        order: order++,
      });
    }
    return map;
  };

  const liveCatMap = pushCategories(rawLiveCats, 'live');
  const vodCatMap = pushCategories(rawVodCats, 'vod');
  const seriesCatMap = pushCategories(rawSeriesCats, 'series');

  const channels: Channel[] = rawLiveStreams.map((item) => {
    const rawCatId = item.category_id !== undefined ? String(item.category_id) : '';
    const categoryId = liveCatMap.get(rawCatId) ?? `${source.id}:live:uncategorized`;
    const name = item.name || `Canal ${item.stream_id}`;
    return {
      id: `${source.id}:live:${item.stream_id}`,
      sourceId: source.id,
      categoryId,
      number: item.num,
      name,
      nameLower: name.toLowerCase(),
      logoUrl: item.stream_icon || undefined,
      streamUrl: `${base}/live/${u}/${p}/${item.stream_id}.${liveExt}`,
      epgChannelId: item.epg_channel_id || undefined,
      isAdult: String(item.is_adult) === '1' || undefined,
    };
  });

  const vodItems: VodItem[] = rawVodStreams.map((item) => {
    const rawCatId = item.category_id !== undefined ? String(item.category_id) : '';
    const categoryId = vodCatMap.get(rawCatId) ?? `${source.id}:vod:uncategorized`;
    const ext = item.container_extension || 'mp4';
    const title = item.name || `Filme ${item.stream_id}`;
    return {
      id: `${source.id}:vod:${item.stream_id}`,
      sourceId: source.id,
      categoryId,
      title,
      titleLower: title.toLowerCase(),
      posterUrl: item.stream_icon || undefined,
      rating: item.rating !== undefined ? String(item.rating) : undefined,
      streamUrl: `${base}/movie/${u}/${p}/${item.stream_id}.${ext}`,
      containerExtension: ext,
    };
  });

  const series: Series[] = rawSeriesList.map((item) => {
    const rawCatId = item.category_id !== undefined ? String(item.category_id) : '';
    const categoryId = seriesCatMap.get(rawCatId) ?? `${source.id}:series:uncategorized`;
    const title = item.name || `Série ${item.series_id}`;
    const yearMatch = item.releaseDate ? /(\d{4})/.exec(item.releaseDate) : null;
    return {
      id: `${source.id}:series:${item.series_id}`,
      sourceId: source.id,
      categoryId,
      title,
      titleLower: title.toLowerCase(),
      posterUrl: item.cover || undefined,
      backdropUrl:
        Array.isArray(item.backdrop_path) && item.backdrop_path.length > 0
          ? item.backdrop_path[0]
          : undefined,
      synopsis: item.plot || undefined,
      year: yearMatch?.[1] ? Number.parseInt(yearMatch[1], 10) : undefined,
      rating: item.rating !== undefined ? String(item.rating) : undefined,
      seasons: [],
    };
  });

  return {
    accountInfo,
    categories,
    channels,
    vodItems,
    series,
  };
}

export async function fetchXtreamSeriesSeasons(
  source: Source,
  seriesId: string,
  options?: HttpRequestOptions,
): Promise<{
  seasons: Season[];
  synopsis?: string;
  backdropUrl?: string;
  year?: number;
  rating?: string;
}> {
  const prefix = `${source.id}:series:`;
  const rawSeriesId = seriesId.indexOf(prefix) === 0 ? seriesId.slice(prefix.length) : seriesId;

  const url = buildApiUrl(source, 'get_series_info', { series_id: rawSeriesId });
  const { data } = await fetchJson<RawXtreamSeriesInfoResponse>(url, options);

  const base = normalizeBaseUrl(source.url);
  const u = encodeURIComponent(source.username ?? '');
  const p = encodeURIComponent(source.password ?? '');

  const seasons: Season[] = [];
  const episodesBySeason = data.episodes ?? {};
  const seasonKeys = Object.keys(episodesBySeason).sort(
    (a, b) => Number.parseInt(a, 10) - Number.parseInt(b, 10),
  );

  for (let i = 0; i < seasonKeys.length; i++) {
    const sKey = seasonKeys[i];
    if (!sKey) continue;
    const rawEps = episodesBySeason[sKey];
    if (!Array.isArray(rawEps)) continue;

    const seasonNumber = Number.parseInt(sKey, 10) || 1;
    const episodes: Episode[] = rawEps.map((ep, idx) => {
      const epNum = toNumber(ep.episode_num) ?? idx + 1;
      const ext = ep.container_extension || 'mp4';
      return {
        id: `${seriesId}:s${seasonNumber}e${epNum}:${ep.id}`,
        seriesId,
        seasonNumber,
        episodeNumber: epNum,
        title: ep.title || `Episódio ${epNum}`,
        durationSec: ep.info?.duration_secs,
        streamUrl: `${base}/series/${u}/${p}/${ep.id}.${ext}`,
        containerExtension: ext,
      };
    });

    seasons.push({
      seasonNumber,
      name: `Temporada ${seasonNumber}`,
      episodes,
    });
  }

  const info = data.info;
  const yearMatch = info?.releaseDate ? /(\d{4})/.exec(info.releaseDate) : null;

  return {
    seasons,
    synopsis: info?.plot || undefined,
    backdropUrl:
      Array.isArray(info?.backdrop_path) && info.backdrop_path.length > 0
        ? info.backdrop_path[0]
        : undefined,
    year: yearMatch?.[1] ? Number.parseInt(yearMatch[1], 10) : undefined,
    rating: info?.rating !== undefined ? String(info.rating) : undefined,
  };
}
