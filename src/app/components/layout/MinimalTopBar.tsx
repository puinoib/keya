import { ThemeMenu } from './ThemeMenu';

/**
 * Lightweight top bar for pages that own their own page header
 * (e.g. Health, Inbox). Only exposes the global theme switch — the
 * full `TopBar` (search, Add Key, import/export) is intentionally
 * omitted since those actions belong to the Keys workspace.
 */
export function MinimalTopBar() {
  return (
    <header className="h-11 flex items-center justify-end gap-2 px-3 shrink-0">
      <ThemeMenu />
    </header>
  );
}
