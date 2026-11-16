import { useEffect, useRef, type ReactNode } from 'react';
import {
  FocusContext,
  getCurrentFocusKey,
  setFocus,
} from '@noriginmedia/norigin-spatial-navigation';
import { pushModalBackHandler } from '../focus/modalBackStack';
import { useTvFocus } from '../focus/useTvFocus';

export interface ModalProps {
  isOpen: boolean;
  title: string;
  onClose?: () => void;
  focusKey?: string;
  children: ReactNode;
}

function ModalContent({
  title,
  focusKey,
  onClose,
  children,
}: {
  title: string;
  focusKey: string;
  onClose?: () => void;
  children: ReactNode;
}) {
  const previousFocusRef = useRef<string | null>(null);

  const {
    ref,
    focusKey: modalFocusKey,
    focusSelf,
  } = useTvFocus<object, HTMLDivElement>({
    focusKey,
    isFocusBoundary: true,
    focusBoundaryDirections: ['up', 'down', 'left', 'right'],
    trackChildren: true,
    focusable: true,
  });

  useEffect(() => {
    const current = getCurrentFocusKey();
    if (current && current !== modalFocusKey) {
      previousFocusRef.current = current;
    }
    const timer = setTimeout(() => {
      focusSelf();
    }, 0);

    const unregisterBack = onClose ? pushModalBackHandler(onClose) : undefined;

    return () => {
      unregisterBack?.();
      clearTimeout(timer);
      const prev = previousFocusRef.current;
      if (prev) {
        previousFocusRef.current = null;
        void setFocus(prev);
      }
    };
  }, [focusSelf, modalFocusKey, onClose]);

  return (
    <FocusContext.Provider value={modalFocusKey}>
      <div className="ntv-modal-backdrop" role="dialog" aria-modal="true" aria-label={title}>
        <div ref={ref} className="ntv-modal">
          <h2 className="ntv-modal-title">{title}</h2>
          <div>{children}</div>
        </div>
      </div>
    </FocusContext.Provider>
  );
}

export function Modal({ isOpen, title, onClose, focusKey = 'MODAL_DIALOG', children }: ModalProps) {
  if (!isOpen) return null;
  return (
    <ModalContent title={title} focusKey={focusKey} onClose={onClose}>
      {children}
    </ModalContent>
  );
}
