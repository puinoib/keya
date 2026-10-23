import { X } from '@phosphor-icons/react';
import { useNavigate } from '@tanstack/react-router';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '@/components/ui/select';
import { useStore } from '../../store/useStore';
import { activeKeys, archivedKeys, sortedGroups } from '../../state/view';
import { keysSearch } from '../../state/keys-search';
import { providerLabel } from '../../state/providers';
import { KeyList } from '../keys/KeyList';
import { KeyDetail } from '../keys/KeyDetail';

const TEST_STATUS_LABELS: Record<string, string> = {
  '': 'All Results',
  success: 'Success',
  failed: 'Failed',
  untested: 'Untested',
};

const EXPIRY_STATUS_LABELS: Record<string, string> = {
  '': 'All Expiry',
  expired: 'Expired',
  expiring: 'Expiring Soon',
  valid: 'No Expiry Issue',
};

export function KeysPage() {
  const navigate = useNavigate();
  const {
    view,
    selectedKeyId,
    searchQuery,
    filterGroupId,
    filterProvider,
    filterTestStatus,
    filterExpiryStatus,
    showArchived,
    setSearchQuery,
    setFilterGroupId,
    setFilterProvider,
    setFilterTestStatus,
    setFilterExpiryStatus,
    clearFilters,
    clearSmartFilters,
  } = useStore();

  const groups = view ? sortedGroups(view) : [];
  const viewKeys = !view
    ? []
    : showArchived
      ? archivedKeys(view)
      : activeKeys(view);
  const providersOf = (providerId: string | null) =>
    providerLabel(providerId, view?.file.providers ?? []);
  const providers = [
    ...new Set(viewKeys.map((key) => providersOf(key.provider_id))),
  ].sort();
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
      tags.push({
        label: name,
        onRemove: () => {
          setFilterGroupId(null);
          navigate({ to: '/keys', search: keysSearch({}) });
        },
      });
  }

  const hasAnyFilters = hasSmartFilters || tags.length > 0;

  return (
    <div className="flex flex-1 min-h-0">
      <div className="flex-1 min-w-0 px-6 py-6 overflow-y-auto scrollbar-hidden">
        <h1 className="text-base font-semibold tracking-tight text-ink-primary mb-6">
          {showArchived ? 'Archived' : 'Keys'}
          <span className="ml-1.5 text-xs font-normal text-ink-quaternary tabular-nums">
            {viewKeys.length}
          </span>
        </h1>

        {/* Filters row: Smart Filters + Tags (if any) */}
        {(providers.length > 0 || hasAnyFilters) && (
          <div className="flex items-center gap-2 mb-3">
            {/* Smart Filters */}
            <Select
              value={filterProvider ?? ''}
              onValueChange={(v) => setFilterProvider(v === '' ? null : v)}
            >
              <SelectTrigger className="h-7 w-auto text-xs px-2">
                {filterProvider || 'All Providers'}
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Providers</SelectItem>
                {providers.map((p) => (
                  <SelectItem key={p} value={p}>
                    {p}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={filterTestStatus ?? ''}
              onValueChange={(v) => setFilterTestStatus(v === '' ? null : v)}
            >
              <SelectTrigger className="h-7 w-auto text-xs px-2">
                {TEST_STATUS_LABELS[filterTestStatus ?? '']}
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Results</SelectItem>
                <SelectItem value="success">Success</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
                <SelectItem value="untested">Untested</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={filterExpiryStatus ?? ''}
              onValueChange={(v) => setFilterExpiryStatus(v === '' ? null : v)}
            >
              <SelectTrigger className="h-7 w-auto text-xs px-2">
                {EXPIRY_STATUS_LABELS[filterExpiryStatus ?? '']}
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Expiry</SelectItem>
                <SelectItem value="expired">Expired</SelectItem>
                <SelectItem value="expiring">Expiring Soon</SelectItem>
                <SelectItem value="valid">No Expiry Issue</SelectItem>
              </SelectContent>
            </Select>

            {/* Tags (group, search) */}
            {tags.length > 0 &&
              tags.map((tag, i) => (
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

            {/* Single Clear all button */}
            {hasAnyFilters && (
              <button
                onClick={() => {
                  clearSmartFilters();
                  clearFilters();
                  setSearchQuery('');
                  navigate({ to: '/keys', search: keysSearch({}) });
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

      {/* Detail wrapper: animates width so flex naturally shifts the list.
          Its padding is what keeps the panel clear of the top bar and gives it
          a bounded height to scroll inside. The panel keeps the narrower width
          below md, where it would otherwise crowd the list off the row. */}
      <div
        className={`pt-[4.5rem] pb-3 shrink-0 overflow-hidden transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]
                    ${selectedKeyId ? 'w-80 md:w-88' : 'w-0'}`}
      >
        <KeyDetail />
      </div>
    </div>
  );
}
