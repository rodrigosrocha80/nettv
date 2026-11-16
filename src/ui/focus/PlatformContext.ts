import { createContext, useContext } from 'react';
import type { PlatformAdapter } from '../../platform';

export const PlatformContext = createContext<PlatformAdapter | null>(null);

export function usePlatform(): PlatformAdapter | null {
  return useContext(PlatformContext);
}
