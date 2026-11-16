import { FocusContext } from '@noriginmedia/norigin-spatial-navigation';
import { focusMainContent } from '../focus/mainFocus';
import { useTvFocus } from '../focus/useTvFocus';

export interface SidebarNavItem {
  id: string;
  label: string;
}

export interface SidebarMenuProps {
  brand?: string;
  items: SidebarNavItem[];
  activeId: string;
  onSelect: (id: string) => void;
  focusKey?: string;
  footer?: React.ReactNode;
}

function SidebarItemButton({
  item,
  isActive,
  onSelect,
}: {
  item: SidebarNavItem;
  isActive: boolean;
  onSelect: (id: string) => void;
}) {
  const { ref, focused, focusSelf } = useTvFocus<object, HTMLButtonElement>({
    focusKey: `SIDEBAR_${item.id}`,
    autoFocus: isActive,
    onEnterPress: () => onSelect(item.id),
    onArrowPress: (direction) => {
      if (direction === 'right') {
        focusMainContent();
        return false;
      }
      return true;
    },
  });

  return (
    <button
      ref={ref}
      type="button"
      className={`ntv-sidebar-item ${isActive ? 'ntv-sidebar-item--active' : ''} ${focused ? 'ntv-sidebar-item--focused' : ''}`.trim()}
      onClick={() => {
        focusSelf();
        onSelect(item.id);
      }}
    >
      {item.label}
    </button>
  );
}

export function SidebarMenu({
  brand = 'NetTV',
  items,
  activeId,
  onSelect,
  focusKey = 'SIDEBAR_MENU',
  footer,
}: SidebarMenuProps) {
  const { ref, focusKey: currentFocusKey } = useTvFocus<object, HTMLElement>({
    focusKey,
    saveLastFocusedChild: true,
    trackChildren: true,
    focusable: false,
  });

  return (
    <FocusContext.Provider value={currentFocusKey}>
      <aside ref={ref} className="ntv-sidebar" aria-label="Menu principal">
        <div>
          <div className="ntv-sidebar-brand">{brand}</div>
          <nav>
            {items.map((item) => (
              <SidebarItemButton
                key={item.id}
                item={item}
                isActive={item.id === activeId}
                onSelect={onSelect}
              />
            ))}
          </nav>
        </div>
        {footer && <div>{footer}</div>}
      </aside>
    </FocusContext.Provider>
  );
}
