import { create } from 'zustand';
import {
  deleteProfile,
  getAllProfiles,
  getFavoritesByProfile,
  getHistoryByProfile,
  removeFavorite,
  saveFavorite,
  saveHistoryItem,
  saveProfile,
} from '../../data/db/userRepository';
import { hashPin, verifyPin } from '../security';
import type { ContentKind, FavoriteItem, HistoryItem, Profile } from '../types';

const ACTIVE_PROFILE_KEY = 'nettv:activeProfileId';

function generateId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function readStoredActiveProfileId(): string | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage.getItem(ACTIVE_PROFILE_KEY) : null;
  } catch {
    return null;
  }
}

function writeStoredActiveProfileId(id: string | null): void {
  try {
    if (typeof localStorage === 'undefined') return;
    if (id) {
      localStorage.setItem(ACTIVE_PROFILE_KEY, id);
    } else {
      localStorage.removeItem(ACTIVE_PROFILE_KEY);
    }
  } catch {
    // Ignora falha de localStorage
  }
}

export interface ProfileState {
  profiles: Profile[];
  activeProfileId: string | null;
  favorites: FavoriteItem[];
  history: HistoryItem[];
  loaded: boolean;

  loadProfiles: () => Promise<void>;
  selectProfile: (profileId: string) => Promise<void>;
  createProfile: (input: { name: string; avatarId: string; pin?: string }) => Promise<Profile>;
  updateProfile: (profile: Profile) => Promise<void>;
  removeProfile: (profileId: string) => Promise<void>;
  setParentalPin: (profileId: string, pin: string | null) => Promise<void>;
  verifyProfilePin: (profileId: string, pin: string) => Promise<boolean>;
  toggleLockedCategory: (profileId: string, categoryId: string) => Promise<void>;
  toggleLockedChannel: (profileId: string, channelId: string) => Promise<void>;
  toggleFavorite: (itemId: string, kind: ContentKind) => Promise<boolean>;
  recordHistory: (
    itemId: string,
    kind: ContentKind,
    positionSec: number,
    durationSec: number,
  ) => Promise<void>;
  resetStore: () => void;
}

export const useProfileStore = create<ProfileState>((set, get) => ({
  profiles: [],
  activeProfileId: null,
  favorites: [],
  history: [],
  loaded: false,

  loadProfiles: async () => {
    const profiles = await getAllProfiles();
    const storedId = readStoredActiveProfileId();
    const active = profiles.find((p) => p.id === storedId)?.id ?? profiles[0]?.id ?? null;

    if (active) {
      const [favorites, history] = await Promise.all([
        getFavoritesByProfile(active),
        getHistoryByProfile(active),
      ]);
      writeStoredActiveProfileId(active);
      set({ profiles, activeProfileId: active, favorites, history, loaded: true });
    } else {
      set({ profiles, activeProfileId: null, favorites: [], history: [], loaded: true });
    }
  },

  selectProfile: async (profileId: string) => {
    const [favorites, history] = await Promise.all([
      getFavoritesByProfile(profileId),
      getHistoryByProfile(profileId),
    ]);
    writeStoredActiveProfileId(profileId);
    set({ activeProfileId: profileId, favorites, history });
  },

  createProfile: async (input) => {
    const pinHash = input.pin ? await hashPin(input.pin) : undefined;
    const profile: Profile = {
      id: generateId('prof'),
      name: input.name.trim() || 'Perfil',
      avatarId: input.avatarId || 'default',
      pinHash,
      lockedCategoryIds: [],
      lockedChannelIds: [],
      createdAt: Date.now(),
    };
    await saveProfile(profile);
    const profiles = [...get().profiles, profile];
    const shouldSelect = get().activeProfileId === null;
    if (shouldSelect) {
      writeStoredActiveProfileId(profile.id);
    }
    set({
      profiles,
      activeProfileId: shouldSelect ? profile.id : get().activeProfileId,
    });
    return profile;
  },

  updateProfile: async (profile) => {
    await saveProfile(profile);
    set({
      profiles: get().profiles.map((p) => (p.id === profile.id ? profile : p)),
    });
  },

  removeProfile: async (profileId) => {
    await deleteProfile(profileId);
    const remaining = get().profiles.filter((p) => p.id !== profileId);
    const wasActive = get().activeProfileId === profileId;
    const nextActive = wasActive ? (remaining[0]?.id ?? null) : get().activeProfileId;

    if (wasActive) {
      writeStoredActiveProfileId(nextActive);
      if (nextActive) {
        const [favorites, history] = await Promise.all([
          getFavoritesByProfile(nextActive),
          getHistoryByProfile(nextActive),
        ]);
        set({ profiles: remaining, activeProfileId: nextActive, favorites, history });
        return;
      }
      set({ profiles: remaining, activeProfileId: null, favorites: [], history: [] });
      return;
    }

    set({ profiles: remaining });
  },

  setParentalPin: async (profileId, pin) => {
    const target = get().profiles.find((p) => p.id === profileId);
    if (!target) return;
    const pinHash = pin ? await hashPin(pin) : undefined;
    const updated: Profile = { ...target, pinHash };
    await get().updateProfile(updated);
  },

  verifyProfilePin: async (profileId, pin) => {
    const target = get().profiles.find((p) => p.id === profileId);
    if (!target?.pinHash) return true;
    return verifyPin(pin, target.pinHash);
  },

  toggleLockedCategory: async (profileId, categoryId) => {
    const target = get().profiles.find((p) => p.id === profileId);
    if (!target) return;
    const exists = target.lockedCategoryIds.indexOf(categoryId) !== -1;
    const lockedCategoryIds = exists
      ? target.lockedCategoryIds.filter((id) => id !== categoryId)
      : [...target.lockedCategoryIds, categoryId];
    await get().updateProfile({ ...target, lockedCategoryIds });
  },

  toggleLockedChannel: async (profileId, channelId) => {
    const target = get().profiles.find((p) => p.id === profileId);
    if (!target) return;
    const exists = target.lockedChannelIds.indexOf(channelId) !== -1;
    const lockedChannelIds = exists
      ? target.lockedChannelIds.filter((id) => id !== channelId)
      : [...target.lockedChannelIds, channelId];
    await get().updateProfile({ ...target, lockedChannelIds });
  },

  toggleFavorite: async (itemId, kind) => {
    const profileId = get().activeProfileId;
    if (!profileId) return false;

    const favId = `${profileId}:${kind}:${itemId}`;
    const exists = get().favorites.some((f) => f.id === favId);

    if (exists) {
      await removeFavorite(favId);
      set({ favorites: get().favorites.filter((f) => f.id !== favId) });
      return false;
    }

    const item: FavoriteItem = {
      id: favId,
      profileId,
      itemId,
      kind,
      addedAt: Date.now(),
    };
    await saveFavorite(item);
    set({ favorites: [item, ...get().favorites] });
    return true;
  },

  recordHistory: async (itemId, kind, positionSec, durationSec) => {
    const profileId = get().activeProfileId;
    if (!profileId) return;

    const watched = durationSec > 0 && positionSec / durationSec >= 0.9;
    const item: HistoryItem = {
      id: `${profileId}:${kind}:${itemId}`,
      profileId,
      itemId,
      kind,
      positionSec,
      durationSec,
      watched,
      updatedAt: Date.now(),
    };

    await saveHistoryItem(item);
    const filtered = get().history.filter((h) => h.id !== item.id);
    set({ history: [item, ...filtered] });
  },

  resetStore: () => {
    set({
      profiles: [],
      activeProfileId: null,
      favorites: [],
      history: [],
      loaded: false,
    });
  },
}));
