import { useState } from 'react';
import { useNavigate, Outlet } from '@tanstack/react-router';
import { ArrowLeft } from '@phosphor-icons/react';
import { useGlobalShortcuts } from '@/app/hooks/useGlobalShortcuts';
import { KeyboardShortcutsDialog } from '@/app/components/KeyboardShortcutsDialog';
import { SettingsSidebar } from '@/app/components/settings/SettingsSidebar';

export function SettingsLayout() {
  const navigate = useNavigate();
  const [showShortcuts, setShowShortcuts] = useState(false);
  useGlobalShortcuts(() => setShowShortcuts(true));

  return (
    <div className="flex h-screen bg-canvas-panel text-ink-primary overflow-hidden">
      <SettingsSidebar />

      <div className="flex flex-1 flex-col min-w-0 p-3 pl-0">
        <div className="flex flex-1 flex-col min-h-0 rounded-xl bg-canvas-base border border-line-subtle overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
          <header className="h-12 flex items-center gap-3 px-4 shrink-0 border-b border-line-subtle">
            <button
              type="button"
              onClick={() => navigate({ to: '/keys' })}
              className="btn-ghost text-xs"
              aria-label="Back to app"
            >
              <ArrowLeft className="size-3.5" />
              <span>Back to app</span>
            </button>
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
