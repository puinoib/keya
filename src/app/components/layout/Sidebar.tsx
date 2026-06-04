import { useState } from 'react';
import { List, FolderOpen, Faders, X, Gear } from '@phosphor-icons/react';
import { useStore } from '../../store/useStore';
import { VaultSwitcher } from '../vault/VaultSwitcher';
import { ManageGroupsDialog } from '../groups/ManageGroupsDialog';
import { SidebarSection } from './SidebarSection';
import { SidebarFilterSelect } from './SidebarFilterSelect';

function SidebarFilterButton({
  icon,
  label,
  count,
  isActive,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  count: number;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-sm transition-all duration-150 ${
        isActive
          ? 'bg-accent/35 text-accent-bright'
          : 'text-ink-tertiary hover:text-ink-secondary hover:bg-surface-3'
      }`}
    >
      {icon}
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
  const {
    db,
    filterGroupId,
    filterProvider,
    filterTestStatus,
    setFilterGroupId,
    setFilterProvider,
    setFilterTestStatus,
    clearSmartFilters,
    setSearchQuery,
  } = useStore();

  const [showGroupsDialog, setShowGroupsDialog] = useState(false);

  const providers = db
    ? [...new Set(db.getApiKeys().map((k) => k.provider))].sort()
    : [];

  const keyCount = db?.getApiKeys().length ?? 0;
  const hasSmartFilters = filterProvider || filterTestStatus;
  const isAllKeysActive =
    !filterGroupId && !filterProvider && !filterTestStatus;

  const handleAllKeysClick = () => {
    setFilterGroupId(null);
    setFilterProvider(null);
    setFilterTestStatus(null);
    setSearchQuery('');
  };

  const handleClearSmartFilters = (e: React.MouseEvent) => {
    e.stopPropagation();
    clearSmartFilters();
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
        <div className="flex-1 min-h-0 overflow-y-auto px-2 pt-1 pb-2">
          {/* Navigation */}
          <nav className="pb-2">
            <SidebarFilterButton
              icon={<List className="size-3" />}
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
              isActive={filterGroupId === '__ungrouped__'}
              onClick={() =>
                setFilterGroupId(
                  filterGroupId === '__ungrouped__' ? null : '__ungrouped__'
                )
              }
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
                  isActive={filterGroupId === group.id}
                  onClick={() =>
                    setFilterGroupId(
                      filterGroupId === group.id ? null : group.id
                    )
                  }
                />
              );
            })}
          </SidebarSection>

          {/* Smart Filters Section */}
          {keyCount > 0 && (
            <SidebarSection
              icon={Faders}
              label="Filters"
              action={
                hasSmartFilters ? (
                  <button
                    onClick={handleClearSmartFilters}
                    className="text-ink-quaternary hover:text-ink-secondary transition-colors p-0.5 rounded hover:bg-surface-3"
                  >
                    <X className="size-3" />
                  </button>
                ) : undefined
              }
            >
              <div className="space-y-1 px-0.5">
                <SidebarFilterSelect
                  value={filterProvider}
                  onChange={setFilterProvider}
                  options={[
                    { value: '', label: 'All Providers' },
                    ...providers.map((p) => ({ value: p, label: p })),
                  ]}
                  placeholder="All Providers"
                />
                <SidebarFilterSelect
                  value={filterTestStatus}
                  onChange={setFilterTestStatus}
                  options={[
                    { value: '', label: 'All Results' },
                    { value: 'success', label: 'Passed' },
                    { value: 'failed', label: 'Failed' },
                    { value: 'untested', label: 'Untested' },
                  ]}
                  placeholder="All Results"
                />
              </div>
            </SidebarSection>
          )}
        </div>

        {/* Footer */}
        <div className="px-3 py-2">
          <a
            href="https://github.com/puinoib/keya"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-ink-quaternary hover:text-ink-tertiary transition-colors flex items-center justify-center gap-1"
          >
            Keya v1.0
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
