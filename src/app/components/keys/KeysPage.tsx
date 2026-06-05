import { X } from '@phosphor-icons/react';
import { useStore } from '../../store/useStore';
import { KeyList } from '../keys/KeyList';
import { KeyDetail } from '../keys/KeyDetail';

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
  } = useStore();

  const groups = db?.getGroups() ?? [];

  // Build active filter tags
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
  if (filterProvider)
    tags.push({
      label: filterProvider,
      onRemove: () => setFilterProvider(null),
    });
  if (filterTestStatus) {
    const label =
      filterTestStatus === 'success'
        ? 'Success'
        : filterTestStatus === 'failed'
          ? 'Failed'
          : 'Untested';
    tags.push({ label, onRemove: () => setFilterTestStatus(null) });
  }
  if (filterExpiryStatus) {
    const label =
      filterExpiryStatus === 'expired'
        ? 'Expired'
        : filterExpiryStatus === 'expiring'
          ? 'Expiring Soon'
          : 'No Expiry Issue';
    tags.push({ label, onRemove: () => setFilterExpiryStatus(null) });
  }

  return (
    <div className="flex flex-1 min-h-0">
      <div className="flex-1 min-w-0 px-6 py-5 overflow-y-auto scrollbar-hidden">
        <div className="w-full max-w-4xl mx-auto">
          <h1 className="text-sm font-semibold tracking-tight text-ink-primary mb-4">
            Keys
            <span className="ml-1.5 text-xs font-normal text-ink-quaternary tabular-nums">
              {db?.getApiKeys().length ?? 0}
            </span>
          </h1>

          {tags.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 mb-3">
              {tags.map((tag, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-surface-3 text-xs text-ink-secondary"
                >
                  {tag.label}
                  <button
                    onClick={tag.onRemove}
                    className="text-ink-quaternary hover:text-ink-secondary transition-colors"
                  >
                    <X className="size-3" />
                  </button>
                </span>
              ))}
              <button
                onClick={() => {
                  clearFilters();
                  setSearchQuery('');
                }}
                className="text-xs text-ink-quaternary hover:text-ink-secondary transition-colors px-1"
              >
                Clear all
              </button>
            </div>
          )}

          <KeyList />
        </div>
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
