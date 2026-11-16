import { BrowserMockPlatform } from './browserMockPlatform';
import { TizenPlatform } from './tizenPlatform';
import type { PlatformAdapter } from './types';

export function createPlatformAdapter(): PlatformAdapter {
  if (typeof window !== 'undefined' && typeof window.tizen !== 'undefined') {
    return new TizenPlatform();
  }
  return new BrowserMockPlatform();
}

export type { DeviceInfo, PlatformAdapter, RemoteKey } from './types';
