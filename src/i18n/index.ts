import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import ptBR from './locales/pt-BR.json';
import en from './locales/en.json';
import es from './locales/es.json';

export type SupportedLanguage = 'pt-BR' | 'en' | 'es';
const LANG_STORAGE_KEY = 'nettv:lang';

function getInitialLanguage(): SupportedLanguage {
  try {
    const saved = localStorage.getItem(LANG_STORAGE_KEY);
    if (saved === 'pt-BR' || saved === 'en' || saved === 'es') {
      return saved;
    }
  } catch {
    // localStorage indisponível em contextos restritos
  }
  return 'pt-BR';
}

export function changeAppLanguage(lang: SupportedLanguage): Promise<void> {
  try {
    localStorage.setItem(LANG_STORAGE_KEY, lang);
  } catch {
    // Ignorar falha de persistência
  }
  return i18n.changeLanguage(lang).then(() => undefined);
}

void i18n.use(initReactI18next).init({
  resources: {
    'pt-BR': { translation: ptBR },
    en: { translation: en },
    es: { translation: es },
  },
  lng: getInitialLanguage(),
  fallbackLng: 'pt-BR',
  interpolation: {
    escapeValue: false,
  },
});

export default i18n;
