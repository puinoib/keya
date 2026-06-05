import { useState, useEffect } from 'react';
import { useStore } from '../../store/useStore';
import { ArrowCounterClockwise } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import {
  DEFAULT_SHORTCUTS,
  SHORTCUT_DEFINITIONS,
  findShortcutConflict,
  formatShortcut,
  getResolvedShortcuts,
  shortcutFromKeyboardEvent,
  type ShortcutActionId,
  type ShortcutMap,
  type ShortcutScope,
} from '@/app/lib/shortcuts';

const SHORTCUT_SCOPE_LABELS: Record<ShortcutScope, string> = {
  global: 'Global',
  navigation: 'Navigation',
  keys: 'Keys',
};

function ShortcutSettingsRow({
  actionId,
  shortcutMap,
  updateShortcut,
  resetShortcut,
  disableShortcut,
}: {
  actionId: ShortcutActionId;
  shortcutMap: ShortcutMap;
  updateShortcut: (id: ShortcutActionId, keys: string) => void;
  resetShortcut: (id: ShortcutActionId) => void;
  disableShortcut: (id: ShortcutActionId) => void;
}) {
  const definition = SHORTCUT_DEFINITIONS.find((item) => item.id === actionId)!;
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState('');
  const resolved = getResolvedShortcuts(shortcutMap);
  const hasCustomValue = Object.hasOwn(shortcutMap, actionId);

  useEffect(() => {
    if (!recording) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      event.preventDefault();
      event.stopPropagation();
      const nextShortcut = shortcutFromKeyboardEvent(event);
      if (!nextShortcut) return;
      const conflict = findShortcutConflict(
        actionId,
        nextShortcut,
        shortcutMap
      );
      if (conflict) {
        setError(`Already used by ${conflict.label}`);
        return;
      }
      updateShortcut(actionId, nextShortcut);
      setError('');
      setRecording(false);
    };
    window.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [actionId, recording, shortcutMap, updateShortcut]);

  return (
    <div className="flex flex-col gap-2 border-b border-line p-3 last:border-b-0 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="text-xs font-medium text-ink-primary">
          {definition.label}
        </p>
        <p className="mt-0.5 text-xs text-ink-quaternary">
          {definition.description}
        </p>
        {error && <p className="mt-1 text-xs text-danger">{error}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <button
          type="button"
          onClick={() => {
            setError('');
            setRecording(true);
          }}
          className={`min-w-24 rounded-md border px-2.5 py-1.5 text-center font-mono text-[11px] transition-colors ${
            recording
              ? 'border-accent-bright bg-accent/10 text-accent-bright'
              : 'border-line bg-canvas-base text-ink-secondary hover:bg-surface-3'
          }`}
        >
          {recording ? 'Press keys...' : formatShortcut(resolved[actionId])}
        </button>
        <button
          type="button"
          onClick={() => disableShortcut(actionId)}
          className="rounded-md px-2 py-1 text-xs text-ink-quaternary transition-colors hover:bg-surface-3 hover:text-ink-secondary"
        >
          Disable
        </button>
        <button
          type="button"
          disabled={!hasCustomValue}
          onClick={() => resetShortcut(actionId)}
          className="inline-flex size-7 items-center justify-center rounded-md text-ink-quaternary transition-colors hover:bg-surface-3 hover:text-ink-secondary disabled:cursor-not-allowed disabled:opacity-40"
          title={`Reset to ${formatShortcut(DEFAULT_SHORTCUTS[actionId])}`}
        >
          <ArrowCounterClockwise className="size-3.5" />
        </button>
      </div>
    </div>
  );
}

export function ShortcutsPage() {
  const { db, updateSettings } = useStore();
  const settings = db?.getSettings();

  if (!settings) return null;

  return (
    <>
      <h1 className="text-base font-semibold tracking-tight text-ink-primary mb-6">
        Shortcuts
      </h1>

      <div className="rounded-lg border border-line bg-surface-2">
        <div className="flex items-center justify-between gap-3 border-b border-line p-3">
          <div>
            <p className="text-xs font-medium text-ink-primary">
              Custom Shortcuts
            </p>
            <p className="mt-0.5 text-xs text-ink-quaternary">
              Click a shortcut and press the keys you want to use
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              updateSettings({ keyboard_shortcuts: {} });
              toast.success('Shortcuts reset to defaults');
            }}
          >
            Reset all
          </Button>
        </div>
        {(['global', 'navigation', 'keys'] as ShortcutScope[]).map((scope) => (
          <div key={scope}>
            <div className="bg-canvas-base px-3 py-2 text-[11px] font-medium uppercase tracking-wide text-ink-quaternary">
              {SHORTCUT_SCOPE_LABELS[scope]}
            </div>
            {SHORTCUT_DEFINITIONS.filter(
              (shortcut) => shortcut.scope === scope
            ).map((shortcut) => (
              <ShortcutSettingsRow
                key={shortcut.id}
                actionId={shortcut.id}
                shortcutMap={settings.keyboard_shortcuts ?? {}}
                updateShortcut={(id, keys) => {
                  updateSettings({
                    keyboard_shortcuts: {
                      ...(settings.keyboard_shortcuts ?? {}),
                      [id]: keys,
                    },
                  });
                }}
                resetShortcut={(id) => {
                  const next = { ...(settings.keyboard_shortcuts ?? {}) };
                  delete next[id];
                  updateSettings({ keyboard_shortcuts: next });
                }}
                disableShortcut={(id) => {
                  updateSettings({
                    keyboard_shortcuts: {
                      ...(settings.keyboard_shortcuts ?? {}),
                      [id]: '',
                    },
                  });
                }}
              />
            ))}
          </div>
        ))}
      </div>
    </>
  );
}
