import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useTvFocus } from '../focus/useTvFocus';
import { Button } from './Button';
import { Modal } from './Modal';
import { VirtualKeyboard } from './VirtualKeyboard';

export interface TvTextFieldProps {
  label: string;
  value: string;
  onChange: (nextValue: string) => void;
  placeholder?: string;
  masked?: boolean;
  focusKey?: string;
  autoFocus?: boolean;
}

export function TvTextField({
  label,
  value,
  onChange,
  placeholder,
  masked = false,
  focusKey,
  autoFocus = false,
}: TvTextFieldProps) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  const { ref, focused, focusSelf } = useTvFocus<object, HTMLButtonElement>({
    focusKey,
    autoFocus,
    onEnterPress: () => {
      setDraft(value);
      setEditing(true);
    },
  });

  const displayValue = value
    ? masked
      ? '•'.repeat(Math.min(value.length, 16))
      : value
    : (placeholder ?? '');

  return (
    <div className="ntv-field-box">
      <span className="ntv-field-label">{label}</span>
      <button
        ref={ref}
        type="button"
        className={`ntv-field-input ${focused ? 'ntv-field-input--focused' : ''}`.trim()}
        onClick={() => {
          focusSelf();
          setDraft(value);
          setEditing(true);
        }}
      >
        {displayValue}
      </button>

      <Modal
        isOpen={editing}
        title={label}
        focusKey={focusKey ? `${focusKey}_MODAL` : undefined}
        onClose={() => setEditing(false)}
      >
        <div className="ntv-pin-modal">
          <VirtualKeyboard
            value={draft}
            onChange={setDraft}
            onSubmit={(val) => {
              onChange(val);
              setEditing(false);
            }}
            placeholder={placeholder}
            focusKey={focusKey ? `${focusKey}_KB` : undefined}
          />
          <div className="ntv-row-actions">
            <Button
              focusKey={focusKey ? `${focusKey}_OK` : undefined}
              onPress={() => {
                onChange(draft);
                setEditing(false);
              }}
            >
              {t('common.confirm')}
            </Button>
            <Button
              variant="secondary"
              focusKey={focusKey ? `${focusKey}_CANCEL` : undefined}
              onPress={() => setEditing(false)}
            >
              {t('common.cancel')}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
