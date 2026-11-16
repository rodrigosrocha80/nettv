import { DataLayerError } from '../../domain/types';
import { sanitizeUrl, validateSourceUrl } from '../../domain/security';

export interface HttpRequestOptions {
  timeoutMs?: number;
  signal?: AbortSignal;
  headers?: Record<string, string>;
}

export interface HttpResponse<T> {
  data: T;
  status: number;
  isHttp: boolean;
  contentType: string | null;
}

const DEFAULT_TIMEOUT_MS = 20000;

export function decodeTextBuffer(buffer: ArrayBuffer, contentType?: string | null): string {
  const charsetMatch = contentType?.match(/charset=([^;\s]+)/i);
  const declaredCharset = charsetMatch?.[1]?.trim().toLowerCase();

  if (declaredCharset && declaredCharset !== 'utf-8' && declaredCharset !== 'utf8') {
    try {
      return new TextDecoder(declaredCharset).decode(buffer);
    } catch {
      // Fallback para UTF-8 se o label não for suportado
    }
  }

  const utf8Text = new TextDecoder('utf-8').decode(buffer);
  // Se houver caractere de substituição UTF-8 (), tenta Windows-1252 (comum em listas M3U antigas)
  if (utf8Text.indexOf('\uFFFD') !== -1) {
    try {
      return new TextDecoder('windows-1252').decode(buffer);
    } catch {
      return utf8Text;
    }
  }
  return utf8Text;
}

function combineSignals(
  externalSignal: AbortSignal | undefined,
  timeoutMs: number,
): { signal: AbortSignal; cleanup: () => void; isTimeout: () => boolean } {
  const controller = new AbortController();
  let timedOut = false;

  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  const onExternalAbort = () => {
    controller.abort();
  };

  if (externalSignal) {
    if (externalSignal.aborted) {
      controller.abort();
    } else {
      externalSignal.addEventListener('abort', onExternalAbort, { once: true });
    }
  }

  return {
    signal: controller.signal,
    isTimeout: () => timedOut,
    cleanup: () => {
      clearTimeout(timer);
      if (externalSignal) {
        externalSignal.removeEventListener('abort', onExternalAbort);
      }
    },
  };
}

async function fetchRaw(
  rawUrl: string,
  options?: HttpRequestOptions,
): Promise<{ response: Response; isHttp: boolean; safeUrl: string }> {
  const validation = validateSourceUrl(rawUrl);
  if (!validation.valid) {
    throw new DataLayerError('INVALID_URL', 'URL da fonte inválida. Use http:// ou https://.');
  }

  const safeUrl = sanitizeUrl(validation.normalizedUrl);
  const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const { signal, cleanup, isTimeout } = combineSignals(options?.signal, timeoutMs);

  try {
    const response = await fetch(validation.normalizedUrl, {
      method: 'GET',
      headers: options?.headers,
      signal,
    });

    if (response.status === 401 || response.status === 403) {
      throw new DataLayerError(
        'AUTH_ERROR',
        `Acesso negado (${response.status}) ao consultar ${safeUrl}. Verifique usuário e senha.`,
        { status: response.status, isInsecureHttp: validation.isHttp },
      );
    }

    if (!response.ok) {
      throw new DataLayerError(
        'HTTP_ERROR',
        `Erro HTTP ${response.status} ao acessar ${safeUrl}.`,
        { status: response.status, isInsecureHttp: validation.isHttp },
      );
    }

    return { response, isHttp: validation.isHttp, safeUrl };
  } catch (err) {
    if (err instanceof DataLayerError) {
      throw err;
    }

    if (isTimeout()) {
      throw new DataLayerError(
        'TIMEOUT_ERROR',
        `Tempo limite excedido (${timeoutMs}ms) ao conectar em ${safeUrl}.`,
        { isInsecureHttp: validation.isHttp, cause: err },
      );
    }

    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new DataLayerError('NETWORK_ERROR', `Requisição cancelada para ${safeUrl}.`, {
        isInsecureHttp: validation.isHttp,
        cause: err,
      });
    }

    const isBrowserEnv =
      typeof window !== 'undefined' &&
      typeof navigator !== 'undefined' &&
      !navigator.userAgent.toLowerCase().includes('tizen');

    throw new DataLayerError(
      isBrowserEnv ? 'CORS_OR_NETWORK_ERROR' : 'NETWORK_ERROR',
      isBrowserEnv
        ? `Falha de rede ou CORS ao acessar ${safeUrl}. No navegador, o servidor precisa liberar CORS; na TV Tizen, verifique a conexão.`
        : `Falha de rede ou DNS ao acessar ${safeUrl}. Verifique a conexão com a internet.`,
      { isInsecureHttp: validation.isHttp, cause: err },
    );
  } finally {
    cleanup();
  }
}

export async function fetchText(
  url: string,
  options?: HttpRequestOptions,
): Promise<HttpResponse<string>> {
  const { response, isHttp } = await fetchRaw(url, options);
  const contentType = response.headers.get('content-type');
  const buffer = await response.arrayBuffer();
  const text = decodeTextBuffer(buffer, contentType);
  return {
    data: text,
    status: response.status,
    isHttp,
    contentType,
  };
}

export async function fetchJson<T>(
  url: string,
  options?: HttpRequestOptions,
): Promise<HttpResponse<T>> {
  const { response, isHttp, safeUrl } = await fetchRaw(url, options);
  const contentType = response.headers.get('content-type');
  const buffer = await response.arrayBuffer();
  const text = decodeTextBuffer(buffer, contentType);

  try {
    const parsed = JSON.parse(text) as T;
    return {
      data: parsed,
      status: response.status,
      isHttp,
      contentType,
    };
  } catch (err) {
    throw new DataLayerError('PARSE_ERROR', `Resposta JSON inválida recebida de ${safeUrl}.`, {
      status: response.status,
      isInsecureHttp: isHttp,
      cause: err,
    });
  }
}
