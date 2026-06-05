import { useStore } from '../../store/useStore';
import {
  Gear,
  Palette,
  Fingerprint,
  Spinner,
  Flask,
  Folders,
  HardDrives,
  Shield,
  CaretRight,
  Question,
  Keyboard,
  ArrowCounterClockwise,
} from '@phosphor-icons/react';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useState, useEffect, useRef } from 'react';
import { EmojiPicker } from '@ferrucc-io/emoji-picker';
import {
  isBiometricSupported,
  isBiometricRegistered,
  registerBiometric,
  removeBiometric,
} from '@/app/lib/biometric';
import { ManageProvidersDialog } from './ManageProvidersDialog';
import { ManageGroupsDialog } from '../groups/ManageGroupsDialog';
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

function Toggle({
  checked,
  onChange,
  disabled = false,
}: {
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-disabled={disabled}
      disabled={disabled}
      onClick={onChange}
      className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-all duration-200
        ${checked ? 'bg-accent' : 'bg-surface-3'}
        ${disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
    >
      <span
        className={`inline-block size-4 rounded-full bg-white shadow-sm transition-transform duration-200
        ${checked ? 'translate-x-4' : 'translate-x-0.5'}`}
      />
    </button>
  );
}

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

export function SettingsPage() {
  const { db, password, updateMeta, updateSettings } = useStore();
  const settings = db?.getSettings();
  const data = db?.getData();
  const [iconPickerOpen, setIconPickerOpen] = useState(false);
  const [bioRegistered, setBioRegistered] = useState(false);
  const [bioLoading, setBioLoading] = useState(false);
  const [bioError, setBioError] = useState('');
  const [showProviders, setShowProviders] = useState(false);
  const [showGroups, setShowGroups] = useState(false);
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const bioSupported = isBiometricSupported();
  const vaultId = data?.vault_id;
  const groups = db?.getGroups() ?? [];

  useEffect(() => {
    if (!iconPickerOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (
        emojiPickerRef.current &&
        !emojiPickerRef.current.contains(e.target as Node)
      ) {
        setIconPickerOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [iconPickerOpen]);

  useEffect(() => {
    if (!bioSupported || !vaultId) return;
    isBiometricRegistered(vaultId).then(setBioRegistered);
  }, [bioSupported, vaultId]);

  if (!data) return null;

  return (
    <>
      <div className="flex items-center gap-3 mb-6">
        <div className="flex items-center justify-center size-8 rounded-lg bg-accent/15 text-accent-bright">
          <Gear className="size-4" />
        </div>
        <div>
          <h1 className="text-sm font-semibold tracking-tight text-ink-primary">
            Settings
          </h1>
          <p className="text-xs text-ink-quaternary">Manage your preferences</p>
        </div>
      </div>

      <div className="space-y-6">
        {/* ── Vault ── */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <Palette className="size-3.5 text-ink-quaternary" />
            <span className="text-xs font-medium text-ink-secondary">
              Vault
            </span>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <button
                onClick={() => setIconPickerOpen(!iconPickerOpen)}
                className="size-9 rounded-md border border-line bg-surface-2 flex items-center justify-center text-base hover:bg-surface-3 transition-colors"
              >
                {data.icon || '🔒'}
              </button>
              {iconPickerOpen && (
                <div
                  ref={emojiPickerRef}
                  className="absolute left-0 top-full mt-1.5 z-50 rounded-lg bg-canvas-panel border border-line shadow-dialog"
                >
                  <EmojiPicker
                    onEmojiSelect={(emoji) => {
                      updateMeta({ icon: emoji });
                      setIconPickerOpen(false);
                    }}
                    emojisPerRow={12}
                    emojiSize={28}
                    className="border-none"
                  >
                    <EmojiPicker.Header>
                      <EmojiPicker.Input
                        placeholder="Search emoji..."
                        hideIcon
                        className="w-full px-2 py-1.5 text-xs rounded-md bg-surface-2 border border-line text-ink-primary placeholder:text-ink-quaternary outline-none focus:ring-1 focus:ring-accent/50 mb-1.5"
                      />
                    </EmojiPicker.Header>
                    <EmojiPicker.Group>
                      <EmojiPicker.List containerHeight={220} />
                    </EmojiPicker.Group>
                  </EmojiPicker>
                </div>
              )}
            </div>
            <Input
              value={data.name}
              onChange={(e) => updateMeta({ name: e.target.value })}
              placeholder="My Vault"
              className="h-8 text-xs"
            />
          </div>
        </section>

        {/* ── Security ── */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <Shield className="size-3.5 text-ink-quaternary" />
            <span className="text-xs font-medium text-ink-secondary">
              Security
            </span>
          </div>
          <div className="rounded-lg border border-line bg-surface-2 divide-y divide-line">
            {bioSupported && vaultId && (
              <div className="flex items-center justify-between p-3">
                <div className="flex items-center gap-2.5">
                  <Fingerprint className="size-4 text-ink-quaternary" />
                  <div>
                    <p className="text-xs font-medium text-ink-primary">
                      Biometric Unlock
                    </p>
                    {bioError && (
                      <p className="text-xs text-danger mt-0.5">{bioError}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {bioLoading && (
                    <Spinner className="size-4 animate-spin text-ink-quaternary" />
                  )}
                  <Toggle
                    checked={bioRegistered}
                    disabled={bioLoading}
                    onChange={async () => {
                      setBioLoading(true);
                      setBioError('');
                      try {
                        if (bioRegistered) {
                          await removeBiometric(vaultId);
                          setBioRegistered(false);
                        } else {
                          await registerBiometric(vaultId, password!);
                          setBioRegistered(true);
                        }
                      } catch (e) {
                        setBioError(e instanceof Error ? e.message : 'Failed');
                      } finally {
                        setBioLoading(false);
                      }
                    }}
                  />
                </div>
              </div>
            )}
            <div className="flex items-center justify-between p-3">
              <div>
                <p className="text-xs font-medium text-ink-primary">
                  Auto Lock
                </p>
                <p className="text-xs text-ink-quaternary mt-0.5">
                  Lock after inactivity
                </p>
              </div>
              <Select
                value={String(settings?.auto_lock_minutes ?? 5)}
                onValueChange={(v) =>
                  updateSettings({ auto_lock_minutes: Number(v) })
                }
              >
                <SelectTrigger className="w-24 h-7 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[1, 2, 5, 10, 15, 30].map((m) => (
                    <SelectItem key={m} value={String(m)}>
                      {m} min
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </section>

        {/* ── Keys ── */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <Flask className="size-3.5 text-ink-quaternary" />
            <span className="text-xs font-medium text-ink-secondary">Keys</span>
          </div>
          <div className="rounded-lg border border-line bg-surface-2 divide-y divide-line">
            <div className="flex items-center justify-between p-3">
              <div>
                <p className="text-xs font-medium text-ink-primary">
                  Auto-Test on Save
                </p>
                <p className="text-xs text-ink-quaternary mt-0.5">
                  Test keys after saving
                </p>
              </div>
              <Toggle
                checked={!!settings?.auto_test_on_save}
                onChange={() =>
                  updateSettings({
                    auto_test_on_save: !settings?.auto_test_on_save,
                  })
                }
              />
            </div>
            <div className="flex items-center justify-between p-3">
              <div>
                <p className="text-xs font-medium text-ink-primary">
                  Daily First-Open Test
                </p>
                <p className="text-xs text-ink-quaternary mt-0.5">
                  Test all keys only on the first time you open Keya each day
                </p>
              </div>
              <Toggle
                checked={!!settings?.auto_test_daily}
                onChange={() =>
                  updateSettings({
                    auto_test_daily: !settings?.auto_test_daily,
                  })
                }
              />
            </div>
            <div className="flex items-center justify-between p-3">
              <div>
                <p className="text-xs font-medium text-ink-primary">
                  Detect Clipboard on Add
                </p>
                <p className="text-xs text-ink-quaternary mt-0.5">
                  When you click Add Key, try to detect an OpenAI key from the
                  clipboard first
                </p>
              </div>
              <Toggle
                checked={!!settings?.clipboard_detection_on_add}
                onChange={() =>
                  updateSettings({
                    clipboard_detection_on_add:
                      !settings?.clipboard_detection_on_add,
                  })
                }
              />
            </div>
            <button
              onClick={() => setShowProviders(true)}
              className="flex items-center justify-between p-3 w-full text-left hover:bg-surface-3 transition-colors rounded-b-lg"
            >
              <div className="flex items-center gap-2.5">
                <HardDrives className="size-4 text-ink-quaternary" />
                <p className="text-xs font-medium text-ink-primary">
                  Providers
                </p>
              </div>
              <CaretRight className="size-3.5 text-ink-quaternary" />
            </button>
          </div>
        </section>

        {/* ── Keyboard Shortcuts ── */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <Keyboard className="size-3.5 text-ink-quaternary" />
            <span className="text-xs font-medium text-ink-secondary">
              Keyboard Shortcuts
            </span>
          </div>
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
            {(['global', 'navigation', 'keys'] as ShortcutScope[]).map(
              (scope) => (
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
                      shortcutMap={settings?.keyboard_shortcuts ?? {}}
                      updateShortcut={(id, keys) => {
                        updateSettings({
                          keyboard_shortcuts: {
                            ...(settings?.keyboard_shortcuts ?? {}),
                            [id]: keys,
                          },
                        });
                      }}
                      resetShortcut={(id) => {
                        const next = {
                          ...(settings?.keyboard_shortcuts ?? {}),
                        };
                        delete next[id];
                        updateSettings({ keyboard_shortcuts: next });
                      }}
                      disableShortcut={(id) => {
                        updateSettings({
                          keyboard_shortcuts: {
                            ...(settings?.keyboard_shortcuts ?? {}),
                            [id]: '',
                          },
                        });
                      }}
                    />
                  ))}
                </div>
              )
            )}
          </div>
        </section>

        {/* ── Groups ── */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <Folders className="size-3.5 text-ink-quaternary" />
            <span className="text-xs font-medium text-ink-secondary">
              Groups
            </span>
          </div>
          <div className="rounded-lg border border-line bg-surface-2 divide-y divide-line">
            <button
              onClick={() => setShowGroups(true)}
              className="flex items-center justify-between p-3 w-full text-left hover:bg-surface-3 transition-colors"
            >
              <div>
                <p className="text-xs font-medium text-ink-primary">
                  Manage Groups
                </p>
                <p className="text-xs text-ink-quaternary mt-0.5">
                  Create, rename, and delete key groups
                </p>
              </div>
              <CaretRight className="size-3.5 text-ink-quaternary" />
            </button>
            <div className="p-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs text-ink-quaternary">
                  {groups.length} groups available
                </p>
                {groups.length > 0 ? (
                  <div className="flex flex-wrap justify-end gap-1.5">
                    {groups.slice(0, 4).map((group) => (
                      <span
                        key={group.id}
                        className="inline-flex items-center gap-1 rounded-full border border-line bg-surface-3 px-2 py-1 text-[11px] text-ink-secondary"
                      >
                        <span className="leading-none">{group.icon}</span>
                        <span>{group.name}</span>
                      </span>
                    ))}
                    {groups.length > 4 ? (
                      <span className="inline-flex items-center rounded-full border border-line bg-surface-3 px-2 py-1 text-[11px] text-ink-quaternary">
                        +{groups.length - 4}
                      </span>
                    ) : null}
                  </div>
                ) : (
                  <span className="text-xs text-ink-quaternary">
                    No groups yet
                  </span>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* ── Help & Support ── */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <Question className="size-3.5 text-ink-quaternary" />
            <span className="text-xs font-medium text-ink-secondary">
              Help & Support
            </span>
          </div>
          <div className="rounded-lg border border-line bg-surface-2">
            <a
              href="/help"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between p-3 w-full text-left hover:bg-surface-3 transition-colors"
            >
              <div>
                <p className="text-xs font-medium text-ink-primary">
                  Help Center
                </p>
                <p className="text-xs text-ink-quaternary mt-0.5">
                  Quick start, FAQ, and security
                </p>
              </div>
              <CaretRight className="size-3.5 text-ink-quaternary" />
            </a>
          </div>
        </section>
      </div>

      <ManageProvidersDialog
        open={showProviders}
        onClose={() => setShowProviders(false)}
      />
      <ManageGroupsDialog
        open={showGroups}
        onClose={() => setShowGroups(false)}
      />
    </>
  );
}
