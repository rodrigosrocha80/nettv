import type { ReactNode } from 'react';
import { useTvFocus } from '../focus/useTvFocus';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

export interface ButtonProps {
  children: ReactNode;
  onPress?: () => void;
  variant?: ButtonVariant;
  focusKey?: string;
  autoFocus?: boolean;
  disabled?: boolean;
  className?: string;
}

export function Button({
  children,
  onPress,
  variant = 'primary',
  focusKey,
  autoFocus = false,
  disabled = false,
  className = '',
}: ButtonProps) {
  const { ref, focused, focusSelf } = useTvFocus<object, HTMLButtonElement>({
    focusKey,
    autoFocus,
    focusable: !disabled,
    onEnterPress: () => {
      if (!disabled) onPress?.();
    },
  });

  return (
    <button
      ref={ref}
      type="button"
      disabled={disabled}
      className={`ntv-btn ntv-btn--${variant} ${focused ? 'ntv-btn--focused' : ''} ${className}`.trim()}
      onClick={() => {
        if (!disabled) {
          focusSelf();
          onPress?.();
        }
      }}
    >
      {children}
    </button>
  );
}
