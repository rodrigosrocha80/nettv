import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { changeAppLanguage, type SupportedLanguage } from '../../i18n';
import {
  Button,
  Carousel,
  EmptyState,
  ErrorState,
  MediaCard,
  MediaGrid,
  Modal,
  Skeleton,
  Toast,
  VirtualKeyboard,
} from '../components';

const SAMPLE_CHANNELS = [
  { id: 'c1', title: 'Stream Demo 01', subtitle: 'HLS 1080p', badge: 'LIVE', progress: 0 },
  { id: 'c2', title: 'Stream Demo 02', subtitle: 'DASH 4K', badge: '4K', progress: 0 },
  { id: 'c3', title: 'Documentário Livre', subtitle: 'VOD • 45 min', badge: 'HD', progress: 62 },
  { id: 'c4', title: 'Série Demo S01E01', subtitle: 'VOD • 28 min', badge: 'HD', progress: 25 },
];

export function DesignSystemShowcase() {
  const { t, i18n } = useTranslation();
  const [modalOpen, setModalOpen] = useState(false);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const [typedText, setTypedText] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const handleLanguage = (lang: SupportedLanguage) => {
    void changeAppLanguage(lang);
    setToastMessage(`${t('common.language')}: ${lang}`);
  };

  return (
    <div>
      <header className="ntv-section">
        <h1 style={{ fontSize: 'var(--font-size-2xl)', marginBottom: '8px' }}>
          {t('showcase.title')}
        </h1>
        <p style={{ fontSize: 'var(--font-size-md)', color: 'var(--color-text-secondary)' }}>
          {t('showcase.subtitle')}
        </p>
      </header>

      <section className="ntv-section">
        <h2 className="ntv-section-title">{t('showcase.buttonsSection')}</h2>
        <div>
          <Button
            autoFocus
            variant="primary"
            focusKey="SHOWCASE_BTN_MODAL"
            onPress={() => setModalOpen(true)}
          >
            {t('showcase.openModal')}
          </Button>
          <Button
            variant="secondary"
            focusKey="SHOWCASE_BTN_TOAST"
            onPress={() => setToastMessage(t('showcase.toastMessage'))}
          >
            {t('showcase.showToast')}
          </Button>
          <Button
            variant="ghost"
            focusKey="SHOWCASE_BTN_VKB"
            onPress={() => setKeyboardOpen((prev) => !prev)}
          >
            {t('showcase.openKeyboard')}
          </Button>
          <Button
            variant={i18n.language === 'pt-BR' ? 'primary' : 'secondary'}
            focusKey="LANG_PT"
            onPress={() => handleLanguage('pt-BR')}
          >
            PT-BR
          </Button>
          <Button
            variant={i18n.language === 'en' ? 'primary' : 'secondary'}
            focusKey="LANG_EN"
            onPress={() => handleLanguage('en')}
          >
            EN
          </Button>
          <Button
            variant={i18n.language === 'es' ? 'primary' : 'secondary'}
            focusKey="LANG_ES"
            onPress={() => handleLanguage('es')}
          >
            ES
          </Button>
        </div>
      </section>

      {keyboardOpen && (
        <section className="ntv-section">
          <p style={{ fontSize: 'var(--font-size-sm)', marginBottom: '12px' }}>
            {t('showcase.keyboardLabel')}: <strong>{typedText || '—'}</strong>
          </p>
          <VirtualKeyboard
            value={typedText}
            onChange={setTypedText}
            placeholder={t('showcase.keyboardPlaceholder')}
            onSubmit={(val) => {
              setToastMessage(`${t('showcase.keyboardLabel')}: ${val}`);
              setKeyboardOpen(false);
            }}
          />
        </section>
      )}

      <Carousel title={t('showcase.carouselSection')} focusKey="SHOWCASE_CAROUSEL">
        {SAMPLE_CHANNELS.map((item) => (
          <MediaCard
            key={item.id}
            focusKey={`CAROUSEL_${item.id}`}
            title={item.title}
            subtitle={item.subtitle}
            badge={item.badge}
            progressPercent={item.progress}
            onPress={() => setToastMessage(item.title)}
          />
        ))}
      </Carousel>

      <MediaGrid title={t('showcase.gridSection')} focusKey="SHOWCASE_GRID">
        {SAMPLE_CHANNELS.slice(0, 3).map((item) => (
          <MediaCard
            key={`grid-${item.id}`}
            focusKey={`GRID_${item.id}`}
            title={item.title}
            subtitle={item.subtitle}
            badge={item.badge}
            onPress={() => setToastMessage(item.title)}
          />
        ))}
      </MediaGrid>

      <section className="ntv-section">
        <h2 className="ntv-section-title">{t('showcase.statesSection')}</h2>
        <div style={{ marginBottom: '24px' }}>
          <Skeleton width={280} height={180} />
        </div>
        <div style={{ marginBottom: '24px' }}>
          <EmptyState title={t('common.empty')} description={t('showcase.emptyDescription')} />
        </div>
        <ErrorState
          description={t('showcase.errorDescription')}
          retryFocusKey="SHOWCASE_RETRY"
          onRetry={() => setToastMessage(t('common.retry'))}
        />
      </section>

      <Modal
        isOpen={modalOpen}
        title={t('showcase.modalTitle')}
        focusKey="SHOWCASE_MODAL"
        onClose={() => setModalOpen(false)}
      >
        <p className="ntv-modal-body">{t('showcase.modalBody')}</p>
        <div>
          <Button
            autoFocus
            variant="primary"
            focusKey="SHOWCASE_MODAL_CLOSE"
            onPress={() => setModalOpen(false)}
          >
            {t('common.close')}
          </Button>
          <Button
            variant="secondary"
            focusKey="SHOWCASE_MODAL_TOAST"
            onPress={() => setToastMessage(t('showcase.toastMessage'))}
          >
            {t('showcase.showToast')}
          </Button>
        </div>
      </Modal>

      <Toast message={toastMessage} onDismiss={() => setToastMessage(null)} />
    </div>
  );
}
