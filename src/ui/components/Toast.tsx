import { useEffect } from 'react';

export interface ToastProps {
  message: string | null;
  durationMs?: number;
  onDismiss: () => void;
}

export function Toast({ message, durationMs = 3000, onDismiss }: ToastProps) {
  useEffect(() => {
    if (!message) return undefined;
    const timer = setTimeout(onDismiss, durationMs);
    return () => clearTimeout(timer);
  }, [message, durationMs, onDismiss]);

  if (!message) return null;

  return (
    <div className="ntv-toast" role="status" aria-live="polite">
      {message}
    </div>
  );
}
