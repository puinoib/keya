import { useState } from 'react';
import { Outlet } from '@tanstack/react-router';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { KeyForm } from '../keys/KeyForm';
import {
  AlertDialogRoot,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useStore } from '../../store/useStore';
import { useGlobalShortcuts } from '@/app/hooks/useGlobalShortcuts';
import { KeyboardShortcutsDialog } from '@/app/components/KeyboardShortcutsDialog';

export function AppLayout({ children }: { children?: React.ReactNode }) {
  const {
    showAddForm,
    setShowAddForm,
    clipboardCandidate,
    confirmClipboardCandidate,
    dismissClipboardCandidate,
  } = useStore();
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
      <AlertDialogRoot
        open={!!clipboardCandidate}
        onOpenChange={(open) => {
          if (!open) dismissClipboardCandidate();
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Detected API Key in Clipboard</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2 text-sm text-ink-secondary">
              <p>Keya detected a possible {clipboardCandidate?.provider} API key.</p>
              <p>Do you want to prefill a new entry and save it to this vault?</p>
              {clipboardCandidate ? (
                <p className="font-mono text-xs text-ink-quaternary">
                  {clipboardCandidate.masked}
                </p>
              ) : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Not now</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmClipboardCandidate()}
              className="bg-accent text-white hover:bg-accent-bright"
            >
              Save to Keya
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialogRoot>
      <KeyboardShortcutsDialog
        open={showShortcuts}
        onClose={() => setShowShortcuts(false)}
      />
    </div>
  );
}
