import { parseXmltv, type XmltvParseResult } from '../parsers/xmltvParser';

interface XmltvWorkerRequest {
  id: string;
  rawXml: string;
  sourceId: string;
  windowStartMs?: number;
  windowEndMs?: number;
  allowedChannelIds?: string[];
}

interface XmltvWorkerResponse {
  id: string;
  result?: XmltvParseResult;
  error?: string;
}

const ctx = self as unknown as {
  onmessage: ((ev: MessageEvent<XmltvWorkerRequest>) => void) | null;
  postMessage: (msg: XmltvWorkerResponse) => void;
};

ctx.onmessage = (event: MessageEvent<XmltvWorkerRequest>) => {
  const { id, rawXml, sourceId, windowStartMs, windowEndMs, allowedChannelIds } = event.data;
  try {
    const allowedSet =
      allowedChannelIds && allowedChannelIds.length > 0 ? new Set(allowedChannelIds) : undefined;
    const result = parseXmltv(rawXml, {
      sourceId,
      windowStartMs,
      windowEndMs,
      allowedChannelIds: allowedSet,
    });
    ctx.postMessage({ id, result });
  } catch (err) {
    ctx.postMessage({
      id,
      error: err instanceof Error ? err.message : 'Erro desconhecido no parser XMLTV',
    });
  }
};
