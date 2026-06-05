import { useState } from 'react';
import { List, FolderOpen, Gear, Tray, Heartbeat } from '@phosphor-icons/react';
import { useNavigate, useRouterState } from '@tanstack/react-router';
import { useStore } from '../../store/useStore';
import { VaultSwitcher } from '../vault/VaultSwitcher';
import { ManageGroupsDialog } from '../groups/ManageGroupsDialog';
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
    db,
    filterGroupId,
    filterProvider,
    filterTestStatus,
    filterExpiryStatus,
    setFilterGroupId,
    setFilterProvider,
    setFilterTestStatus,
    setFilterExpiryStatus,
    setSearchQuery,
  } = useStore();

  const [showGroupsDialog, setShowGroupsDialog] = useState(false);

  const keyCount = db?.getApiKeys().length ?? 0;
  const openInboxCount = db?.getOpenInboxItems().length ?? 0;
  const isInboxActive = pathname === '/inbox';
  const isHealthActive = pathname === '/health';
  const isAllKeysActive =
    pathname === '/keys' &&
    !filterGroupId &&
    !filterProvider &&
    !filterTestStatus &&
    !filterExpiryStatus;

  const handleAllKeysClick = () => {
    setFilterGroupId(null);
    setFilterProvider(null);
    setFilterTestStatus(null);
    setFilterExpiryStatus(null);
    setSearchQuery('');
    navigate({ to: '/keys' });
  };

  if (!db) return null;

  const groups = db.getGroups();
  const ungroupedCount = db.getApiKeys().filter((k) => !k.group_id).length;

  return (
    <>
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
              icon={Heartbeat}
              label="Health"
              count={0}
              isActive={isHealthActive}
              onClick={() => navigate({ to: '/health' })}
            />
            <SidebarFilterButton
              icon={List}
              label="All Keys"
              count={keyCount}
              isActive={isAllKeysActive}
              onClick={handleAllKeysClick}
            />
          </nav>

          {/* Groups Section */}
          <SidebarSection
            icon={FolderOpen}
            label="Groups"
            action={
              <button
                onClick={() => setShowGroupsDialog(true)}
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
              isActive={
                pathname === '/keys' && filterGroupId === '__ungrouped__'
              }
              onClick={() => {
                setFilterGroupId(
                  filterGroupId === '__ungrouped__' ? null : '__ungrouped__'
                );
                navigate({ to: '/keys' });
              }}
            />

            {/* Groups */}
            {groups.map((group) => {
              const count = db
                .getApiKeys()
                .filter((k) => k.group_id === group.id).length;
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
                    setFilterGroupId(
                      filterGroupId === group.id ? null : group.id
                    );
                    navigate({ to: '/keys' });
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

      <ManageGroupsDialog
        open={showGroupsDialog}
        onClose={() => setShowGroupsDialog(false)}
      />
    </>
  );
}
