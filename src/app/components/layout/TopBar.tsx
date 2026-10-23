import { useState } from 'react';
import { flushSave, useStore } from '../../store/useStore';
import { describeSaveFailure } from '../../state/presentation';
import {
  MagnifyingGlass,
  Plus,
  Download,
  DownloadSimple,
  Lock,
} from '@phosphor-icons/react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { exportJsonCopy, exportKeyaCopy } from '../../lib/vault-export';
import {
  formatShortcut,
  formatShortcutCompact,
  getShortcutKeys,
} from '../../lib/shortcuts';
import { Kbd } from '@/components/ui/kbd';
import { ThemeMenu } from './ThemeMenu';

export function TopBar() {
  const {
    searchQuery,
    setSearchQuery,
    beginAddKeyFlow,
    storageMode,
    hasUnsavedChanges,
    saveFailure,
    keyboardShortcuts,
  } = useStore();
  const [searchFocused, setSearchFocused] = useState(false);

  const searchKeys = getShortcutKeys(keyboardShortcuts, 'search.focus');
  const searchHint = formatShortcutCompact(searchKeys);
  // The hint explains how to get into the field, so it is noise once you are in
  // it or once there is a query to read.
  const showSearchHint =
    !searchQuery && !searchFocused && searchHint !== 'Disabled';

  return (
    <header className="h-11 flex items-center gap-2 px-3 shrink-0">
      <button
        onClick={() => void beginAddKeyFlow()}
        className="inline-flex items-center gap-1 h-7 px-2.5 ml-1 rounded-md bg-accent text-xs font-medium text-white hover:bg-accent-bright transition-colors duration-150"
      >
        <Plus className="size-3.5" /> Add Key
      </button>

      <div className="relative flex-1 max-w-sm">
        <MagnifyingGlass className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-ink-quaternary pointer-events-none" />
        <input
          type="text"
          placeholder="Search all keys..."
          value={searchQuery}
          data-keya-search="true"
          onFocus={() => setSearchFocused(true)}
          onBlur={() => setSearchFocused(false)}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              if (searchQuery) setSearchQuery('');
              else e.currentTarget.blur();
            }
          }}
          className="w-full h-7 pl-8 pr-10 rounded-md bg-surface-2 border border-transparent
                          text-xs text-ink-primary placeholder:text-ink-quaternary
                          hover:bg-surface-3 hover:border-line-subtle
                          focus:outline-none focus:bg-surface-2 focus:border-line focus:ring-1 focus:ring-accent-bright/40
                          transition-all duration-150"
        />
        {showSearchHint && (
          <Kbd
            label={formatShortcut(searchKeys)}
            className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2"
          >
            {searchHint}
          </Kbd>
        )}
      </div>

      <div className="flex-1" />

      {saveFailure ? (
        <button
          type="button"
          onClick={() => void flushSave()}
          title={describeSaveFailure(saveFailure)}
          className="shrink-0 rounded px-1.5 py-0.5 text-xs text-danger hover:bg-danger/5"
        >
          Not saved — retry
        </button>
      ) : (
        storageMode === 'download' &&
        hasUnsavedChanges && (
          <span className="shrink-0 text-xs text-amber-600 dark:text-amber-400">
            Unsaved — export .keya to save
          </span>
        )
      )}

      <ThemeMenu />

      {/* Export menu. Keya has no importer: another vault is opened from the
          welcome screen, not merged into this one. */}
      <DropdownMenu>
        <DropdownMenuTrigger className="inline-flex items-center justify-center size-7 rounded-md text-ink-quaternary hover:text-ink-secondary hover:bg-surface-3 transition-colors duration-150">
          <Download className="size-3.5" />
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-44">
          {/* Encrypted copy first; the plaintext export is the exception. */}
          <DropdownMenuItem onClick={() => void exportKeyaCopy()}>
            <DownloadSimple className="size-3.5" /> Export .keya
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => void exportJsonCopy()}>
            <DownloadSimple className="size-3.5" /> Export JSON
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <button
        onClick={() => useStore.getState().lock()}
        className="inline-flex items-center gap-1.5 h-7 px-2 rounded-md text-xs text-ink-quaternary hover:text-ink-secondary hover:bg-surface-3 transition-colors duration-150"
      >
        <Lock className="size-3.5" />
        Lock
      </button>
    </header>
  );
}
