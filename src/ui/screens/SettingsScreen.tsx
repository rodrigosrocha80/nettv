import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { clearAllUserData } from '../../data/db/userRepository';
import { useCatalogStore } from '../../domain/stores/catalogStore';
import { useProfileStore } from '../../domain/stores/profileStore';
import {
  useSettingsStore,
  type AppLanguage,
  type FontScale,
} from '../../domain/stores/settingsStore';
import { useSourceStore } from '../../domain/stores/sourceStore';
import type { AspectRatioMode, EngineType } from '../../player/types';
import { Button } from '../components/Button';
import { Modal } from '../components/Modal';
import { TvTextField } from '../components/TvTextField';

export interface SettingsScreenProps {
  onOpenDiagnostics: () => void;
  onNotify: (msg: string) => void;
  onDataCleared: () => void;
}

export function SettingsScreen({
  onOpenDiagnostics,
  onNotify,
  onDataCleared,
}: SettingsScreenProps) {
  const { t, i18n } = useTranslation();
  const settings = useSettingsStore();
  const activeSourceId = useSourceStore((s) => s.activeSourceId);
  const refreshSource = useSourceStore((s) => s.refreshSource);
  const loadCatalogForSource = useCatalogStore((s) => s.loadCatalogForSource);
  const profiles = useProfileStore((s) => s.profiles);
  const activeProfileId = useProfileStore((s) => s.activeProfileId);
  const setParentalPin = useProfileStore((s) => s.setParentalPin);
  const categories = useCatalogStore((s) => s.categories);
  const toggleLockedCategory = useProfileStore((s) => s.toggleLockedCategory);

  const [newPin, setNewPin] = useState('');
  const [showTerms, setShowTerms] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const activeProfile = profiles.find((p) => p.id === activeProfileId);

  const changeLanguage = (lang: AppLanguage) => {
    settings.updateSettings({ language: lang });
    void i18n.changeLanguage(lang);
  };

  const cycleEngine = () => {
    const order: Array<EngineType | 'auto'> = ['auto', 'avplay', 'html5'];
    const next = order[(order.indexOf(settings.preferredEngine) + 1) % order.length] ?? 'auto';
    settings.updateSettings({ preferredEngine: next });
  };

  const cycleAspect = () => {
    const order: AspectRatioMode[] = ['fit', '16:9', '4:3', 'zoom'];
    const next = order[(order.indexOf(settings.defaultAspectRatio) + 1) % order.length] ?? 'fit';
    settings.updateSettings({ defaultAspectRatio: next });
  };

  const cycleTtl = () => {
    const order = [360, 720, 1440];
    const next = order[(order.indexOf(settings.defaultCacheTtlMinutes) + 1) % order.length] ?? 720;
    settings.updateSettings({ defaultCacheTtlMinutes: next });
  };

  const cycleFontScale = () => {
    const order: FontScale[] = ['normal', 'large', 'xlarge'];
    const next = order[(order.indexOf(settings.fontScale) + 1) % order.length] ?? 'normal';
    settings.updateSettings({ fontScale: next });
  };

  const handleClearAll = async () => {
    await clearAllUserData();
    useProfileStore.getState().resetStore();
    useSourceStore.getState().resetStore();
    useCatalogStore.getState().clearCatalog();
    setShowClearConfirm(false);
    onNotify(t('settings.clearedToast'));
    onDataCleared();
  };

  return (
    <section className="ntv-screen">
      <div className="ntv-screen-header">
        <h1 className="ntv-screen-title">{t('nav.settings')}</h1>
        <Button variant="secondary" focusKey="SET_DIAGNOSTICS" onPress={onOpenDiagnostics}>
          {t('settings.openDiagnostics')}
        </Button>
      </div>

      <div className="ntv-settings-grid">
        <div className="ntv-card-panel">
          <h2>{t('settings.generalSection')}</h2>
          <div className="ntv-row-actions">
            {(['pt-BR', 'en', 'es'] as AppLanguage[]).map((lang, idx) => (
              <Button
                key={lang}
                variant={settings.language === lang ? 'primary' : 'secondary'}
                focusKey={`SET_LANG_${lang}`}
                autoFocus={idx === 0}
                onPress={() => changeLanguage(lang)}
              >
                {lang}
              </Button>
            ))}
          </div>

          <Button variant="secondary" focusKey="SET_ENGINE" onPress={cycleEngine}>
            {t('settings.defaultEngine')}: {settings.preferredEngine.toUpperCase()}
          </Button>
          <Button variant="secondary" focusKey="SET_ASPECT" onPress={cycleAspect}>
            {t('player.aspectRatio')}: {settings.defaultAspectRatio}
          </Button>
          <Button
            variant="secondary"
            focusKey="SET_SUBS"
            onPress={() =>
              settings.updateSettings({ subtitlesEnabled: !settings.subtitlesEnabled })
            }
          >
            {t('player.subtitles')}:{' '}
            {settings.subtitlesEnabled ? t('common.enabled') : t('common.disabled')}
          </Button>
          <Button variant="secondary" focusKey="SET_FONT_SCALE" onPress={cycleFontScale}>
            {t('settings.fontScale')}: {settings.fontScale.toUpperCase()}
          </Button>
        </div>

        <div className="ntv-card-panel">
          <h2>{t('settings.cacheSection')}</h2>
          <Button variant="secondary" focusKey="SET_TTL" onPress={cycleTtl}>
            {t('settings.cacheTtl')}: {Math.round(settings.defaultCacheTtlMinutes / 60)}h
          </Button>
          <Button
            variant="secondary"
            focusKey="SET_TELEMETRY"
            onPress={() =>
              settings.updateSettings({ telemetryEnabled: !settings.telemetryEnabled })
            }
          >
            {t('settings.telemetryOptIn')}:{' '}
            {settings.telemetryEnabled ? t('common.enabled') : t('common.disabled')}
          </Button>
          <Button
            focusKey="SET_REFRESH_NOW"
            disabled={!activeSourceId}
            onPress={() => {
              if (!activeSourceId) return;
              void refreshSource(activeSourceId, { forceRefresh: true, syncEpg: true }).then(() => {
                void loadCatalogForSource(activeSourceId);
                onNotify(t('profiles.sourceUpdated'));
              });
            }}
          >
            {t('profiles.refreshNow')}
          </Button>
          <Button variant="secondary" focusKey="SET_TERMS" onPress={() => setShowTerms(true)}>
            {t('settings.termsAndPrivacy')}
          </Button>
          <Button
            variant="danger"
            focusKey="SET_CLEAR_DATA"
            onPress={() => setShowClearConfirm(true)}
          >
            {t('settings.clearAllData')}
          </Button>
        </div>
      </div>

      {activeProfile ? (
        <div className="ntv-card-panel">
          <h2>{t('parental.title')}</h2>
          <div className="ntv-row-actions">
            <TvTextField
              label={t('parental.setPinLabel')}
              value={newPin}
              onChange={setNewPin}
              masked
              placeholder="1234"
              focusKey="SET_PARENTAL_PIN"
            />
            <Button
              focusKey="SET_SAVE_PIN"
              disabled={!newPin}
              onPress={() => {
                void setParentalPin(activeProfile.id, newPin).then(() => {
                  setNewPin('');
                  onNotify(t('parental.pinSaved'));
                });
              }}
            >
              {t('common.save')}
            </Button>
            {activeProfile.pinHash ? (
              <Button
                variant="danger"
                focusKey="SET_REMOVE_PIN"
                onPress={() => void setParentalPin(activeProfile.id, null)}
              >
                {t('parental.removePin')}
              </Button>
            ) : null}
          </div>

          {activeProfile.pinHash && categories.length > 0 ? (
            <div className="ntv-row-actions">
              {categories.slice(0, 12).map((cat) => {
                const locked = activeProfile.lockedCategoryIds.indexOf(cat.id) !== -1;
                return (
                  <Button
                    key={cat.id}
                    variant={locked ? 'danger' : 'ghost'}
                    focusKey={`SET_LOCK_CAT_${cat.id}`}
                    onPress={() => void toggleLockedCategory(activeProfile.id, cat.id)}
                  >
                    {locked ? '🔒 ' : ''}
                    {cat.name}
                  </Button>
                );
              })}
            </div>
          ) : null}
        </div>
      ) : null}

      <Modal
        isOpen={showTerms}
        title={t('settings.termsAndPrivacy')}
        focusKey="TERMS_MODAL"
        onClose={() => setShowTerms(false)}
      >
        <p className="ntv-modal-body">
          {t('app.legalNotice')} {t('settings.privacyPolicyBody')}
        </p>
        <Button focusKey="TERMS_CLOSE" autoFocus onPress={() => setShowTerms(false)}>
          {t('common.close')}
        </Button>
      </Modal>

      <Modal
        isOpen={showClearConfirm}
        title={t('settings.clearAllData')}
        focusKey="CLEAR_DATA_MODAL"
        onClose={() => setShowClearConfirm(false)}
      >
        <p className="ntv-modal-body">{t('settings.clearConfirmBody')}</p>
        <div className="ntv-row-actions">
          <Button
            variant="secondary"
            focusKey="CLEAR_CANCEL"
            autoFocus
            onPress={() => setShowClearConfirm(false)}
          >
            {t('common.cancel')}
          </Button>
          <Button variant="danger" focusKey="CLEAR_CONFIRM" onPress={() => void handleClearAll()}>
            {t('common.confirm')}
          </Button>
        </div>
      </Modal>
    </section>
  );
}
