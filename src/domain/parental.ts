import type { Profile } from './types';

export function isItemLockedForProfile(
  profile: Profile | undefined,
  categoryId: string,
  itemId?: string,
): boolean {
  if (!profile || !profile.pinHash) return false;
  if (profile.lockedCategoryIds.indexOf(categoryId) !== -1) return true;
  if (itemId && profile.lockedChannelIds.indexOf(itemId) !== -1) return true;
  return false;
}
