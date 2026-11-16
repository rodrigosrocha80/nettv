import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getProgramsForChannel } from '../../data/db/epgRepository';
import { isItemLockedForProfile } from '../../domain/parental';
import { useCatalogStore } from '../../domain/stores/catalogStore';
import { usePlayerStore } from '../../domain/stores/playerStore';
import { useProfileStore } from '../../domain/stores/profileStore';
import type { Channel, EpgProgram } from '../../domain/types';
import { Button } from '../components/Button';
import { EmptyState } from '../components/EmptyState';
import { MediaCard } from '../components/MediaCard';
import { MediaGrid } from '../components/MediaGrid';
import { PinPromptModal } from '../components/PinPromptModal';
import { useTvFocus } from '../focus/useTvFocus';

const PAGE_SIZE = 60;
const TWO_HOURS_MS = 2 * 60 * 60 * 1000;

export interface LiveTvScreenProps {
  onOpenPlayer: () => void;
}

function CategoryButton({
  label,
  isActive,
  isLocked,
  focusKey,
  onPress,
}: {
  label: string;
  isActive: boolean;
  isLocked: boolean;
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
      className={`ntv-cat-btn ${isActive ? 'ntv-cat-btn--active' : ''} ${
        focused ? 'ntv-cat-btn--focused' : ''
      }`.trim()}
      onClick={() => {
        focusSelf();
        onPress();
      }}
    >
      <span>{label}</span>
      {isLocked ? <span>🔒</span> : null}
    </button>
  );
}

export function LiveTvScreen({ onOpenPlayer }: LiveTvScreenProps) {
  const { t } = useTranslation();
  const categories = useCatalogStore((s) => s.categories);
  const channels = useCatalogStore((s) => s.channels);
  const profiles = useProfileStore((s) => s.profiles);
  const activeProfileId = useProfileStore((s) => s.activeProfileId);
  const favorites = useProfileStore((s) => s.favorites);
  const verifyProfilePin = useProfileStore((s) => s.verifyProfilePin);
  const toggleFavorite = useProfileStore((s) => s.toggleFavorite);
  const setChannelQueue = usePlayerStore((s) => s.setChannelQueue);
  const loadMedia = usePlayerStore((s) => s.loadMedia);

  const activeProfile = useMemo(
    () => profiles.find((p) => p.id === activeProfileId),
    [profiles, activeProfileId],
  );

  const liveCategories = useMemo(() => categories.filter((c) => c.kind === 'live'), [categories]);

  const [selectedCatId, setSelectedCatId] = useState<string>('all');
  const [onlyFavorites, setOnlyFavorites] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'epg'>('grid');
  const [visibleLimit, setVisibleLimit] = useState(PAGE_SIZE);
  const [unlockedIds, setUnlockedIds] = useState<Record<string, boolean>>({});
  const [pendingAction, setPendingAction] = useState<{
    lockKey: string;
    run: () => void;
  } | null>(null);

  const [epgOffsetHours, setEpgOffsetHours] = useState(0);
  const [epgRows, setEpgRows] = useState<Record<string, EpgProgram[]>>({});

  const favChannelIds = useMemo(
    () => new Set(favorites.filter((f) => f.kind === 'live').map((f) => f.itemId)),
    [favorites],
  );

  const filteredChannels = useMemo(() => {
    let list = channels;
    if (onlyFavorites) {
      list = list.filter((c) => favChannelIds.has(c.id));
    } else if (selectedCatId !== 'all') {
      list = list.filter((c) => c.categoryId === selectedCatId);
    }
    return list;
  }, [channels, onlyFavorites, favChannelIds, selectedCatId]);

  const visibleChannels = useMemo(
    () => filteredChannels.slice(0, visibleLimit),
    [filteredChannels, visibleLimit],
  );

  useEffect(() => {
    if (viewMode !== 'epg') return;
    let active = true;
    const baseMs = Date.now() + epgOffsetHours * 60 * 60 * 1000;
    const slice = visibleChannels.slice(0, 15);

    void Promise.all(
      slice.map(async (ch) => {
        if (!ch.epgChannelId) return [ch.id, [] as EpgProgram[]] as const;
        const progs = await getProgramsForChannel(ch.epgChannelId, baseMs, baseMs + TWO_HOURS_MS);
        return [ch.id, progs] as const;
      }),
    ).then((entries) => {
      if (!active) return;
      const map: Record<string, EpgProgram[]> = {};
      for (let i = 0; i < entries.length; i++) {
        const entry = entries[i];
        if (entry) map[entry[0]] = entry[1];
      }
      setEpgRows(map);
    });

    return () => {
      active = false;
    };
  }, [viewMode, epgOffsetHours, visibleChannels]);

  const launchChannel = (ch: Channel) => {
    const queue = filteredChannels.map((item) => ({
      id: item.id,
      title: item.name,
      url: item.streamUrl,
      kind: 'live' as const,
      isLive: true,
      channelNumber: item.number,
      epgChannelId: item.epgChannelId,
      logoUrl: item.logoUrl,
    }));
    setChannelQueue(queue);
    const target = queue.find((q) => q.id === ch.id) ?? queue[0];
    if (target) {
      void loadMedia(target);
      onOpenPlayer();
    }
  };

  const guardParental = (categoryId: string, channelId: string | undefined, run: () => void) => {
    const lockKey = channelId ?? categoryId;
    if (!unlockedIds[lockKey] && isItemLockedForProfile(activeProfile, categoryId, channelId)) {
      setPendingAction({ lockKey, run });
      return;
    }
    run();
  };

  if (channels.length === 0) {
    return (
      <section className="ntv-screen">
        <h1 className="ntv-screen-title">{t('nav.live')}</h1>
        <EmptyState title={t('common.emptyTitle')} description={t('showcase.emptyDescription')} />
      </section>
    );
  }

  return (
    <section className="ntv-screen">
      <div className="ntv-screen-header">
        <h1 className="ntv-screen-title">{t('nav.live')}</h1>
        <div className="ntv-row-actions">
          <Button
            variant={onlyFavorites ? 'primary' : 'secondary'}
            focusKey="LIVE_FILTER_FAV"
            onPress={() => {
              setOnlyFavorites((p) => !p);
              setVisibleLimit(PAGE_SIZE);
            }}
          >
            {t('home.favorites')}
          </Button>
          <Button
            variant={viewMode === 'grid' ? 'primary' : 'secondary'}
            focusKey="LIVE_VIEW_GRID"
            onPress={() => setViewMode('grid')}
          >
            {t('live.viewChannels')}
          </Button>
          <Button
            variant={viewMode === 'epg' ? 'primary' : 'secondary'}
            focusKey="LIVE_VIEW_EPG"
            onPress={() => setViewMode('epg')}
          >
            {t('live.viewEpg')}
          </Button>
        </div>
      </div>

      <div className="ntv-split-layout">
        <div className="ntv-cat-list">
          <CategoryButton
            label={`${t('common.all')} (${channels.length})`}
            isActive={!onlyFavorites && selectedCatId === 'all'}
            isLocked={false}
            focusKey="LIVE_CAT_ALL"
            onPress={() => {
              setOnlyFavorites(false);
              setSelectedCatId('all');
              setVisibleLimit(PAGE_SIZE);
            }}
          />
          {liveCategories.map((cat) => {
            const locked = !unlockedIds[cat.id] && isItemLockedForProfile(activeProfile, cat.id);
            return (
              <CategoryButton
                key={cat.id}
                label={cat.name}
                isActive={!onlyFavorites && selectedCatId === cat.id}
                isLocked={locked}
                focusKey={`LIVE_CAT_${cat.id}`}
                onPress={() =>
                  guardParental(cat.id, undefined, () => {
                    setOnlyFavorites(false);
                    setSelectedCatId(cat.id);
                    setVisibleLimit(PAGE_SIZE);
                  })
                }
              />
            );
          })}
        </div>

        <div>
          {viewMode === 'grid' ? (
            <>
              <MediaGrid focusKey="LIVE_CHANNELS_GRID">
                {visibleChannels.map((ch) => (
                  <MediaCard
                    key={ch.id}
                    title={ch.name}
                    imageUrl={ch.logoUrl}
                    badge={favChannelIds.has(ch.id) ? '★' : ch.number ? `#${ch.number}` : undefined}
                    focusKey={`LIVE_CH_${ch.id}`}
                    onPress={() => guardParental(ch.categoryId, ch.id, () => launchChannel(ch))}
                  />
                ))}
              </MediaGrid>
              {visibleChannels.length > 0 ? (
                <div className="ntv-row-actions" style={{ marginTop: '16px' }}>
                  <Button
                    variant="ghost"
                    focusKey="LIVE_FAV_FIRST"
                    onPress={() => {
                      const first = visibleChannels[0];
                      if (first) void toggleFavorite(first.id, 'live');
                    }}
                  >
                    {t('live.toggleFirstFav')}
                  </Button>
                  {filteredChannels.length > visibleLimit ? (
                    <Button
                      variant="secondary"
                      focusKey="LIVE_LOAD_MORE"
                      onPress={() => setVisibleLimit((n) => n + PAGE_SIZE)}
                    >
                      {t('common.loadMore')} ({filteredChannels.length - visibleLimit})
                    </Button>
                  ) : null}
                </div>
              ) : null}
            </>
          ) : (
            <div className="ntv-epg-grid">
              <div className="ntv-row-actions">
                <Button
                  variant="secondary"
                  focusKey="EPG_PREV_TIME"
                  onPress={() => setEpgOffsetHours((h) => h - 2)}
                >
                  ◀ -2h
                </Button>
                <Button
                  variant="secondary"
                  focusKey="EPG_NOW_TIME"
                  onPress={() => setEpgOffsetHours(0)}
                >
                  {t('player.now')}
                </Button>
                <Button
                  variant="secondary"
                  focusKey="EPG_NEXT_TIME"
                  onPress={() => setEpgOffsetHours((h) => h + 2)}
                >
                  +2h ▶
                </Button>
              </div>

              {visibleChannels.slice(0, 15).map((ch) => {
                const progs = epgRows[ch.id] ?? [];
                return (
                  <div key={ch.id} className="ntv-epg-row">
                    <Button
                      variant="secondary"
                      focusKey={`EPG_CH_${ch.id}`}
                      onPress={() => guardParental(ch.categoryId, ch.id, () => launchChannel(ch))}
                    >
                      {ch.name}
                    </Button>
                    <div className="ntv-epg-programs">
                      {progs.length === 0 ? (
                        <div className="ntv-epg-slot">
                          <div className="ntv-epg-slot__title">{t('live.noEpgData')}</div>
                        </div>
                      ) : (
                        progs.map((p) => (
                          <div key={p.id} className="ntv-epg-slot">
                            <div className="ntv-epg-slot__time">
                              {new Date(p.startMs).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}{' '}
                              -{' '}
                              {new Date(p.endMs).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </div>
                            <div className="ntv-epg-slot__title">{p.title}</div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <PinPromptModal
        isOpen={Boolean(pendingAction)}
        onVerify={(pin) =>
          activeProfile ? verifyProfilePin(activeProfile.id, pin) : Promise.resolve(true)
        }
        onSuccess={() => {
          if (pendingAction) {
            setUnlockedIds((prev) => ({ ...prev, [pendingAction.lockKey]: true }));
            pendingAction.run();
            setPendingAction(null);
          }
        }}
        onCancel={() => setPendingAction(null)}
      />
    </section>
  );
}
