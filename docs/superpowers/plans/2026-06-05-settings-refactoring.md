# Settings Page Refactoring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor single-page settings into 6 sub-pages with sidebar navigation

**Architecture:** Two-column layout with fixed sidebar (180px) + scrollable content area. TanStack Router nested routes under `_authenticated.settings.*`.

**Tech Stack:** TanStack Router, Zustand, Tailwind CSS, Phosphor Icons

---

## File Structure

### Routes (create/modify)
- Modify: `src/routes/_authenticated.settings.tsx` - index route with redirect
- Create: `src/routes/_authenticated.settings.index.tsx` - redirect to general
- Create: `src/routes/_authenticated.settings.general.tsx`
- Create: `src/routes/_authenticated.settings.keys.tsx`
- Create: `src/routes/_authenticated.settings.providers.tsx`
- Create: `src/routes/_authenticated.settings.shortcuts.tsx`
- Create: `src/routes/_authenticated.settings.groups.tsx`
- Create: `src/routes/_authenticated.settings.about.tsx`

### Components (create/modify)
- Create: `src/app/components/settings/SettingsSidebar.tsx`
- Modify: `src/app/components/layout/SettingsLayout.tsx`
- Create: `src/app/components/settings/GeneralPage.tsx`
- Create: `src/app/components/settings/KeysPage.tsx`
- Create: `src/app/components/settings/ProvidersPage.tsx`
- Create: `src/app/components/settings/ShortcutsPage.tsx`
- Create: `src/app/components/settings/GroupsPage.tsx`
- Create: `src/app/components/settings/AboutPage.tsx`
- Delete: `src/app/components/settings/SettingsPage.tsx` (content split into 6 pages)
- Delete: `src/app/components/settings/ManageProvidersDialog.tsx` (converted to ProvidersPage)

---

### Task 1: Create SettingsSidebar Component

**Files:**
- Create: `src/app/components/settings/SettingsSidebar.tsx`

- [ ] **Step 1: Create SettingsSidebar component**

```tsx
import { Link, useParams } from '@tanstack/react-router';
import {
  Gear,
  Key,
  HardDrives,
  Keyboard,
  Folders,
  Question,
} from '@phosphor-icons/react';

const navItems = [
  { path: '/settings/general', label: 'General', icon: Gear },
  { path: '/settings/keys', label: 'Keys', icon: Key },
  { path: '/settings/providers', label: 'Providers', icon: HardDrives },
  { path: '/settings/shortcuts', label: 'Shortcuts', icon: Keyboard },
  { path: '/settings/groups', label: 'Groups', icon: Folders },
  { path: '/settings/about', label: 'About', icon: Question },
];

export function SettingsSidebar() {
  const params = useParams({ strict: false });

  const currentPath = `/settings/${params._splat ?? 'general'}`;

  return (
    <nav className="w-[180px] shrink-0 border-r border-line bg-surface-2 p-3">
      <div className="space-y-1">
        {navItems.map((item) => {
          const isActive = currentPath === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center gap-2 rounded-md px-3 py-2 text-xs transition-colors ${
                isActive
                  ? 'bg-accent/15 text-accent-bright font-medium'
                  : 'text-ink-secondary hover:bg-surface-3 hover:text-ink-primary'
              }`}
            >
              <item.icon className="size-4" weight={isActive ? 'fill' : 'regular'} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/components/settings/SettingsSidebar.tsx
git commit -m "feat(settings): add SettingsSidebar component"
```

---

### Task 2: Update SettingsLayout to Include Sidebar

**Files:**
- Modify: `src/app/components/layout/SettingsLayout.tsx`

- [ ] **Step 1: Modify SettingsLayout to add sidebar**

Replace the current content with:

```tsx
import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { ArrowLeft } from '@phosphor-icons/react';
import { Outlet } from '@tanstack/react-router';
import { useGlobalShortcuts } from '@/app/hooks/useGlobalShortcuts';
import { KeyboardShortcutsDialog } from '@/app/components/KeyboardShortcutsDialog';
import { SettingsSidebar } from '@/app/components/settings/SettingsSidebar';

export function SettingsLayout() {
  const navigate = useNavigate();
  const [showShortcuts, setShowShortcuts] = useState(false);
  useGlobalShortcuts(() => setShowShortcuts(true));

  return (
    <div className="flex h-screen bg-canvas-panel text-ink-primary overflow-hidden">
      <div className="flex flex-1 flex-col min-w-0 p-3">
        <div className="flex flex-1 flex-col min-h-0 rounded-xl bg-canvas-base border border-line-subtle overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
          <header className="h-12 flex items-center gap-3 px-4 shrink-0 border-b border-line-subtle">
            <button
              onClick={() => navigate({ to: '/keys' })}
              className="btn-ghost text-xs"
            >
              <ArrowLeft className="size-3.5" />
              <span>Back to app</span>
            </button>
          </header>

          <div className="flex flex-1 min-h-0">
            <SettingsSidebar />
            <div className="flex-1 overflow-auto">
              <main className="p-6 max-w-2xl mx-auto w-full">
                <Outlet />
              </main>
            </div>
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
```

- [ ] **Step 2: Commit**

```bash
git add src/app/components/layout/SettingsLayout.tsx
git commit -m "feat(settings): integrate sidebar into SettingsLayout"
```

---

### Task 3: Create GeneralPage Component

**Files:**
- Create: `src/app/components/settings/GeneralPage.tsx`

- [ ] **Step 1: Create GeneralPage component (Vault + Security sections)**

Extract Vault and Security sections from SettingsPage:

```tsx
import { useState, useEffect, useRef } from 'react';
import { useStore } from '../../store/useStore';
import { Palette, Shield, Fingerprint, Spinner } from '@phosphor-icons/react';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { EmojiPicker } from '@ferrucc-io/emoji-picker';
import {
  isBiometricSupported,
  isBiometricRegistered,
  registerBiometric,
  removeBiometric,
} from '@/app/lib/biometric';

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

export function GeneralPage() {
  const { db, password, updateMeta, updateSettings } = useStore();
  const settings = db?.getSettings();
  const data = db?.getData();
  const [iconPickerOpen, setIconPickerOpen] = useState(false);
  const [bioRegistered, setBioRegistered] = useState(false);
  const [bioLoading, setBioLoading] = useState(false);
  const [bioError, setBioError] = useState('');
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const bioSupported = isBiometricSupported();
  const vaultId = data?.vault_id;

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
          <Palette className="size-4" />
        </div>
        <div>
          <h1 className="text-sm font-semibold tracking-tight text-ink-primary">
            General
          </h1>
          <p className="text-xs text-ink-quaternary">Vault and basic settings</p>
        </div>
      </div>

      <div className="space-y-6">
        {/* Vault */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <Palette className="size-3.5 text-ink-quaternary" />
            <span className="text-xs font-medium text-ink-secondary">Vault</span>
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

        {/* Security */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <Shield className="size-3.5 text-ink-quaternary" />
            <span className="text-xs font-medium text-ink-secondary">Security</span>
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
                <p className="text-xs font-medium text-ink-primary">Auto Lock</p>
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
      </div>
    </>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/components/settings/GeneralPage.tsx
git commit -m "feat(settings): add GeneralPage component"
```

---

### Task 4: Create KeysPage Component

**Files:**
- Create: `src/app/components/settings/KeysPage.tsx`

- [ ] **Step 1: Create KeysPage component**

```tsx
import { useStore } from '../../store/useStore';
import { Flask } from '@phosphor-icons/react';

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

export function KeysPage() {
  const { db, updateSettings } = useStore();
  const settings = db?.getSettings();

  if (!settings) return null;

  return (
    <>
      <div className="flex items-center gap-3 mb-6">
        <div className="flex items-center justify-center size-8 rounded-lg bg-accent/15 text-accent-bright">
          <Flask className="size-4" />
        </div>
        <div>
          <h1 className="text-sm font-semibold tracking-tight text-ink-primary">
            Keys
          </h1>
          <p className="text-xs text-ink-quaternary">Key testing preferences</p>
        </div>
      </div>

      <div className="space-y-6">
        <section>
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
                checked={!!settings.auto_test_on_save}
                onChange={() =>
                  updateSettings({
                    auto_test_on_save: !settings.auto_test_on_save,
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
                checked={!!settings.auto_test_daily}
                onChange={() =>
                  updateSettings({
                    auto_test_daily: !settings.auto_test_daily,
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
                checked={!!settings.clipboard_detection_on_add}
                onChange={() =>
                  updateSettings({
                    clipboard_detection_on_add:
                      !settings.clipboard_detection_on_add,
                  })
                }
              />
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/components/settings/KeysPage.tsx
git commit -m "feat(settings): add KeysPage component"
```

---

### Task 5: Create ProvidersPage Component

**Files:**
- Create: `src/app/components/settings/ProvidersPage.tsx`

- [ ] **Step 1: Create ProvidersPage component (from ManageProvidersDialog)**

```tsx
import { useMemo, useState } from 'react';
import { useStore } from '../../store/useStore';
import { ENDPOINT_DEFAULTS, PRESET_PROVIDERS } from '../../../core/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Check, Plus, Trash, X, HardDrives } from '@phosphor-icons/react';

type ProviderItem = {
  name: string;
  endpoint?: string;
  isCustom: boolean;
  isEnabled: boolean;
};

const presetEndpoints: Record<(typeof PRESET_PROVIDERS)[number], string> = {
  OpenAI: ENDPOINT_DEFAULTS.openai,
  Anthropic: ENDPOINT_DEFAULTS.anthropic,
  Google: ENDPOINT_DEFAULTS.google,
  Groq: ENDPOINT_DEFAULTS.groq,
  DeepSeek: ENDPOINT_DEFAULTS.deepseek,
  Moonshot: ENDPOINT_DEFAULTS.moonshot,
  Zhipu: ENDPOINT_DEFAULTS.zhipu,
  Baidu: ENDPOINT_DEFAULTS.baidu,
  Mistral: ENDPOINT_DEFAULTS.mistral,
  Cohere: ENDPOINT_DEFAULTS.cohere,
  Together: ENDPOINT_DEFAULTS.together,
  OpenRouter: ENDPOINT_DEFAULTS.openrouter,
  SiliconFlow: ENDPOINT_DEFAULTS.siliconflow,
  'Azure OpenAI': ENDPOINT_DEFAULTS.azure,
};

function ProviderCard({
  provider,
  onToggle,
  onRemove,
}: {
  provider: ProviderItem;
  onToggle: () => void;
  onRemove?: () => void;
}) {
  return (
    <div className="rounded-lg border border-line bg-surface-2 p-3">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-medium text-ink-primary">
              {provider.name}
            </p>
            {provider.isCustom && (
              <span className="rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-medium text-accent-bright">
                Custom
              </span>
            )}
          </div>
          <p className="mt-1 truncate font-mono text-xs text-ink-quaternary">
            {provider.endpoint}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            role="switch"
            aria-checked={provider.isEnabled}
            onClick={onToggle}
            className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-all duration-200 ${
              provider.isEnabled ? 'bg-accent' : 'bg-surface-3'
            }`}
          >
            <span
              className={`inline-block size-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${
                provider.isEnabled ? 'translate-x-4' : 'translate-x-0.5'
              }`}
            />
          </button>
          {onRemove && (
            <Button
              type="button"
              size="icon"
              variant="ghost"
              onClick={onRemove}
              className="size-8 text-ink-quaternary hover:text-danger"
              aria-label={`Delete ${provider.name}`}
            >
              <Trash className="size-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export function ProvidersPage() {
  const { db, updateSettings } = useStore();
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEndpoint, setNewEndpoint] = useState('');

  if (!db) return null;
  const settings = db.getSettings();
  const disabled = new Set(settings.disabled_providers ?? []);
  const customs = settings.custom_providers ?? [];

  const allNames = new Set([
    ...PRESET_PROVIDERS,
    ...customs.map((cp) => cp.name),
  ]);

  const providers = useMemo<ProviderItem[]>(() => {
    const presetItems: ProviderItem[] = PRESET_PROVIDERS.map((name) => ({
      name,
      endpoint: presetEndpoints[name],
      isCustom: false,
      isEnabled: !disabled.has(name),
    }));
    const customItems: ProviderItem[] = customs.map((cp) => ({
      name: cp.name,
      endpoint: cp.endpoint,
      isCustom: true,
      isEnabled: !disabled.has(cp.name),
    }));
    return [...presetItems, ...customItems];
  }, [customs, disabled]);

  const toggleProvider = (name: string, enable: boolean) => {
    const updated = enable
      ? settings.disabled_providers.filter((n: string) => n !== name)
      : [...settings.disabled_providers, name];
    updateSettings({ disabled_providers: updated });
  };

  const addCustom = () => {
    const name = newName.trim();
    const endpoint = newEndpoint.trim();
    if (!name || !endpoint || allNames.has(name)) return;

    updateSettings({
      custom_providers: [...customs, { name, endpoint }],
      disabled_providers: settings.disabled_providers.filter(
        (providerName: string) => providerName !== name
      ),
    });
    setNewName('');
    setNewEndpoint('');
    setIsAdding(false);
  };

  const removeCustom = (name: string) => {
    updateSettings({
      custom_providers: customs.filter((cp) => cp.name !== name),
      disabled_providers: settings.disabled_providers.filter(
        (providerName: string) => providerName !== name
      ),
    });
  };

  const duplicateName = allNames.has(newName.trim());

  return (
    <>
      <div className="flex items-center gap-3 mb-6">
        <div className="flex items-center justify-center size-8 rounded-lg bg-accent/15 text-accent-bright">
          <HardDrives className="size-4" />
        </div>
        <div>
          <h1 className="text-sm font-semibold tracking-tight text-ink-primary">
            Providers
          </h1>
          <p className="text-xs text-ink-quaternary">Manage API providers</p>
        </div>
      </div>

      <div className="space-y-4">
        {providers.map((provider) => (
          <ProviderCard
            key={provider.name}
            provider={provider}
            onToggle={() =>
              toggleProvider(provider.name, !provider.isEnabled)
            }
            onRemove={
              provider.isCustom
                ? () => removeCustom(provider.name)
                : undefined
            }
          />
        ))}
      </div>

      <div className="mt-6">
        {isAdding ? (
          <div className="space-y-3 rounded-lg border border-accent/30 bg-surface-2 p-4">
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Provider name"
              autoFocus
            />
            <Input
              value={newEndpoint}
              onChange={(e) => setNewEndpoint(e.target.value)}
              placeholder="https://api.example.com/v1"
              className="font-mono text-xs"
            />
            {duplicateName && newName.trim() ? (
              <p className="text-xs text-danger">
                Provider name already exists.
              </p>
            ) : null}
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                onClick={addCustom}
                disabled={!newName.trim() || !newEndpoint.trim() || duplicateName}
              >
                <Check className="size-3.5" />
                Add Custom Provider
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => {
                  setIsAdding(false);
                  setNewName('');
                  setNewEndpoint('');
                }}
              >
                <X className="size-3.5" />
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <Button
            type="button"
            variant="outline"
            className="w-full justify-center"
            onClick={() => setIsAdding(true)}
          >
            <Plus className="size-4" />
            Add Custom Provider
          </Button>
        )}
      </div>
    </>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/components/settings/ProvidersPage.tsx
git commit -m "feat(settings): add ProvidersPage component"
```

---

### Task 6: Create ShortcutsPage Component

**Files:**
- Create: `src/app/components/settings/ShortcutsPage.tsx`

- [ ] **Step 1: Create ShortcutsPage component**

```tsx
import { useState, useEffect } from 'react';
import { useStore } from '../../store/useStore';
import { Keyboard, ArrowCounterClockwise } from '@phosphor-icons/react';
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
      const conflict = findShortcutConflict(actionId, nextShortcut, shortcutMap);
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
        <p className="text-xs font-medium text-ink-primary">{definition.label}</p>
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
      <div className="flex items-center gap-3 mb-6">
        <div className="flex items-center justify-center size-8 rounded-lg bg-accent/15 text-accent-bright">
          <Keyboard className="size-4" />
        </div>
        <div>
          <h1 className="text-sm font-semibold tracking-tight text-ink-primary">
            Shortcuts
          </h1>
          <p className="text-xs text-ink-quaternary">Customize keyboard shortcuts</p>
        </div>
      </div>

      <div className="rounded-lg border border-line bg-surface-2">
        <div className="flex items-center justify-between gap-3 border-b border-line p-3">
          <div>
            <p className="text-xs font-medium text-ink-primary">Custom Shortcuts</p>
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
```

- [ ] **Step 2: Commit**

```bash
git add src/app/components/settings/ShortcutsPage.tsx
git commit -m "feat(settings): add ShortcutsPage component"
```

---

### Task 7: Create GroupsPage Component

**Files:**
- Create: `src/app/components/settings/GroupsPage.tsx`

- [ ] **Step 1: Create GroupsPage component**

```tsx
import { useStore } from '../../store/useStore';
import { Folders, CaretRight } from '@phosphor-icons/react';
import { useState } from 'react';
import { ManageGroupsDialog } from '../groups/ManageGroupsDialog';

export function GroupsPage() {
  const { db } = useStore();
  const groups = db?.getGroups() ?? [];
  const [showGroups, setShowGroups] = useState(false);

  return (
    <>
      <div className="flex items-center gap-3 mb-6">
        <div className="flex items-center justify-center size-8 rounded-lg bg-accent/15 text-accent-bright">
          <Folders className="size-4" />
        </div>
        <div>
          <h1 className="text-sm font-semibold tracking-tight text-ink-primary">
            Groups
          </h1>
          <p className="text-xs text-ink-quaternary">Organize your keys</p>
        </div>
      </div>

      <div className="rounded-lg border border-line bg-surface-2 divide-y divide-line">
        <button
          onClick={() => setShowGroups(true)}
          className="flex items-center justify-between p-3 w-full text-left hover:bg-surface-3 transition-colors"
        >
          <div>
            <p className="text-xs font-medium text-ink-primary">Manage Groups</p>
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
              <span className="text-xs text-ink-quaternary">No groups yet</span>
            )}
          </div>
        </div>
      </div>

      <ManageGroupsDialog open={showGroups} onClose={() => setShowGroups(false)} />
    </>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/components/settings/GroupsPage.tsx
git commit -m "feat(settings): add GroupsPage component"
```

---

### Task 8: Create AboutPage Component

**Files:**
- Create: `src/app/components/settings/AboutPage.tsx`

- [ ] **Step 1: Create AboutPage component**

```tsx
import { Question, CaretRight, Info } from '@phosphor-icons/react';

export function AboutPage() {
  return (
    <>
      <div className="flex items-center gap-3 mb-6">
        <div className="flex items-center justify-center size-8 rounded-lg bg-accent/15 text-accent-bright">
          <Question className="size-4" />
        </div>
        <div>
          <h1 className="text-sm font-semibold tracking-tight text-ink-primary">
            About
          </h1>
          <p className="text-xs text-ink-quaternary">Help and information</p>
        </div>
      </div>

      <div className="space-y-6">
        {/* Help Center */}
        <section>
          <div className="rounded-lg border border-line bg-surface-2">
            <a
              href="/help"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between p-3 w-full text-left hover:bg-surface-3 transition-colors"
            >
              <div>
                <p className="text-xs font-medium text-ink-primary">Help Center</p>
                <p className="text-xs text-ink-quaternary mt-0.5">
                  Quick start, FAQ, and security
                </p>
              </div>
              <CaretRight className="size-3.5 text-ink-quaternary" />
            </a>
          </div>
        </section>

        {/* App Info */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <Info className="size-3.5 text-ink-quaternary" />
            <span className="text-xs font-medium text-ink-secondary">
              Application
            </span>
          </div>
          <div className="rounded-lg border border-line bg-surface-2 divide-y divide-line">
            <div className="flex items-center justify-between p-3">
              <p className="text-xs text-ink-secondary">Version</p>
              <p className="text-xs text-ink-quaternary">0.0.0</p>
            </div>
            <div className="flex items-center justify-between p-3">
              <p className="text-xs text-ink-secondary">License</p>
              <a
                href="https://opensource.org/licenses/MIT"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-accent hover:underline"
              >
                MIT
              </a>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/components/settings/AboutPage.tsx
git commit -m "feat(settings): add AboutPage component"
```

---

### Task 9: Create Route Files

**Files:**
- Modify: `src/routes/_authenticated.settings.tsx`
- Create: `src/routes/_authenticated.settings.index.tsx`
- Create: `src/routes/_authenticated.settings.general.tsx`
- Create: `src/routes/_authenticated.settings.keys.tsx`
- Create: `src/routes/_authenticated.settings.providers.tsx`
- Create: `src/routes/_authenticated.settings.shortcuts.tsx`
- Create: `src/routes/_authenticated.settings.groups.tsx`
- Create: `src/routes/_authenticated.settings.about.tsx`

- [ ] **Step 1: Modify settings route to be layout route**

Replace `src/routes/_authenticated.settings.tsx` with:

```tsx
import { createFileRoute, Outlet } from '@tanstack/react-router';
import { SettingsLayout } from '@/app/components/layout/SettingsLayout';

export const Route = createFileRoute('/_authenticated/settings')({
  component: () => <SettingsLayout />,
});
```

- [ ] **Step 2: Create index route with redirect**

Create `src/routes/_authenticated.settings.index.tsx`:

```tsx
import { createFileRoute, redirect } from '@tanstack/react-router';

export const Route = createFileRoute('/_authenticated/settings/')({
  beforeLoad: () => {
    throw redirect({ to: '/settings/general' });
  },
  component: () => null,
});
```

- [ ] **Step 3: Create general route**

Create `src/routes/_authenticated.settings.general.tsx`:

```tsx
import { createFileRoute } from '@tanstack/react-router';
import { GeneralPage } from '@/app/components/settings/GeneralPage';

export const Route = createFileRoute('/_authenticated/settings/general')({
  component: () => <GeneralPage />,
});
```

- [ ] **Step 4: Create keys route**

Create `src/routes/_authenticated.settings.keys.tsx`:

```tsx
import { createFileRoute } from '@tanstack/react-router';
import { KeysPage } from '@/app/components/settings/KeysPage';

export const Route = createFileRoute('/_authenticated/settings/keys')({
  component: () => <KeysPage />,
});
```

- [ ] **Step 5: Create providers route**

Create `src/routes/_authenticated.settings.providers.tsx`:

```tsx
import { createFileRoute } from '@tanstack/react-router';
import { ProvidersPage } from '@/app/components/settings/ProvidersPage';

export const Route = createFileRoute('/_authenticated/settings/providers')({
  component: () => <ProvidersPage />,
});
```

- [ ] **Step 6: Create shortcuts route**

Create `src/routes/_authenticated.settings.shortcuts.tsx`:

```tsx
import { createFileRoute } from '@tanstack/react-router';
import { ShortcutsPage } from '@/app/components/settings/ShortcutsPage';

export const Route = createFileRoute('/_authenticated/settings/shortcuts')({
  component: () => <ShortcutsPage />,
});
```

- [ ] **Step 7: Create groups route**

Create `src/routes/_authenticated.settings.groups.tsx`:

```tsx
import { createFileRoute } from '@tanstack/react-router';
import { GroupsPage } from '@/app/components/settings/GroupsPage';

export const Route = createFileRoute('/_authenticated/settings/groups')({
  component: () => <GroupsPage />,
});
```

- [ ] **Step 8: Create about route**

Create `src/routes/_authenticated.settings.about.tsx`:

```tsx
import { createFileRoute } from '@tanstack/react-router';
import { AboutPage } from '@/app/components/settings/AboutPage';

export const Route = createFileRoute('/_authenticated/settings/about')({
  component: () => <AboutPage />,
});
```

- [ ] **Step 9: Commit all route files**

```bash
git add src/routes/_authenticated.settings.tsx src/routes/_authenticated.settings.index.tsx src/routes/_authenticated.settings.general.tsx src/routes/_authenticated.settings.keys.tsx src/routes/_authenticated.settings.providers.tsx src/routes/_authenticated.settings.shortcuts.tsx src/routes/_authenticated.settings.groups.tsx src/routes/_authenticated.settings.about.tsx
git commit -m "feat(settings): create settings sub-page routes"
```

---

### Task 10: Clean Up Old Files

**Files:**
- Delete: `src/app/components/settings/SettingsPage.tsx`
- Delete: `src/app/components/settings/ManageProvidersDialog.tsx`

- [ ] **Step 1: Delete old SettingsPage**

```bash
rm src/app/components/settings/SettingsPage.tsx
```

- [ ] **Step 2: Delete old ManageProvidersDialog**

```bash
rm src/app/components/settings/ManageProvidersDialog.tsx
```

- [ ] **Step 3: Commit deletion**

```bash
git add -A
git commit -m "refactor(settings): remove old SettingsPage and ManageProvidersDialog"
```

---

### Task 11: Verify and Test

- [ ] **Step 1: Run typecheck**

```bash
pnpm typecheck
```

Expected: No errors

- [ ] **Step 2: Run lint**

```bash
pnpm lint
```

Expected: No errors

- [ ] **Step 3: Start dev server and test navigation**

```bash
pnpm dev
```

Manual test:
1. Navigate to `/settings` - should redirect to `/settings/general`
2. Click each sidebar item - should navigate to correct page
3. Verify all settings sections work correctly
4. Check sidebar active state updates on navigation

---

## Self-Review Checklist

1. **Spec coverage:** All 6 pages (General, Keys, Providers, Shortcuts, Groups, About) covered. Sidebar and layout included.
2. **Placeholder scan:** No TBD/TODO found.
3. **Type consistency:** All component imports match file names. Toggle component duplicated in 3 pages - could be extracted but acceptable for simplicity.