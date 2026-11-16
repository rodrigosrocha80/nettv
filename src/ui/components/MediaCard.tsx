import { useState } from 'react';
import { useTvFocus } from '../focus/useTvFocus';

export interface MediaCardProps {
  title: string;
  subtitle?: string;
  imageUrl?: string;
  badge?: string;
  progressPercent?: number;
  focusKey?: string;
  onPress?: () => void;
}

export function MediaCard({
  title,
  subtitle,
  imageUrl,
  badge,
  progressPercent,
  focusKey,
  onPress,
}: MediaCardProps) {
  const [imgError, setImgError] = useState(false);
  const { ref, focused, focusSelf } = useTvFocus<object, HTMLDivElement>({
    focusKey,
    onEnterPress: () => onPress?.(),
  });

  const clampedProgress =
    typeof progressPercent === 'number' ? Math.max(0, Math.min(100, progressPercent)) : undefined;

  return (
    <div
      ref={ref}
      role="button"
      tabIndex={-1}
      aria-label={title}
      className={`ntv-card ${focused ? 'ntv-card--focused' : ''}`}
      onClick={() => {
        focusSelf();
        onPress?.();
      }}
    >
      <div className="ntv-card-thumb">
        {imageUrl && !imgError ? (
          <img
            src={imageUrl}
            alt={title}
            loading="lazy"
            decoding="async"
            onError={() => setImgError(true)}
          />
        ) : (
          <span style={{ fontSize: '28px', fontWeight: 700, color: '#475569' }}>
            {title.slice(0, 2).toUpperCase()}
          </span>
        )}
        {badge && <span className="ntv-card-badge">{badge}</span>}
        {clampedProgress !== undefined && clampedProgress > 0 && (
          <div className="ntv-card-progress-track">
            <div className="ntv-card-progress-fill" style={{ width: `${clampedProgress}%` }} />
          </div>
        )}
      </div>
      <div className="ntv-card-body">
        <div className="ntv-card-title">{title}</div>
        {subtitle && <div className="ntv-card-subtitle">{subtitle}</div>}
      </div>
    </div>
  );
}
