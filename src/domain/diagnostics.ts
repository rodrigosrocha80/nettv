import { sanitizeUrl } from '../domain/security';

export interface DiagnosticEvent {
  id: string;
  timestamp: number;
  level: 'info' | 'warn' | 'error';
  scope: 'data' | 'player' | 'platform' | 'ui';
  message: string;
  detail?: string;
}

const MAX_EVENTS = 100;
const events: DiagnosticEvent[] = [];

export function logDiagnostic(
  level: DiagnosticEvent['level'],
  scope: DiagnosticEvent['scope'],
  message: string,
  rawDetail?: string,
): void {
  const safeDetail = rawDetail ? sanitizeUrl(rawDetail) : undefined;
  events.unshift({
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    timestamp: Date.now(),
    level,
    scope,
    message: sanitizeUrl(message),
    detail: safeDetail,
  });

  if (events.length > MAX_EVENTS) {
    events.length = MAX_EVENTS;
  }
}

export function getDiagnosticEvents(): DiagnosticEvent[] {
  return [...events];
}

export function clearDiagnosticEvents(): void {
  events.length = 0;
}
