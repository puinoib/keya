import { useState } from 'react';
import { Outlet } from '@tanstack/react-router';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { KeyForm } from '../keys/KeyForm';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useStore } from '../../store/useStore';
import { useGlobalShortcuts } from '@/app/hooks/useGlobalShortcuts';
import { KeyboardShortcutsDialog } from '@/app/components/KeyboardShortcutsDialog';

export function AppLayout({ children }: { children?: React.ReactNode }) {
  const { showAddForm, setShowAddForm } = useStore();
  const [showShortcuts, setShowShortcuts] = useState(false);
  useGlobalShortcuts(() => setShowShortcuts(true));

  return (
    <div className="flex h-screen bg-canvas-panel text-ink-primary overflow-hidden">
      <Sidebar />

      <div className="flex flex-1 flex-col min-w-0 p-3 pl-0">
        <div className="flex flex-1 flex-col min-h-0 rounded-xl bg-canvas-base border border-line-subtle overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
          <TopBar />

          <ScrollArea className="min-h-0 flex-1">
            <main className="flex h-full min-h-0">
              {children || <Outlet />}
            </main>
          </ScrollArea>
        </div>
      </div>

      <KeyForm open={showAddForm} onClose={() => setShowAddForm(false)} />
      <KeyboardShortcutsDialog
        open={showShortcuts}
        onClose={() => setShowShortcuts(false)}
      />
    </div>
  );
}
