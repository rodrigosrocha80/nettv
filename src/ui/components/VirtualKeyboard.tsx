import { FocusContext } from '@noriginmedia/norigin-spatial-navigation';
import { useTranslation } from 'react-i18next';
import { useTvFocus } from '../focus/useTvFocus';

export interface VirtualKeyboardProps {
  value: string;
  onChange: (nextValue: string) => void;
  onSubmit?: (value: string) => void;
  placeholder?: string;
  focusKey?: string;
}

const KEY_ROWS = [
  ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
  ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
  ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', '@'],
  ['z', 'x', 'c', 'v', 'b', 'n', 'm', '.', '/', ':'],
] as const;

function VirtualKeyButton({
  label,
  focusKey,
  onPress,
}: {
  label: string;
  focusKey: string;
  onPress: () => void;
}) {
  const { ref, focused, focusSelf } = useTvFocus<object, HTMLButtonElement>({
    focusKey,
    onEnterPress: onPress,
  });

  return (
    <button
      ref={ref}
      type="button"
      className={`ntv-vkb-key ${focused ? 'ntv-vkb-key--focused' : ''}`}
      onClick={() => {
        focusSelf();
        onPress();
      }}
    >
      {label}
    </button>
  );
}

export function VirtualKeyboard({
  value,
  onChange,
  onSubmit,
  placeholder,
  focusKey = 'VIRTUAL_KEYBOARD',
}: VirtualKeyboardProps) {
  const { t } = useTranslation();
  const { ref, focusKey: currentFocusKey } = useTvFocus<object, HTMLDivElement>({
    focusKey,
    saveLastFocusedChild: true,
    trackChildren: true,
    focusable: false,
  });

  return (
    <FocusContext.Provider value={currentFocusKey}>
      <div ref={ref} className="ntv-vkb">
        <input
          type="text"
          className="ntv-vkb-input"
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          aria-label={placeholder ?? 'Input'}
        />

        {KEY_ROWS.map((row, rowIndex) => (
          <div key={rowIndex} className="ntv-vkb-row">
            {row.map((char) => (
              <VirtualKeyButton
                key={char}
                label={char}
                focusKey={`${focusKey}_KEY_${char}`}
                onPress={() => onChange(value + char)}
              />
            ))}
          </div>
        ))}

        <div className="ntv-vkb-row">
          <VirtualKeyButton
            label={t('common.space')}
            focusKey={`${focusKey}_SPACE`}
            onPress={() => onChange(`${value} `)}
          />
          <VirtualKeyButton
            label={t('common.backspace')}
            focusKey={`${focusKey}_BACKSPACE`}
            onPress={() => onChange(value.slice(0, -1))}
          />
          <VirtualKeyButton
            label={t('common.clear')}
            focusKey={`${focusKey}_CLEAR`}
            onPress={() => onChange('')}
          />
          {onSubmit && (
            <VirtualKeyButton
              label={t('common.submit')}
              focusKey={`${focusKey}_SUBMIT`}
              onPress={() => onSubmit(value)}
            />
          )}
        </div>
      </div>
    </FocusContext.Provider>
  );
}
