import { useState } from 'react';
import { Outlet } from '@tanstack/react-router';
import { Sun, Moon, Monitor } from '@phosphor-icons/react';
import { useGlobalShortcuts } from '@/app/hooks/useGlobalShortcuts';
import { KeyboardShortcutsDialog } from '@/app/components/KeyboardShortcutsDialog';
import { SettingsSidebar } from '@/app/components/settings/SettingsSidebar';
import { useStore } from '@/app/store/useStore';

export function SettingsLayout() {
  const [showShortcuts, setShowShortcuts] = useState(false);
  const { theme, setTheme } = useStore();
  useGlobalShortcuts(() => setShowShortcuts(true));

  return (
    <div className="flex h-screen bg-canvas-panel text-ink-primary overflow-hidden">
      <SettingsSidebar />

      <div className="flex flex-1 flex-col min-w-0 p-3 pl-0">
        <div className="flex flex-1 flex-col min-h-0 rounded-xl bg-canvas-base border border-line-subtle overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
          <header className="h-12 flex items-center justify-end gap-3 px-4 shrink-0 border-b border-line-subtle">
            <div className="flex items-center gap-1 bg-surface-2 rounded-md border border-line p-0.5">
              {(
                [
                  ['system', Monitor],
                  ['light', Sun],
                  ['dark', Moon],
                ] as const
              ).map(([t, Icon]) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTheme(t)}
                  className={`p-1.5 rounded transition-colors ${
                    theme === t
                      ? 'bg-surface-5 text-ink-primary'
                      : 'text-ink-quaternary hover:text-ink-secondary'
                  }`}
                >
                  <Icon className="size-3.5" />
                </button>
              ))}
            </div>
          </header>

          <div className="flex-1 overflow-auto">
            <main className="p-6 max-w-2xl mx-auto w-full">
              <Outlet />
            </main>
          </div>
        </div>
      </div>

      <KeyboardShortcutsDialog
        open={showShortcuts}
        onClose={() => setShowShortcuts(false)}
      />
    </div>
  );
}
