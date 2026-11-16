import type { ReactNode } from 'react';

export interface CarouselProps {
  title?: string;
  focusKey?: string;
  children: ReactNode;
}

export function Carousel({ title, children }: CarouselProps) {
  return (
    <section className="ntv-section">
      {title && <h2 className="ntv-section-title">{title}</h2>}
      <div className="ntv-carousel">{children}</div>
    </section>
  );
}
