import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { sanitizeUrl } from '../../domain/security';
import { useCatalogStore } from '../../domain/stores/catalogStore';
import { useProfileStore } from '../../domain/stores/profileStore';
import { useSourceStore } from '../../domain/stores/sourceStore';
import { Button } from '../components/Button';
import { EmptyState } from '../components/EmptyState';
import { TvTextField } from '../components/TvTextField';

export interface ProfilesScreenProps {
  onAddSource: () => void;
  onNotify: (msg: string) => void;
}

export function ProfilesScreen({ onAddSource, onNotify }: ProfilesScreenProps) {
  const { t } = useTranslation();
  const profiles = useProfileStore((s) => s.profiles);
  const activeProfileId = useProfileStore((s) => s.activeProfileId);
  const selectProfile = useProfileStore((s) => s.selectProfile);
  const createProfile = useProfileStore((s) => s.createProfile);
  const removeProfile = useProfileStore((s) => s.removeProfile);

  const sources = useSourceStore((s) => s.sources);
  const activeSourceId = useSourceStore((s) => s.activeSourceId);
  const selectSource = useSourceStore((s) => s.selectSource);
  const refreshSource = useSourceStore((s) => s.refreshSource);
  const removeSource = useSourceStore((s) => s.removeSource);
  const loadCatalogForSource = useCatalogStore((s) => s.loadCatalogForSource);

  const [newProfileName, setNewProfileName] = useState('');

  const handleCreateProfile = async () => {
    const trimmed = newProfileName.trim();
    if (!trimmed) return;
    await createProfile({ name: trimmed, avatarId: 'default' });
    setNewProfileName('');
    onNotify(t('profiles.createdToast'));
  };

  return (
    <section className="ntv-screen">
      <div className="ntv-screen-header">
        <div>
          <h1 className="ntv-screen-title">{t('profiles.title')}</h1>
          <p className="ntv-screen-subtitle">{t('profiles.subtitle')}</p>
        </div>
      </div>

      <div className="ntv-card-panel">
        <h2>{t('profiles.profilesSection')}</h2>
        <div className="ntv-row-actions">
          {profiles.map((p, idx) => (
            <div key={p.id} className="ntv-row-actions">
              <Button
                variant={p.id === activeProfileId ? 'primary' : 'secondary'}
                focusKey={`PROFILE_SELECT_${p.id}`}
                autoFocus={idx === 0}
                onPress={() => void selectProfile(p.id)}
              >
                {p.name} {p.pinHash ? '🔒' : ''}
              </Button>
              {profiles.length > 1 ? (
                <Button
                  variant="ghost"
                  focusKey={`PROFILE_DEL_${p.id}`}
                  onPress={() => void removeProfile(p.id)}
                >
                  {t('common.delete')}
                </Button>
              ) : null}
            </div>
          ))}
        </div>

        <div className="ntv-row-actions">
          <TvTextField
            label={t('profiles.newProfileName')}
            value={newProfileName}
            onChange={setNewProfileName}
            placeholder={t('profiles.newProfilePlaceholder')}
            focusKey="PROFILE_NEW_NAME"
          />
          <Button focusKey="PROFILE_CREATE_BTN" onPress={() => void handleCreateProfile()}>
            {t('profiles.createButton')}
          </Button>
        </div>
      </div>

      <div className="ntv-card-panel">
        <div className="ntv-screen-header">
          <h2>{t('profiles.sourcesSection')}</h2>
          <Button focusKey="SOURCE_ADD_BTN" onPress={onAddSource}>
            {t('profiles.addSource')}
          </Button>
        </div>

        {sources.length === 0 ? (
          <EmptyState title={t('common.emptyTitle')} description={t('showcase.emptyDescription')} />
        ) : (
          sources.map((src) => (
            <div key={src.id} className="ntv-row-actions">
              <Button
                variant={src.id === activeSourceId ? 'primary' : 'secondary'}
                focusKey={`SOURCE_SELECT_${src.id}`}
                onPress={() => {
                  selectSource(src.id);
                  void loadCatalogForSource(src.id);
                }}
              >
                {src.name} ({src.type.toUpperCase()})
              </Button>
              <span style={{ color: 'var(--color-text-muted)', fontSize: '18px' }}>
                {sanitizeUrl(src.url)}
              </span>
              <Button
                variant="ghost"
                focusKey={`SOURCE_REFRESH_${src.id}`}
                onPress={() => {
                  void refreshSource(src.id, { forceRefresh: true, syncEpg: true }).then(() => {
                    void loadCatalogForSource(src.id);
                    onNotify(t('profiles.sourceUpdated'));
                  });
                }}
              >
                {t('profiles.refreshNow')}
              </Button>
              <Button
                variant="danger"
                focusKey={`SOURCE_DEL_${src.id}`}
                onPress={() => void removeSource(src.id)}
              >
                {t('common.delete')}
              </Button>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
