import { X } from '@phosphor-icons/react';
import { useStore } from '../../store/useStore';
import { KeyList } from '../keys/KeyList';
import { KeyDetail } from '../keys/KeyDetail';
import { SidebarFilterSelect } from '../layout/SidebarFilterSelect';

export function KeysPage() {
  const {
    db,
    selectedKeyId,
    searchQuery,
    filterGroupId,
    filterProvider,
    filterTestStatus,
    filterExpiryStatus,
    setSearchQuery,
    setFilterGroupId,
    setFilterProvider,
    setFilterTestStatus,
    setFilterExpiryStatus,
    clearFilters,
    clearSmartFilters,
  } = useStore();

  const groups = db?.getGroups() ?? [];
  const providers = db
    ? [...new Set(db.getApiKeys().map((k) => k.provider))].sort()
    : [];
  const hasSmartFilters =
    filterProvider || filterTestStatus || filterExpiryStatus;

  // Build tags for non-smart-filter sources (group, search only)
  const tags: { label: string; onRemove: () => void }[] = [];
  if (searchQuery)
    tags.push({
      label: `"${searchQuery}"`,
      onRemove: () => setSearchQuery(''),
    });
  if (filterGroupId) {
    const name =
      filterGroupId === '__ungrouped__'
        ? 'Ungrouped'
        : groups.find((g) => g.id === filterGroupId)?.name;
    if (name)
      tags.push({ label: name, onRemove: () => setFilterGroupId(null) });
  }

  const hasAnyFilters = hasSmartFilters || tags.length > 0;

  return (
    <div className="flex flex-1 min-h-0">
      <div className="flex-1 min-w-0 px-6 py-6 overflow-y-auto scrollbar-hidden">
        <h1 className="text-base font-semibold tracking-tight text-ink-primary mb-6">
          Keys
          <span className="ml-1.5 text-xs font-normal text-ink-quaternary tabular-nums">
            {db?.getApiKeys().length ?? 0}
          </span>
        </h1>

        {/* Filters row: Smart Filters + Tags (if any) */}
        {(providers.length > 0 || hasAnyFilters) && (
          <div className="flex items-center gap-2 mb-3">
            {/* Smart Filters */}
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
                { value: 'success', label: 'Success' },
                { value: 'failed', label: 'Failed' },
                { value: 'untested', label: 'Untested' },
              ]}
              placeholder="All Results"
            />
            <SidebarFilterSelect
              value={filterExpiryStatus}
              onChange={setFilterExpiryStatus}
              options={[
                { value: '', label: 'All Expiry' },
                { value: 'expired', label: 'Expired' },
                { value: 'expiring', label: 'Expiring Soon' },
                { value: 'valid', label: 'No Expiry Issue' },
              ]}
              placeholder="All Expiry"
            />

            {/* Tags (group, search) */}
            {tags.length > 0 && (
              <>
                {tags.map((tag, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1 h-7 px-2 rounded-md bg-surface-3 text-xs text-ink-secondary truncate max-w-24"
                  >
                    <span className="truncate">{tag.label}</span>
                    <button
                      onClick={tag.onRemove}
                      className="shrink-0 text-ink-quaternary hover:text-ink-secondary transition-colors"
                    >
                      <X className="size-3" />
                    </button>
                  </span>
                ))}
              </>
            )}

            {/* Single Clear all button */}
            {hasAnyFilters && (
              <button
                onClick={() => {
                  clearSmartFilters();
                  clearFilters();
                  setSearchQuery('');
                }}
                className="text-xs text-ink-quaternary hover:text-ink-secondary transition-colors px-1 ml-1"
              >
                Clear all
              </button>
            )}
          </div>
        )}

        <KeyList />
      </div>

      {/* Detail wrapper: animates width so flex naturally shifts the list */}
      <div
        className={`shrink-0 overflow-hidden transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]
                    ${selectedKeyId ? 'w-80' : 'w-0'}`}
      >
        <KeyDetail />
      </div>
    </div>
  );
}
