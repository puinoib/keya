import { Plus, Lock } from '@phosphor-icons/react';
import { useStore } from '../../store/useStore';

/**
 * Lightweight top bar for pages that own their own page header
 * (e.g. Health, Inbox). Only exposes a quick Add Key action.
 */
export function MinimalTopBar() {
  const { beginAddKeyFlow } = useStore();

  return (
    <header className="h-11 flex items-center gap-2 px-3 shrink-0">
      <button
        onClick={() => void beginAddKeyFlow()}
        className="inline-flex items-center gap-1 h-7 px-2.5 ml-1 rounded-md bg-accent text-xs font-medium text-white hover:bg-accent-bright transition-colors duration-150"
      >
        <Plus className="size-3.5" /> Add Key
      </button>

      <div className="flex-1" />

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
