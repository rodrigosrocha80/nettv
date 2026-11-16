import { parseM3u, type M3uParseResult } from '../parsers/m3uParser';
import { parseXmltv, type XmltvParseOptions, type XmltvParseResult } from '../parsers/xmltvParser';
import { DataLayerError } from '../../domain/types';

function createRequestId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function parseM3uInWorker(
  rawContent: string,
  sourceId: string,
): Promise<M3uParseResult> {
  if (typeof Worker === 'undefined') {
    return parseM3u(rawContent, sourceId);
  }

  return new Promise<M3uParseResult>((resolve, reject) => {
    let worker: Worker;
    try {
      worker = new Worker(new URL('./m3u.worker.ts', import.meta.url), { type: 'module' });
    } catch {
      // Fallback caso o ambiente não suporte module worker (ex.: file:// legado)
      resolve(parseM3u(rawContent, sourceId));
      return;
    }

    const requestId = createRequestId();

    const cleanup = () => {
      worker.terminate();
    };

    worker.onmessage = (
      ev: MessageEvent<{ id: string; result?: M3uParseResult; error?: string }>,
    ) => {
      if (ev.data.id !== requestId) return;
      cleanup();
      if (ev.data.error || !ev.data.result) {
        reject(new DataLayerError('PARSE_ERROR', ev.data.error ?? 'Falha ao processar M3U.'));
      } else {
        resolve(ev.data.result);
      }
    };

    worker.onerror = () => {
      cleanup();
      // Fallback seguro na thread principal se o worker falhar ao carregar
      try {
        resolve(parseM3u(rawContent, sourceId));
      } catch (err) {
        reject(
          new DataLayerError(
            'PARSE_ERROR',
            err instanceof Error ? err.message : 'Falha ao processar M3U.',
          ),
        );
      }
    };

    worker.postMessage({ id: requestId, rawContent, sourceId });
  });
}

export async function parseXmltvInWorker(
  rawXml: string,
  options: XmltvParseOptions,
): Promise<XmltvParseResult> {
  if (typeof Worker === 'undefined') {
    return parseXmltv(rawXml, options);
  }

  return new Promise<XmltvParseResult>((resolve, reject) => {
    let worker: Worker;
    try {
      worker = new Worker(new URL('./xmltv.worker.ts', import.meta.url), { type: 'module' });
    } catch {
      resolve(parseXmltv(rawXml, options));
      return;
    }

    const requestId = createRequestId();

    const cleanup = () => {
      worker.terminate();
    };

    worker.onmessage = (
      ev: MessageEvent<{ id: string; result?: XmltvParseResult; error?: string }>,
    ) => {
      if (ev.data.id !== requestId) return;
      cleanup();
      if (ev.data.error || !ev.data.result) {
        reject(new DataLayerError('PARSE_ERROR', ev.data.error ?? 'Falha ao processar XMLTV.'));
      } else {
        resolve(ev.data.result);
      }
    };

    worker.onerror = () => {
      cleanup();
      try {
        resolve(parseXmltv(rawXml, options));
      } catch (err) {
        reject(
          new DataLayerError(
            'PARSE_ERROR',
            err instanceof Error ? err.message : 'Falha ao processar XMLTV.',
          ),
        );
      }
    };

    worker.postMessage({
      id: requestId,
      rawXml,
      sourceId: options.sourceId,
      windowStartMs: options.windowStartMs,
      windowEndMs: options.windowEndMs,
      allowedChannelIds: options.allowedChannelIds
        ? Array.from(options.allowedChannelIds)
        : undefined,
    });
  });
}
