import { useEffect } from 'react';
import {
  useFocusable,
  type UseFocusableConfig,
  type UseFocusableResult,
} from '@noriginmedia/norigin-spatial-navigation';

export interface UseTvFocusOptions<P = object> extends UseFocusableConfig<P> {
  autoFocus?: boolean;
  scrollOnFocus?: boolean;
}

export function useTvFocus<P = object, E extends HTMLElement = HTMLElement>({
  autoFocus = false,
  scrollOnFocus = true,
  onFocus,
  ...config
}: UseTvFocusOptions<P> = {}): UseFocusableResult<E> {
  const result = useFocusable<P, E>({
    ...config,
    onFocus: (layout, props, details) => {
      if (scrollOnFocus && layout.node && typeof layout.node.scrollIntoView === 'function') {
        layout.node.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      }
      onFocus?.(layout, props, details);
    },
  });

  useEffect(() => {
    if (autoFocus) {
      result.focusSelf();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoFocus]);

  return result;
}
