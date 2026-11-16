import { FocusContext, useFocusable } from '@noriginmedia/norigin-spatial-navigation';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getCurrentAndNextProgram } from '../../data/db/epgRepository';
import { usePlayerStore } from '../../domain/stores/playerStore';
import type { MediaSourceInput } from '../../player/types';
import { Button } from '../components/Button';
import { useTvFocus } from '../focus/useTvFocus';

interface MiniEpgRowProps {
  channel: MediaSourceInput;
  isActive: boolean;
  autoFocus: boolean;
  onSelect: () => void;
}

function MiniEpgRow({ channel, isActive, autoFocus, onSelect }: MiniEpgRowProps) {
  const [programTitle, setProgramTitle] = useState<string>('');
  const { ref, focused, focusSelf } = useTvFocus<object, HTMLButtonElement>({
    focusKey: `mini-epg-ch-${channel.id}`,
    autoFocus,
    onEnterPress: onSelect,
  });

  useEffect(() => {
    let active = true;
    if (!channel.epgChannelId) return;
    void getCurrentAndNextProgram(channel.epgChannelId).then(({ current }) => {
      if (active && current) {
        setProgramTitle(current.title);
      }
    });
    return () => {
      active = false;
    };
  }, [channel.epgChannelId]);

  return (
    <button
      ref={ref}
      type="button"
      className={`ntv-mini-epg__item ${isActive ? 'ntv-mini-epg__item--active' : ''} ${
        focused ? 'ntv-mini-epg__item--focused' : ''
      }`.trim()}
      onClick={() => {
        focusSelf();
        onSelect();
      }}
    >
      <span className="ntv-mini-epg__num">
        {channel.channelNumber !== undefined ? channel.channelNumber : '•'}
      </span>
      <div className="ntv-mini-epg__info">
        <div className="ntv-mini-epg__name">{channel.title}</div>
        {programTitle ? <div className="ntv-mini-epg__prog">{programTitle}</div> : null}
      </div>
    </button>
  );
}

export function MiniEpgOverlay() {
  const { t } = useTranslation();
  const isMiniEpgVisible = usePlayerStore((s) => s.isMiniEpgVisible);
  const channelQueue = usePlayerStore((s) => s.channelQueue);
  const currentMedia = usePlayerStore((s) => s.currentMedia);
  const loadMedia = usePlayerStore((s) => s.loadMedia);
  const setMiniEpgVisible = usePlayerStore((s) => s.setMiniEpgVisible);

  const { ref, focusKey } = useFocusable({
    focusKey: 'mini-epg-overlay',
    isFocusBoundary: true,
    trackChildren: true,
  });

  if (!isMiniEpgVisible) return null;

  return (
    <FocusContext.Provider value={focusKey}>
      <aside ref={ref} className="ntv-mini-epg" aria-label={t('player.miniGuide')}>
        <div className="ntv-mini-epg__header">
          <h3>{t('player.miniGuide')}</h3>
          <Button
            variant="ghost"
            focusKey="mini-epg-close"
            onPress={() => setMiniEpgVisible(false)}
          >
            {t('common.close')}
          </Button>
        </div>
        <div className="ntv-mini-epg__list">
          {channelQueue.map((ch, idx) => (
            <MiniEpgRow
              key={ch.id}
              channel={ch}
              isActive={currentMedia?.id === ch.id}
              autoFocus={currentMedia?.id === ch.id || (idx === 0 && !currentMedia)}
              onSelect={() => {
                void loadMedia(ch);
                setMiniEpgVisible(false);
              }}
            />
          ))}
        </div>
      </aside>
    </FocusContext.Provider>
  );
}
