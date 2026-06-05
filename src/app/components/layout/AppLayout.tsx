import { useState } from 'react';
import { Outlet } from '@tanstack/react-router';
import { X } from '@phosphor-icons/react';
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
    skipClipboardCandidate,
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
        <AlertDialogContent className="relative">
          <AlertDialogCancel
            aria-label="Close"
            className="absolute right-4 top-4 border-0 bg-transparent p-1 text-ink-quaternary hover:bg-surface-3 hover:text-ink-secondary"
          >
            <X className="size-4" />
          </AlertDialogCancel>
          <AlertDialogHeader>
            <AlertDialogTitle>Use clipboard key?</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2 text-sm text-ink-secondary">
              <p>Detected a possible {clipboardCandidate?.provider} API key.</p>
              {clipboardCandidate ? (
                <p className="font-mono text-xs text-ink-quaternary">
                  {clipboardCandidate.masked}
                </p>
              ) : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogAction
              onClick={() => skipClipboardCandidate()}
              className="bg-surface-2 border border-line text-ink-secondary hover:bg-surface-3"
            >
              Blank Form
            </AlertDialogAction>
            <AlertDialogAction
              onClick={() => confirmClipboardCandidate()}
              className="bg-accent text-white hover:bg-accent-bright"
            >
              Use Key
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
