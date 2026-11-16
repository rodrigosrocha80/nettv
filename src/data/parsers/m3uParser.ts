import type {
  Category,
  Channel,
  ContentKind,
  Episode,
  Season,
  Series,
  VodItem,
} from '../../domain/types';

export interface M3uParseResult {
  categories: Category[];
  channels: Channel[];
  vodItems: VodItem[];
  series: Series[];
  detectedEpgUrl?: string;
  skippedLines: number;
}

const DEFAULT_GROUP = 'Sem Categoria';
const VOD_EXTENSIONS = /\.(mp4|mkv|avi|mov|m4v|wmv|flv)(\?.*)?$/i;
const SERIES_EPISODE_PATTERN = /^(.*?)[.\s_-]+[Ss](\d{1,2})[.\s_-]*[Ee](\d{1,3})\b/;

function fnv1aHash(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}

function parseAttributes(raw: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const regex = /([a-zA-Z0-9_-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s,]+))/g;
  let match: RegExpExecArray | null = regex.exec(raw);
  while (match !== null) {
    const key = match[1]?.toLowerCase();
    const val = match[2] ?? match[3] ?? match[4] ?? '';
    if (key) {
      attrs[key] = val.trim();
    }
    match = regex.exec(raw);
  }
  return attrs;
}

function splitExtInf(line: string): { attrPart: string; title: string } {
  // Encontra a vírgula que separa os atributos do título, ignorando vírgulas dentro de aspas
  let inDoubleQuotes = false;
  let inSingleQuotes = false;
  let splitIndex = -1;

  for (let i = 0; i < line.length; i++) {
    const ch = line.charAt(i);
    if (ch === '"' && !inSingleQuotes) {
      inDoubleQuotes = !inDoubleQuotes;
    } else if (ch === "'" && !inDoubleQuotes) {
      inSingleQuotes = !inSingleQuotes;
    } else if (ch === ',' && !inDoubleQuotes && !inSingleQuotes) {
      splitIndex = i;
      break;
    }
  }

  if (splitIndex === -1) {
    return { attrPart: line, title: '' };
  }

  return {
    attrPart: line.slice(0, splitIndex),
    title: line.slice(splitIndex + 1).trim(),
  };
}

function classifyStream(url: string, title: string): ContentKind {
  const lowerUrl = url.toLowerCase();
  if (lowerUrl.indexOf('/series/') !== -1 || SERIES_EPISODE_PATTERN.test(title)) {
    return 'series';
  }
  if (lowerUrl.indexOf('/movie/') !== -1 || VOD_EXTENSIONS.test(lowerUrl)) {
    return 'vod';
  }
  return 'live';
}

function isValidStreamUrl(line: string): boolean {
  const lower = line.toLowerCase();
  return (
    lower.indexOf('http://') === 0 ||
    lower.indexOf('https://') === 0 ||
    lower.indexOf('rtsp://') === 0 ||
    lower.indexOf('rtmp://') === 0 ||
    lower.indexOf('udp://') === 0 ||
    lower.indexOf('rtp://') === 0
  );
}

interface PendingMeta {
  title: string;
  attrs: Record<string, string>;
  extGrp?: string;
}

export function parseM3u(rawContent: string, sourceId: string): M3uParseResult {
  const content = rawContent.charCodeAt(0) === 0xfeff ? rawContent.slice(1) : rawContent;
  const lines = content.split(/\r\n|\n|\r/);

  const categoryMap = new Map<string, Category>();
  let categoryOrder = 0;

  const ensureCategory = (kind: ContentKind, groupName: string): string => {
    const cleanName = groupName.trim() || DEFAULT_GROUP;
    const catId = `${sourceId}:${kind}:${fnv1aHash(cleanName.toLowerCase())}`;
    if (!categoryMap.has(catId)) {
      categoryMap.set(catId, {
        id: catId,
        sourceId,
        kind,
        name: cleanName,
        order: categoryOrder++,
      });
    }
    return catId;
  };

  const channels: Channel[] = [];
  const vodItems: VodItem[] = [];
  const seriesBuilders = new Map<
    string,
    {
      series: Series;
      seasonsMap: Map<number, Map<string, Episode>>;
    }
  >();

  let detectedEpgUrl: string | undefined;
  let pending: PendingMeta | null = null;
  let skippedLines = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = (lines[i] ?? '').trim();
    if (!line) continue;

    if (line.indexOf('#EXTM3U') === 0) {
      const headerAttrs = parseAttributes(line.slice(7));
      const epg = headerAttrs['url-tvg'] || headerAttrs['x-tvg-url'];
      if (epg) {
        detectedEpgUrl = epg;
      }
      continue;
    }

    if (line.indexOf('#EXTINF:') === 0) {
      const body = line.slice(8);
      const { attrPart, title } = splitExtInf(body);
      const attrs = parseAttributes(attrPart);
      pending = {
        title: title || attrs['tvg-name'] || 'Sem Nome',
        attrs,
      };
      continue;
    }

    if (line.indexOf('#EXTGRP:') === 0) {
      if (pending) {
        pending.extGrp = line.slice(8).trim();
      }
      continue;
    }

    if (line.charAt(0) === '#') {
      // Outras diretivas (#EXTVLCOPT, #KODIPROP, comentários) são ignoradas sem erro
      continue;
    }

    if (!isValidStreamUrl(line)) {
      skippedLines++;
      pending = null;
      continue;
    }

    const meta = pending;
    pending = null;

    const title = meta?.title || meta?.attrs['tvg-name'] || 'Canal sem título';
    const attrs = meta?.attrs ?? {};
    const groupTitle = attrs['group-title'] || meta?.extGrp || DEFAULT_GROUP;
    const logoUrl = attrs['tvg-logo'] || undefined;
    const epgChannelId = attrs['tvg-id'] || attrs['channel-id'] || undefined;
    const chNoRaw = attrs['tvg-chno'];
    const chNo = chNoRaw ? Number.parseInt(chNoRaw, 10) : undefined;
    const isAdult =
      attrs['adult'] === '1' ||
      attrs['adult'] === 'true' ||
      groupTitle.toLowerCase().indexOf('adult') !== -1;

    const kind = classifyStream(line, title);
    const categoryId = ensureCategory(kind, groupTitle);
    const itemHash = fnv1aHash(`${line}|${title}`);

    if (kind === 'live') {
      channels.push({
        id: `${sourceId}:live:${itemHash}`,
        sourceId,
        categoryId,
        number: Number.isFinite(chNo) ? chNo : undefined,
        name: title,
        nameLower: title.toLowerCase(),
        logoUrl,
        streamUrl: line,
        epgChannelId,
        isAdult: isAdult || undefined,
      });
    } else if (kind === 'vod') {
      vodItems.push({
        id: `${sourceId}:vod:${itemHash}`,
        sourceId,
        categoryId,
        title,
        titleLower: title.toLowerCase(),
        posterUrl: logoUrl,
        streamUrl: line,
      });
    } else {
      const epMatch = SERIES_EPISODE_PATTERN.exec(title);
      const seriesTitle = (epMatch?.[1] ?? title).trim() || title;
      const seasonNum = epMatch?.[2] ? Number.parseInt(epMatch[2], 10) : 1;
      const episodeNum = epMatch?.[3] ? Number.parseInt(epMatch[3], 10) : 1;
      const seriesId = `${sourceId}:series:${fnv1aHash(seriesTitle.toLowerCase())}`;

      let builder = seriesBuilders.get(seriesId);
      if (!builder) {
        builder = {
          series: {
            id: seriesId,
            sourceId,
            categoryId,
            title: seriesTitle,
            titleLower: seriesTitle.toLowerCase(),
            posterUrl: logoUrl,
            seasons: [],
          },
          seasonsMap: new Map(),
        };
        seriesBuilders.set(seriesId, builder);
      }

      let epMap = builder.seasonsMap.get(seasonNum);
      if (!epMap) {
        epMap = new Map();
        builder.seasonsMap.set(seasonNum, epMap);
      }

      const epId = `${seriesId}:s${seasonNum}e${episodeNum}:${itemHash}`;
      epMap.set(epId, {
        id: epId,
        seriesId,
        seasonNumber: seasonNum,
        episodeNumber: episodeNum,
        title,
        streamUrl: line,
      });
    }
  }

  const series: Series[] = [];
  seriesBuilders.forEach((builder) => {
    const seasons: Season[] = [];
    const sortedSeasonNums = Array.from(builder.seasonsMap.keys()).sort((a, b) => a - b);
    for (let sIdx = 0; sIdx < sortedSeasonNums.length; sIdx++) {
      const sNum = sortedSeasonNums[sIdx];
      if (sNum === undefined) continue;
      const epMap = builder.seasonsMap.get(sNum);
      if (!epMap) continue;
      const episodes = Array.from(epMap.values()).sort((a, b) => a.episodeNumber - b.episodeNumber);
      seasons.push({
        seasonNumber: sNum,
        name: `Temporada ${sNum}`,
        episodes,
      });
    }
    builder.series.seasons = seasons;
    series.push(builder.series);
  });

  return {
    categories: Array.from(categoryMap.values()),
    channels,
    vodItems,
    series,
    detectedEpgUrl,
    skippedLines,
  };
}
