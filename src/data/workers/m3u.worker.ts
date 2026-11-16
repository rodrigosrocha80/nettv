import { parseM3u, type M3uParseResult } from '../parsers/m3uParser';

interface M3uWorkerRequest {
  id: string;
  rawContent: string;
  sourceId: string;
}

interface M3uWorkerResponse {
  id: string;
  result?: M3uParseResult;
  error?: string;
}

const ctx = self as unknown as {
  onmessage: ((ev: MessageEvent<M3uWorkerRequest>) => void) | null;
  postMessage: (msg: M3uWorkerResponse) => void;
};

ctx.onmessage = (event: MessageEvent<M3uWorkerRequest>) => {
  const { id, rawContent, sourceId } = event.data;
  try {
    const result = parseM3u(rawContent, sourceId);
    ctx.postMessage({ id, result });
  } catch (err) {
    ctx.postMessage({
      id,
      error: err instanceof Error ? err.message : 'Erro desconhecido no parser M3U',
    });
  }
};
