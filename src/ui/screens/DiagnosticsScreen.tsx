import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { clearDiagnosticEvents, getDiagnosticEvents } from '../../domain/diagnostics';
import { sanitizeUrl } from '../../domain/security';
import { useSourceStore } from '../../domain/stores/sourceStore';
import { Button } from '../components/Button';
import { usePlatform } from '../focus/PlatformContext';

export interface DiagnosticsScreenProps {
  onBack: () => void;
}

export function DiagnosticsScreen({ onBack }: DiagnosticsScreenProps) {
  const { t } = useTranslation();
  const platform = usePlatform();
  const sources = useSourceStore((s) => s.sources);
  const activeSourceId = useSourceStore((s) => s.activeSourceId);
  const syncStatus = useSourceStore((s) => s.syncStatus);
  const lastMetrics = useSourceStore((s) => s.lastMetrics);

  const device = useMemo(() => platform?.getDeviceInfo(), [platform]);
  const activeSource = sources.find((s) => s.id === activeSourceId);
  const events = getDiagnosticEvents();

  return (
    <section className="ntv-screen">
      <div className="ntv-screen-header">
        <h1 className="ntv-screen-title">{t('diagnostics.title')}</h1>
        <Button variant="secondary" focusKey="DIAG_BACK" autoFocus onPress={onBack}>
          {t('common.back')}
        </Button>
      </div>

      <div className="ntv-settings-grid">
        <div className="ntv-card-panel">
          <h2>{t('diagnostics.deviceSection')}</h2>
          <div>
            <strong>{t('diagnostics.appVersion')}:</strong>{' '}
            {typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '0.1.0'}
          </div>
          <div>
            <strong>{t('diagnostics.platform')}:</strong> {device?.platform ?? 'browser'}
          </div>
          <div>
            <strong>{t('diagnostics.model')}:</strong> {device?.modelName ?? '-'}
          </div>
          <div>
            <strong>{t('diagnostics.osVersion')}:</strong> {device?.osVersion ?? '-'}
          </div>
        </div>

        <div className="ntv-card-panel">
          <h2>{t('diagnostics.sourceSection')}</h2>
          <div>
            <strong>{t('diagnostics.syncStatus')}:</strong> {syncStatus}
          </div>
          {activeSource ? (
            <>
              <div>
                <strong>{t('onboarding.sourceName')}:</strong> {activeSource.name}
              </div>
              <div>
                <strong>URL:</strong> {sanitizeUrl(activeSource.url)}
              </div>
              {activeSource.accountInfo?.expDate ? (
                <div>
                  <strong>{t('diagnostics.expiration')}:</strong>{' '}
                  {new Date(activeSource.accountInfo.expDate).toLocaleDateString()}
                </div>
              ) : null}
              {lastMetrics ? (
                <div>
                  <strong>{t('diagnostics.lastLoad')}:</strong> {lastMetrics.channelsCount} ch /{' '}
                  {lastMetrics.vodCount} VOD ({lastMetrics.durationMs}ms)
                </div>
              ) : null}
            </>
          ) : (
            <div>{t('common.emptyTitle')}</div>
          )}
        </div>
      </div>

      <div className="ntv-card-panel">
        <div className="ntv-screen-header">
          <h2>{t('diagnostics.logsSection')}</h2>
          <Button variant="ghost" focusKey="DIAG_CLEAR_LOGS" onPress={clearDiagnosticEvents}>
            {t('diagnostics.clearLogs')}
          </Button>
        </div>

        <div className="ntv-diag-list">
          {events.length === 0 ? (
            <div>{t('diagnostics.noEvents')}</div>
          ) : (
            events.map((ev) => (
              <div
                key={ev.id}
                className={`ntv-diag-item ${ev.level === 'error' ? 'ntv-diag-item--error' : ''}`.trim()}
              >
                <div>
                  [{new Date(ev.timestamp).toLocaleTimeString()}] [{ev.scope}] {ev.message}
                </div>
                {ev.detail ? <div style={{ opacity: 0.75 }}>{ev.detail}</div> : null}
              </div>
            ))
          )}
        </div>
      </div>
    </section>
  );
}
