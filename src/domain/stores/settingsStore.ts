import { create } from 'zustand';
import type { AspectRatioMode, EngineType } from '../../player/types';

export type AppLanguage = 'pt-BR' | 'en' | 'es';
export type FontScale = 'normal' | 'large' | 'xlarge';

export interface AppSettings {
  language: AppLanguage;
  fontScale: FontScale;
  preferredEngine: EngineType | 'auto';
  defaultAspectRatio: AspectRatioMode;
  subtitlesEnabled: boolean;
  defaultCacheTtlMinutes: number;
  telemetryEnabled: boolean;
}

const SETTINGS_STORAGE_KEY = 'nettv:settings:v1';

const DEFAULT_SETTINGS: AppSettings = {
  language: 'pt-BR',
  fontScale: 'normal',
  preferredEngine: 'auto',
  defaultAspectRatio: 'fit',
  subtitlesEnabled: true,
  defaultCacheTtlMinutes: 720,
  telemetryEnabled: false,
};

function readStoredSettings(): AppSettings {
  try {
    if (typeof localStorage === 'undefined') return DEFAULT_SETTINGS;
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<AppSettings>;
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function writeStoredSettings(settings: AppSettings): void {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Ignora falha de localStorage
  }
}

export interface SettingsState extends AppSettings {
  updateSettings: (patch: Partial<AppSettings>) => void;
  resetSettings: () => void;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  ...readStoredSettings(),

  updateSettings: (patch) => {
    const next: AppSettings = {
      language: patch.language ?? get().language,
      fontScale: patch.fontScale ?? get().fontScale,
      preferredEngine: patch.preferredEngine ?? get().preferredEngine,
      defaultAspectRatio: patch.defaultAspectRatio ?? get().defaultAspectRatio,
      subtitlesEnabled: patch.subtitlesEnabled ?? get().subtitlesEnabled,
      defaultCacheTtlMinutes: patch.defaultCacheTtlMinutes ?? get().defaultCacheTtlMinutes,
      telemetryEnabled: patch.telemetryEnabled ?? get().telemetryEnabled,
    };
    writeStoredSettings(next);
    set(next);
  },

  resetSettings: () => {
    writeStoredSettings(DEFAULT_SETTINGS);
    set(DEFAULT_SETTINGS);
  },
}));
