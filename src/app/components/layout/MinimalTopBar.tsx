import { Plus } from '@phosphor-icons/react';
import { useStore } from '../../store/useStore';
import { ThemeMenu } from './ThemeMenu';

/**
 * Lightweight top bar for pages that own their own page header
 * (e.g. Health, Inbox). Only exposes the global theme switch and
 * a quick Add Key action.
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

      <ThemeMenu />
    </header>
  );
}
