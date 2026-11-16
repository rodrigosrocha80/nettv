import { useTranslation } from 'react-i18next';
import { Button } from './Button';

export interface ErrorStateProps {
  title?: string;
  description: string;
  onRetry?: () => void;
  retryFocusKey?: string;
}

export function ErrorState({ title, description, onRetry, retryFocusKey }: ErrorStateProps) {
  const { t } = useTranslation();

  return (
    <div className="ntv-state-box ntv-state-box--error" role="alert">
      <h3 className="ntv-state-title">{title ?? t('common.errorTitle')}</h3>
      <p className="ntv-state-desc">{description}</p>
      {onRetry && (
        <Button variant="primary" focusKey={retryFocusKey} onPress={onRetry}>
          {t('common.retry')}
        </Button>
      )}
    </div>
  );
}
