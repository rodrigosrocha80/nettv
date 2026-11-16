import type { ReactNode } from 'react';
import { FocusContext } from '@noriginmedia/norigin-spatial-navigation';
import { useTvFocus } from '../focus/useTvFocus';

export interface MediaGridProps {
  title?: string;
  focusKey?: string;
  children: ReactNode;
}

export function MediaGrid({ title, focusKey, children }: MediaGridProps) {
  const { ref, focusKey: currentFocusKey } = useTvFocus<object, HTMLDivElement>({
    focusKey,
    saveLastFocusedChild: true,
    trackChildren: true,
    focusable: false,
  });

  return (
    <FocusContext.Provider value={currentFocusKey}>
      <section className="ntv-section">
        {title && <h2 className="ntv-section-title">{title}</h2>}
        <div ref={ref} className="ntv-grid">
          {children}
        </div>
      </section>
    </FocusContext.Provider>
  );
}
