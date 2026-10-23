import { Archive, FolderOpen, Gear, List, Tray } from '@phosphor-icons/react';
import { useNavigate, useRouterState } from '@tanstack/react-router';
import { useStore } from '../../store/useStore';
import {
  activeKeys,
  archivedKeys,
  attentionCount,
  sortedGroups,
} from '../../state/view';
import { keysSearch } from '../../state/keys-search';
import { VaultSwitcher } from '../vault/VaultSwitcher';
import { SidebarSection } from './SidebarSection';

type IconComponent = React.ComponentType<
  React.SVGAttributes<SVGElement> & {
    weight?: 'thin' | 'light' | 'regular' | 'bold' | 'fill' | 'duotone';
  }
>;

function SidebarFilterButton({
  icon,
  label,
  count,
  isActive,
  onClick,
}: {
  icon: IconComponent | React.ReactNode;
  label: string;
  count: number;
  isActive: boolean;
  onClick: () => void;
}) {
  const isComponent =
    typeof icon === 'function' ||
    (typeof icon === 'object' && icon !== null && 'render' in icon);
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-sm transition-all duration-150 ${
        isActive
          ? 'bg-accent/35 text-accent-bright'
          : 'text-ink-tertiary hover:text-ink-secondary hover:bg-surface-3'
      }`}
    >
      {isComponent
        ? (() => {
            const Icon = icon as IconComponent;
            return (
              <Icon className="size-3" weight={isActive ? 'fill' : 'regular'} />
            );
          })()
        : (icon as React.ReactNode)}
      <span className="truncate flex-1 text-left">{label}</span>
      {count > 0 && (
        <span className="text-xs tabular-nums text-ink-quaternary">
          {count}
        </span>
      )}
    </button>
  );
}

export function Sidebar() {
  const navigate = useNavigate();
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });
  const {
    view,
    filterGroupId,
    filterProvider,
    filterTestStatus,
    filterExpiryStatus,
    showArchived,
    setShowArchived,
    setFilterGroupId,
    clearFilters,
    clearSmartFilters,
  } = useStore();

  const openInboxCount = attentionCount(view);
  const isInboxActive = pathname === '/inbox';
  const isKeysActive =
    pathname === '/keys' &&
    !showArchived &&
    !filterGroupId &&
    !filterProvider &&
    !filterTestStatus &&
    !filterExpiryStatus;
  const isArchiveActive = pathname === '/keys' && showArchived;

  const handleKeysClick = () => {
    // The default Keys view means no filters at all, so drop every active
    // filter.
    setShowArchived(false);
    clearFilters();
    clearSmartFilters();
    navigate({ to: '/keys' });
  };

  const handleArchivedClick = () => {
    // Archived is a top-level scope, not a filter combined with a group. Group
    // counts only describe active keys, so keeping a group selected here would
    // highlight two sidebar items and show counts for a different list.
    setShowArchived(true);
    setFilterGroupId(null);
    navigate({ to: '/keys', search: keysSearch({ archived: true }) });
  };

  if (!view) return null;

  const liveKeys = activeKeys(view);
  const keyCount = liveKeys.length;
  const archivedCount = archivedKeys(view).length;
  const groups = sortedGroups(view);
  const ungroupedCount = liveKeys.filter((key) => !key.group_id).length;
  // One pass instead of filtering the whole list once per group.
  const groupCounts = new Map<string, number>();
  for (const key of liveKeys) {
    if (!key.group_id) continue;
    groupCounts.set(key.group_id, (groupCounts.get(key.group_id) ?? 0) + 1);
  }

  return (
    <aside className="w-56 shrink-0 flex flex-col bg-canvas-panel">
      {/* Vault Switcher */}
      <VaultSwitcher />

      {/* Main Content */}
      <div className="flex-1 min-h-0 overflow-y-auto scrollbar-hidden px-2 pt-1 pb-2">
        {/* Navigation */}
        <nav className="pb-2">
          <SidebarFilterButton
            icon={Tray}
            label="Inbox"
            count={openInboxCount}
            isActive={isInboxActive}
            onClick={() => navigate({ to: '/inbox' })}
          />
          <SidebarFilterButton
            icon={List}
            label="Keys"
            count={keyCount}
            isActive={isKeysActive}
            onClick={handleKeysClick}
          />
          <SidebarFilterButton
            icon={Archive}
            label="Archived"
            count={archivedCount}
            isActive={isArchiveActive}
            onClick={handleArchivedClick}
          />
        </nav>

        {/* Groups Section */}
        <SidebarSection
          icon={FolderOpen}
          label="Groups"
          action={
            <button
              onClick={() => navigate({ to: '/settings/groups' })}
              className="text-ink-quaternary hover:text-ink-secondary transition-colors p-0.5 rounded hover:bg-surface-3"
            >
              <Gear className="size-3" />
            </button>
          }
        >
          {/* Ungrouped */}
          <SidebarFilterButton
            icon={<span className="text-sm">📥</span>}
            label="Ungrouped"
            count={ungroupedCount}
            isActive={pathname === '/keys' && filterGroupId === '__ungrouped__'}
            onClick={() => {
              const next =
                filterGroupId === '__ungrouped__' ? null : '__ungrouped__';
              if (showArchived) setShowArchived(false);
              setFilterGroupId(next);
              navigate({ to: '/keys', search: keysSearch({ groupId: next }) });
            }}
          />

          {/* Groups */}
          {groups.map((group) => {
            const count = groupCounts.get(group.id) ?? 0;
            return (
              <SidebarFilterButton
                key={group.id}
                icon={
                  <span className="text-sm leading-none">{group.icon}</span>
                }
                label={group.name}
                count={count}
                isActive={pathname === '/keys' && filterGroupId === group.id}
                onClick={() => {
                  const next = filterGroupId === group.id ? null : group.id;
                  if (showArchived) setShowArchived(false);
                  setFilterGroupId(next);
                  navigate({
                    to: '/keys',
                    search: keysSearch({ groupId: next }),
                  });
                }}
              />
            );
          })}
        </SidebarSection>
      </div>

      {/* Footer */}
      <div className="px-3 py-2">
        <a
          href="https://github.com/puinoib/keya"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-ink-quaternary hover:text-ink-tertiary transition-colors flex items-center justify-center gap-1"
        >
          Keya v{__APP_VERSION__}
        </a>
      </div>
    </aside>
  );
}
