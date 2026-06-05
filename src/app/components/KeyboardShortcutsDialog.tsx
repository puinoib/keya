import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  SHORTCUT_DEFINITIONS,
  formatShortcut,
  getResolvedShortcuts,
  type ShortcutMap,
  type ShortcutScope,
} from '@/app/lib/shortcuts';
import { useStore } from '@/app/store/useStore';

const SCOPE_LABELS: Record<ShortcutScope, string> = {
  global: 'Global',
  navigation: 'Navigation',
  keys: 'Keys',
};

export function KeyboardShortcutsDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const shortcuts = useStore((s) => s.db?.getSettings().keyboard_shortcuts) as
    | ShortcutMap
    | undefined;
  const resolved = getResolvedShortcuts(shortcuts);

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Keyboard Shortcuts</DialogTitle>
        </DialogHeader>
        <div className="mt-2 max-h-[65vh] space-y-5 overflow-y-auto pr-1">
          {(['global', 'navigation', 'keys'] as ShortcutScope[]).map(
            (scope) => (
              <section key={scope}>
                <h3 className="mb-2 text-xs font-medium text-ink-quaternary">
                  {SCOPE_LABELS[scope]}
                </h3>
                <div className="overflow-hidden rounded-lg border border-line bg-surface-2">
                  {SHORTCUT_DEFINITIONS.filter(
                    (item) => item.scope === scope
                  ).map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between gap-4 border-b border-line px-3 py-2.5 last:border-b-0"
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-ink-primary">
                          {item.label}
                        </p>
                        <p className="mt-0.5 text-xs text-ink-quaternary">
                          {item.description}
                        </p>
                      </div>
                      <kbd className="shrink-0 rounded-md border border-line bg-canvas-base px-2 py-1 font-mono text-[11px] text-ink-secondary">
                        {formatShortcut(resolved[item.id])}
                      </kbd>
                    </div>
                  ))}
                </div>
              </section>
            )
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
