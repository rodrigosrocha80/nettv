export type SourceType = 'm3u' | 'xtream';

export interface XtreamAccountInfo {
  status: string;
  expDate?: number; // epoch ms
  isTrial?: boolean;
  activeConnections?: number;
  maxConnections?: number;
  allowedOutputFormats?: string[];
  serverTimeMs?: number;
}

export interface Source {
  id: string;
  name: string;
  type: SourceType;
  url: string; // URL M3U ou base URL Xtream
  username?: string;
  password?: string; // armazenada apenas localmente
  epgUrl?: string;
  cacheTtlMinutes: number; // padrão: 720 (12h)
  epgWindowDays: number; // padrão: 2 (hoje + 2 dias)
  lastSyncedAt?: number;
  lastEpgSyncedAt?: number;
  accountInfo?: XtreamAccountInfo;
  createdAt: number;
}

export interface Profile {
  id: string;
  name: string;
  avatarId: string;
  pinHash?: string; // SHA-256 local do PIN parental (opcional)
  lockedCategoryIds: string[];
  lockedChannelIds: string[];
  createdAt: number;
}

export type ContentKind = 'live' | 'vod' | 'series';

export interface Category {
  id: string; // `${sourceId}:${kind}:${rawId}`
  sourceId: string;
  kind: ContentKind;
  name: string;
  order: number;
}

export interface Channel {
  id: string;
  sourceId: string;
  categoryId: string;
  number?: number;
  name: string;
  nameLower: string;
  logoUrl?: string;
  streamUrl: string;
  epgChannelId?: string; // tvg-id
  isAdult?: boolean;
}

export interface VodItem {
  id: string;
  sourceId: string;
  categoryId: string;
  title: string;
  titleLower: string;
  posterUrl?: string;
  backdropUrl?: string;
  synopsis?: string;
  year?: number;
  rating?: string;
  durationSec?: number;
  streamUrl: string;
  containerExtension?: string;
}

export interface Episode {
  id: string;
  seriesId: string;
  seasonNumber: number;
  episodeNumber: number;
  title: string;
  durationSec?: number;
  streamUrl: string;
  containerExtension?: string;
}

export interface Season {
  seasonNumber: number;
  name: string;
  episodes: Episode[];
}

export interface Series {
  id: string;
  sourceId: string;
  categoryId: string;
  title: string;
  titleLower: string;
  posterUrl?: string;
  backdropUrl?: string;
  synopsis?: string;
  year?: number;
  rating?: string;
  seasons: Season[];
}

export interface EpgProgram {
  id: string;
  sourceId: string;
  channelEpgId: string; // correlação com Channel.epgChannelId
  title: string;
  description?: string;
  startMs: number;
  endMs: number;
}

export interface FavoriteItem {
  id: string; // `${profileId}:${kind}:${itemId}`
  profileId: string;
  itemId: string;
  kind: ContentKind;
  addedAt: number;
}

export interface HistoryItem {
  id: string; // `${profileId}:${kind}:${itemId}`
  profileId: string;
  itemId: string;
  kind: ContentKind;
  positionSec: number;
  durationSec: number;
  watched: boolean;
  updatedAt: number;
}

export type DataErrorCode =
  | 'NETWORK_ERROR'
  | 'CORS_OR_NETWORK_ERROR'
  | 'TIMEOUT_ERROR'
  | 'AUTH_ERROR'
  | 'HTTP_ERROR'
  | 'PARSE_ERROR'
  | 'INVALID_URL'
  | 'QUOTA_EXCEEDED';

export class DataLayerError extends Error {
  readonly code: DataErrorCode;
  readonly status?: number;
  readonly isInsecureHttp?: boolean;

  constructor(
    code: DataErrorCode,
    message: string,
    options?: { status?: number; isInsecureHttp?: boolean; cause?: unknown },
  ) {
    super(message);
    this.name = 'DataLayerError';
    this.code = code;
    this.status = options?.status;
    this.isInsecureHttp = options?.isInsecureHttp;
    if (options?.cause !== undefined) {
      (this as Error & { cause?: unknown }).cause = options.cause;
    }
  }
}

export type SyncStatus = 'idle' | 'syncing' | 'revalidating' | 'error';

export interface SyncMetrics {
  sourceId: string;
  durationMs: number;
  categoriesCount: number;
  channelsCount: number;
  vodCount: number;
  seriesCount: number;
  epgProgramsCount: number;
  fromCache: boolean;
  revalidatedInBackground: boolean;
}
