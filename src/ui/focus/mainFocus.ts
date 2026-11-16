import { setFocus } from '@noriginmedia/norigin-spatial-navigation';

let currentMainEntryKey: string | null = null;

export function setMainEntryFocusKey(key: string | null): void {
  currentMainEntryKey = key;
}

export function focusMainContent(): void {
  if (currentMainEntryKey) {
    void setFocus(currentMainEntryKey);
  } else {
    void setFocus('MAIN_CONTENT');
  }
}
