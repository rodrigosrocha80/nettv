import type { StreamFormat } from './types';

export function detectStreamFormat(url: string): StreamFormat {
  const cleanUrl = url.split('?')[0]?.split('#')[0]?.toLowerCase() ?? '';

  if (cleanUrl.endsWith('.m3u8') || cleanUrl.indexOf('/hls/') !== -1) {
    return 'hls';
  }
  if (cleanUrl.endsWith('.mpd')) {
    return 'dash';
  }
  if (
    cleanUrl.endsWith('.ts') ||
    cleanUrl.endsWith('.tp') ||
    cleanUrl.endsWith('.trp') ||
    cleanUrl.indexOf('/live/') !== -1
  ) {
    // Observação: URLs Xtream live sem extensão explícita costumam ser MPEG-TS ou HLS;
    // se terminar em .m3u8 já foi capturado acima.
    return 'mpegts';
  }
  return 'progressive';
}
