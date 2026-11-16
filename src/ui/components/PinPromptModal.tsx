import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from './Button';
import { Modal } from './Modal';
import { VirtualKeyboard } from './VirtualKeyboard';

export interface PinPromptModalProps {
  isOpen: boolean;
  title?: string;
  onVerify: (pin: string) => Promise<boolean>;
  onSuccess: () => void;
  onCancel: () => void;
}

export function PinPromptModal({
  isOpen,
  title,
  onVerify,
  onSuccess,
  onCancel,
}: PinPromptModalProps) {
  const { t } = useTranslation();
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(false);

  const handleSubmit = async (value: string) => {
    setChecking(true);
    setError('');
    const ok = await onVerify(value);
    setChecking(false);
    if (ok) {
      setPin('');
      onSuccess();
    } else {
      setError(t('parental.invalidPin'));
      setPin('');
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      title={title ?? t('parental.enterPinTitle')}
      focusKey="PIN_PROMPT_MODAL"
      onClose={() => {
        setPin('');
        setError('');
        onCancel();
      }}
    >
      <div className="ntv-pin-modal">
        <div className="ntv-pin-display" aria-label={t('parental.pinLabel')}>
          {pin ? '•'.repeat(pin.length) : t('parental.pinPlaceholder')}
        </div>
        {error ? (
          <p className="ntv-form-error" role="alert">
            {error}
          </p>
        ) : null}
        <VirtualKeyboard
          value={pin}
          onChange={setPin}
          onSubmit={(val) => void handleSubmit(val)}
          placeholder={t('parental.pinPlaceholder')}
          focusKey="PIN_KEYBOARD"
        />
        <div className="ntv-row-actions">
          <Button
            variant="primary"
            focusKey="PIN_CONFIRM"
            disabled={checking || !pin}
            onPress={() => void handleSubmit(pin)}
          >
            {t('common.confirm')}
          </Button>
          <Button
            variant="secondary"
            focusKey="PIN_CANCEL"
            onPress={() => {
              setPin('');
              setError('');
              onCancel();
            }}
          >
            {t('common.cancel')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
