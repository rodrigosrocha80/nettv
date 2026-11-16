import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { logDiagnostic } from '../../domain/diagnostics';
import { validateSourceUrl } from '../../domain/security';
import { useCatalogStore } from '../../domain/stores/catalogStore';
import { useProfileStore } from '../../domain/stores/profileStore';
import { useSourceStore } from '../../domain/stores/sourceStore';
import { DataLayerError, type SourceType } from '../../domain/types';
import { Button } from '../components/Button';
import { TvTextField } from '../components/TvTextField';

export interface OnboardingScreenProps {
  onComplete: () => void;
  onCancel?: () => void;
}

export function OnboardingScreen({ onComplete, onCancel }: OnboardingScreenProps) {
  const { t } = useTranslation();
  const addSource = useSourceStore((s) => s.addSource);
  const refreshSource = useSourceStore((s) => s.refreshSource);
  const removeSource = useSourceStore((s) => s.removeSource);
  const loadCatalogForSource = useCatalogStore((s) => s.loadCatalogForSource);
  const profiles = useProfileStore((s) => s.profiles);
  const createProfile = useProfileStore((s) => s.createProfile);

  const [sourceType, setSourceType] = useState<SourceType>('m3u');
  const [name, setName] = useState('Minha Lista');
  const [url, setUrl] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [epgUrl, setEpgUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const urlCheck = validateSourceUrl(url);

  const handleSubmit = async () => {
    setErrorMsg(null);
    if (!urlCheck.valid) {
      setErrorMsg(t('data.errors.INVALID_URL'));
      return;
    }

    if (sourceType === 'xtream' && (!username.trim() || !password)) {
      setErrorMsg(t('onboarding.xtreamCredentialsRequired'));
      return;
    }

    setSubmitting(true);
    let createdSourceId: string | null = null;
    try {
      if (profiles.length === 0) {
        await createProfile({ name: t('profiles.defaultName'), avatarId: 'default' });
      }

      const source = await addSource({
        name: name.trim() || 'Minha Lista',
        type: sourceType,
        url: urlCheck.normalizedUrl,
        username: sourceType === 'xtream' ? username.trim() : undefined,
        password: sourceType === 'xtream' ? password : undefined,
        epgUrl: epgUrl.trim() || undefined,
      });
      createdSourceId = source.id;

      await refreshSource(source.id, { forceRefresh: true, syncEpg: Boolean(epgUrl.trim()) });
      await loadCatalogForSource(source.id);
      logDiagnostic('info', 'data', `Fonte "${source.name}" sincronizada com sucesso.`);
      onComplete();
    } catch (err) {
      if (createdSourceId) {
        await removeSource(createdSourceId);
      }
      const code = err instanceof DataLayerError ? err.code : 'NETWORK_ERROR';
      const msg = t(`data.errors.${code}`);
      logDiagnostic('error', 'data', msg, err instanceof Error ? err.message : undefined);
      setErrorMsg(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="ntv-screen">
      <div className="ntv-screen-header">
        <div>
          <h1 className="ntv-screen-title">{t('onboarding.title')}</h1>
          <p className="ntv-screen-subtitle">{t('onboarding.subtitle')}</p>
        </div>
        {onCancel ? (
          <Button variant="secondary" focusKey="ONBOARDING_CANCEL" onPress={onCancel}>
            {t('common.back')}
          </Button>
        ) : null}
      </div>

      <div className="ntv-legal-banner">{t('app.legalNotice')}</div>

      <div className="ntv-card-panel">
        <div className="ntv-row-actions">
          <Button
            variant={sourceType === 'm3u' ? 'primary' : 'secondary'}
            focusKey="ONBOARDING_TYPE_M3U"
            autoFocus
            onPress={() => setSourceType('m3u')}
          >
            {t('onboarding.typeM3u')}
          </Button>
          <Button
            variant={sourceType === 'xtream' ? 'primary' : 'secondary'}
            focusKey="ONBOARDING_TYPE_XTREAM"
            onPress={() => setSourceType('xtream')}
          >
            {t('onboarding.typeXtream')}
          </Button>
        </div>

        <TvTextField
          label={t('onboarding.sourceName')}
          value={name}
          onChange={setName}
          placeholder="Minha Lista"
          focusKey="ONBOARDING_NAME"
        />

        <TvTextField
          label={sourceType === 'm3u' ? t('onboarding.m3uUrl') : t('onboarding.xtreamUrl')}
          value={url}
          onChange={setUrl}
          placeholder="https://..."
          focusKey="ONBOARDING_URL"
        />

        {urlCheck.valid && urlCheck.isHttp ? (
          <div className="ntv-warning-banner">{t('data.httpWarning')}</div>
        ) : null}

        {sourceType === 'xtream' ? (
          <>
            <TvTextField
              label={t('onboarding.username')}
              value={username}
              onChange={setUsername}
              focusKey="ONBOARDING_USER"
            />
            <TvTextField
              label={t('onboarding.password')}
              value={password}
              onChange={setPassword}
              masked
              focusKey="ONBOARDING_PASS"
            />
          </>
        ) : (
          <TvTextField
            label={t('onboarding.epgUrlOptional')}
            value={epgUrl}
            onChange={setEpgUrl}
            placeholder="https://.../epg.xml"
            focusKey="ONBOARDING_EPG"
          />
        )}

        {errorMsg ? (
          <p className="ntv-form-error" role="alert">
            {errorMsg}
          </p>
        ) : null}

        <div className="ntv-row-actions">
          <Button
            focusKey="ONBOARDING_SUBMIT"
            disabled={submitting}
            onPress={() => void handleSubmit()}
          >
            {submitting ? t('data.syncing') : t('onboarding.connectAndSync')}
          </Button>
        </div>
      </div>
    </section>
  );
}
