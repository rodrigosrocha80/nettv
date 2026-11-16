import type { EpgProgram } from '../../domain/types';

export interface XmltvParseOptions {
  sourceId: string;
  windowStartMs?: number;
  windowEndMs?: number;
  allowedChannelIds?: Set<string>;
}

export interface XmltvParseResult {
  programs: EpgProgram[];
  totalScanned: number;
  filteredOut: number;
}

const DEFAULT_WINDOW_DAYS = 2;
const TWO_HOURS_MS = 2 * 60 * 60 * 1000;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

function decodeXmlEntities(raw: string): string {
  if (raw.indexOf('&') === -1) return raw;
  return raw
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_m, dec: string) => {
      const code = Number.parseInt(dec, 10);
      return Number.isFinite(code) ? String.fromCharCode(code) : '';
    })
    .replace(/&#x([0-9a-fA-F]+);/g, (_m, hex: string) => {
      const code = Number.parseInt(hex, 16);
      return Number.isFinite(code) ? String.fromCharCode(code) : '';
    });
}

/**
 * Converte timestamp XMLTV (ex.: "20261116120000 -0300" ou "20261116120000") para epoch ms.
 */
export function parseXmltvTimestamp(raw: string): number | null {
  const trimmed = raw.trim();
  const match = /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})(?:\s*([+-])(\d{2})(\d{2}))?/.exec(
    trimmed,
  );
  if (!match) return null;

  const year = Number.parseInt(match[1] ?? '0', 10);
  const month = Number.parseInt(match[2] ?? '1', 10) - 1;
  const day = Number.parseInt(match[3] ?? '1', 10);
  const hour = Number.parseInt(match[4] ?? '0', 10);
  const minute = Number.parseInt(match[5] ?? '0', 10);
  const second = Number.parseInt(match[6] ?? '0', 10);

  let utcMs = Date.UTC(year, month, day, hour, minute, second);

  const sign = match[7];
  if (sign) {
    const offH = Number.parseInt(match[8] ?? '0', 10);
    const offM = Number.parseInt(match[9] ?? '0', 10);
    const offsetMs = (offH * 60 + offM) * 60 * 1000;
    // Se o horário local tem offset +0300, UTC = local - 3h. Se -0300, UTC = local + 3h.
    utcMs = sign === '+' ? utcMs - offsetMs : utcMs + offsetMs;
  }

  return Number.isFinite(utcMs) ? utcMs : null;
}

function extractAttr(attrString: string, name: string): string {
  const regex = new RegExp(`${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, 'i');
  const match = regex.exec(attrString);
  return decodeXmlEntities((match?.[1] ?? match?.[2] ?? '').trim());
}

function extractTagContent(block: string, tagName: string): string | undefined {
  const openRegex = new RegExp(`<${tagName}(?:\\s[^>]*)?>`, 'i');
  const openMatch = openRegex.exec(block);
  if (!openMatch) return undefined;

  const contentStart = openMatch.index + openMatch[0].length;
  const closeTag = `</${tagName}>`;
  const closeIdx = block.toLowerCase().indexOf(closeTag, contentStart);
  if (closeIdx === -1) return undefined;

  let inner = block.slice(contentStart, closeIdx).trim();
  if (inner.indexOf('<![CDATA[') === 0 && inner.slice(-3) === ']]>') {
    inner = inner.slice(9, -3);
  }
  const decoded = decodeXmlEntities(inner).trim();
  return decoded || undefined;
}

export function parseXmltv(rawXml: string, options: XmltvParseOptions): XmltvParseResult {
  const now = Date.now();
  const windowStartMs = options.windowStartMs ?? now - TWO_HOURS_MS;
  const windowEndMs = options.windowEndMs ?? now + DEFAULT_WINDOW_DAYS * ONE_DAY_MS;
  const allowed = options.allowedChannelIds;

  const programs: EpgProgram[] = [];
  let totalScanned = 0;
  let filteredOut = 0;

  const lowerXml = rawXml.toLowerCase();
  let cursor = 0;

  while (cursor < rawXml.length) {
    const startIdx = lowerXml.indexOf('<programme', cursor);
    if (startIdx === -1) break;

    const tagCloseIdx = rawXml.indexOf('>', startIdx);
    if (tagCloseIdx === -1) break;

    const endTagIdx = lowerXml.indexOf('</programme>', tagCloseIdx);
    if (endTagIdx === -1) {
      cursor = tagCloseIdx + 1;
      continue;
    }

    totalScanned++;
    const attrString = rawXml.slice(startIdx + 10, tagCloseIdx);
    const body = rawXml.slice(tagCloseIdx + 1, endTagIdx);
    cursor = endTagIdx + 12;

    const channelEpgId = extractAttr(attrString, 'channel');
    if (!channelEpgId) {
      filteredOut++;
      continue;
    }

    if (allowed && allowed.size > 0 && !allowed.has(channelEpgId)) {
      filteredOut++;
      continue;
    }

    const startRaw = extractAttr(attrString, 'start');
    const stopRaw = extractAttr(attrString, 'stop');
    const startMs = parseXmltvTimestamp(startRaw);
    const endMs = stopRaw ? parseXmltvTimestamp(stopRaw) : startMs ? startMs + 3600000 : null;

    if (startMs === null || endMs === null || endMs <= startMs) {
      filteredOut++;
      continue;
    }

    // Descarta programas fora da janela configurável
    if (endMs < windowStartMs || startMs > windowEndMs) {
      filteredOut++;
      continue;
    }

    const title = extractTagContent(body, 'title') ?? 'Sem título';
    const description = extractTagContent(body, 'desc');

    programs.push({
      id: `${options.sourceId}:${channelEpgId}:${startMs}`,
      sourceId: options.sourceId,
      channelEpgId,
      title,
      description,
      startMs,
      endMs,
    });
  }

  return { programs, totalScanned, filteredOut };
}
