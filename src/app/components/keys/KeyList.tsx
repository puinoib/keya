import { useState, useEffect, useRef } from 'react';
import { format } from 'date-fns';
import { DayPicker } from './DayPicker';
import { GroupSelect } from './GroupSelect';
import { runManualCheck, useStore, type KeyPatch } from '../../store/useStore';
import { scheduleClipboardClear } from '../../lib/clipboard';
import { ApiTester, checkKind } from '../../lib/api-tester';
import type { TestResult } from '../../lib/api-tester';
import {
  describeTestResult,
  getTestActionHint,
  getTestActionLabel,
} from '../../lib/test-feedback';
import type { Key } from '../../../core/payload/types';
import {
  activeKeys,
  archivedKeys,
  checkOf,
  expiryOf,
  hasDuplicateSecret,
  searchKeys,
  sortedGroups,
} from '../../state/view';
import {
  dateToExpiry,
  expiryToDate,
  expiryStatusLabel,
} from '../../state/presentation';
import {
  getDefaultEndpointForProvider,
  getProviderSections,
  providerIdForLabel,
  providerLabel,
} from '../../state/providers';
import { ProviderLogo } from '@/app/components/ui/provider-logo';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AutoResizeTextarea } from '@/components/ui/auto-resize-textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
} from '@/components/ui/select';
import {
  Archive,
  Copy,
  DotsThree,
  FloppyDisk,
  Flask,
  Trash,
  PencilSimple,
  Eye,
  EyeSlash,
  Key as KeyIcon,
  Plus,
  MagnifyingGlass,
  ArrowCounterClockwise,
  Spinner,
  Calendar,
  X,
} from '@phosphor-icons/react';
import { toast } from 'sonner';
import { useAppHotkey } from '@/app/hooks/useAppHotkey';
import { DeleteKeyDialog } from './DeleteKeyDialog';

export function KeyList() {
  const view = useStore((s) => s.view);
  const providers = view?.file.providers ?? [];
  const {
    searchQuery,
    filterGroupId,
    filterProvider,
    filterTestStatus,
    filterExpiryStatus,
    showArchived,
    selectedKeyId,
    setSelectedKeyId,
    beginAddKeyFlow,
    updateKey,
    archiveKey,
    restoreKey,
  } = useStore();
  const [testing, setTesting] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [editingKey, setEditingKey] = useState<Key | null>(null);
  const [deletingKey, setDeletingKey] = useState<Key | null>(null);
  const [hoveredKeyId, setHoveredKeyId] = useState<string | null>(null);
  const keyItemRefs = useRef(new Map<string, HTMLDivElement>());

  const baseKeys = !view
    ? []
    : showArchived
      ? archivedKeys(view)
      : activeKeys(view);

  let keys = baseKeys;
  if (view && searchQuery) keys = searchKeys(view, keys, searchQuery);
  if (filterGroupId) {
    keys =
      filterGroupId === '__ungrouped__'
        ? keys.filter((key) => !key.group_id)
        : keys.filter((key) => key.group_id === filterGroupId);
  }
  if (view && filterProvider)
    keys = keys.filter(
      (key) => providerLabel(key.provider_id, providers) === filterProvider
    );
  if (view && filterTestStatus)
    keys = keys.filter((key) => checkOf(view, key).status === filterTestStatus);
  if (view && filterExpiryStatus) {
    keys = keys.filter((key) => {
      const status = expiryOf(view, key).status;
      if (filterExpiryStatus === 'expired') return status === 'expired';
      if (filterExpiryStatus === 'expiring') return status === 'expiring_soon';
      if (filterExpiryStatus === 'valid')
        return status === 'valid' || status === 'none';
      return true;
    });
  }

  // Deselect if the selected key is filtered out
  useEffect(() => {
    if (selectedKeyId && !keys.some((k) => k.id === selectedKeyId)) {
      setSelectedKeyId(null);
    }
  }, [selectedKeyId, keys, setSelectedKeyId]);

  const handleTest = async (key: Key) => {
    if (key.archived_at) return;
    const vaultId = useStore.getState().view?.vaultId;
    setTesting(key.id);
    const result = await ApiTester.testStored(key.id);
    if (useStore.getState().view?.vaultId !== vaultId) {
      setTesting(null);
      return;
    }
    setTesting(null);
    const feedback = describeTestResult(result, key.name);
    toast[result.success ? 'success' : 'error'](feedback.title, {
      description: feedback.description,
    });
  };

  const handleArchive = (key: Key) => {
    archiveKey(key.id);
    toast.success(`Archived "${key.name}"`, {
      action: { label: 'Undo', onClick: () => restoreKey(key.id) },
    });
  };

  const handleRestore = (key: Key) => {
    restoreKey(key.id);
    toast.success(`Restored "${key.name}"`);
  };

  const handleCopy = async (keyValue: string, keyId: string) => {
    try {
      await navigator.clipboard.writeText(keyValue);
      setCopiedId(keyId);
      setTimeout(() => setCopiedId(null), 2000);
      scheduleClipboardClear(keyValue);
      toast.success('Copied to clipboard');
    } catch {
      /* clipboard unavailable */
    }
  };

  const hasFilters =
    searchQuery ||
    filterGroupId ||
    filterProvider ||
    filterTestStatus ||
    filterExpiryStatus;

  const selectedKey = selectedKeyId
    ? keys.find((key) => key.id === selectedKeyId)
    : null;
  const keyShortcutsEnabled = keys.length > 0 && !editingKey && !deletingKey;

  const selectKeyAt = (index: number) => {
    if (keys.length === 0) return;
    const clampedIndex = Math.max(0, Math.min(index, keys.length - 1));
    setSelectedKeyId(keys[clampedIndex].id);
  };

  const moveSelection = (direction: 1 | -1) => {
    if (keys.length === 0) return;
    const currentIndex = selectedKeyId
      ? keys.findIndex((key) => key.id === selectedKeyId)
      : -1;
    const nextIndex =
      currentIndex === -1
        ? direction === 1
          ? 0
          : keys.length - 1
        : (currentIndex + direction + keys.length) % keys.length;
    selectKeyAt(nextIndex);
  };

  useEffect(() => {
    if (!selectedKeyId) return;
    keyItemRefs.current
      .get(selectedKeyId)
      ?.scrollIntoView({ block: 'nearest' });
  }, [selectedKeyId]);

  useAppHotkey('key.next', () => moveSelection(1), {
    enabled: keyShortcutsEnabled,
  });
  useAppHotkey('key.previous', () => moveSelection(-1), {
    enabled: keyShortcutsEnabled,
  });
  useAppHotkey(
    'key.open',
    () => {
      if (!selectedKeyId) selectKeyAt(0);
    },
    { enabled: keyShortcutsEnabled }
  );
  useAppHotkey(
    'key.copy',
    () => {
      if (selectedKey) handleCopy(selectedKey.secret, selectedKey.id);
    },
    { enabled: keyShortcutsEnabled && !!selectedKey }
  );
  useAppHotkey(
    'key.edit',
    () => {
      if (selectedKey && !selectedKey.archived_at) setEditingKey(selectedKey);
    },
    {
      enabled: keyShortcutsEnabled && !!selectedKey && !selectedKey.archived_at,
    }
  );
  useAppHotkey(
    'key.test',
    () => {
      if (selectedKey && !selectedKey.archived_at) handleTest(selectedKey);
    },
    {
      enabled: keyShortcutsEnabled && !!selectedKey && !selectedKey.archived_at,
    }
  );
  useAppHotkey(
    'key.delete',
    () => {
      if (selectedKey) setDeletingKey(selectedKey);
    },
    { enabled: keyShortcutsEnabled && !!selectedKey }
  );
  useAppHotkey('key.closeDetail', () => setSelectedKeyId(null), {
    enabled: !!selectedKeyId && !editingKey && !deletingKey,
  });

  if (!view) return null;

  if (showArchived && keys.length === 0 && !hasFilters) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="flex items-center justify-center size-14 rounded-2xl bg-surface-3 text-ink-quaternary mb-5">
          <Archive className="size-6" />
        </div>
        <h3 className="text-sm font-semibold text-ink-primary mb-1.5">
          Nothing archived
        </h3>
        <p className="text-xs text-ink-quaternary max-w-[240px]">
          Archive credentials you no longer use to keep them out of the main
          list without deleting them.
        </p>
      </div>
    );
  }

  if (keys.length === 0 && !hasFilters) {
    const archivedCount = archivedKeys(view).length;
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="flex items-center justify-center size-14 rounded-2xl bg-accent/10 text-accent-bright mb-5">
          <KeyIcon className="size-6" />
        </div>
        <h3 className="text-sm font-semibold text-ink-primary mb-1.5">
          {archivedCount > 0 ? 'No active credentials' : 'No credentials yet'}
        </h3>
        <p className="text-xs text-ink-quaternary mb-6 max-w-[220px]">
          {archivedCount > 0
            ? 'Every credential is archived. Restore one or add a new key.'
            : 'Store the API keys and tokens your projects depend on'}
        </p>
        <button
          onClick={() => void beginAddKeyFlow()}
          className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-xs font-medium text-white hover:bg-accent-bright transition-colors duration-150"
        >
          <Plus className="size-3.5" />
          Add your first key
        </button>
        {archivedCount > 0 && (
          <button
            onClick={() => useStore.getState().setShowArchived(true)}
            className="mt-3 text-xs text-ink-quaternary hover:text-ink-secondary transition-colors"
          >
            View archive ({archivedCount})
          </button>
        )}
      </div>
    );
  }

  if (keys.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="flex items-center justify-center size-10 rounded-xl bg-surface-3 text-ink-quaternary mb-3">
          <MagnifyingGlass className="size-4" />
        </div>
        <p className="text-sm text-ink-tertiary">No keys match your filters</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-1">
        {keys.map((key) => {
          const isTesting = testing === key.id;
          const isSelected = selectedKeyId === key.id;
          const check = view ? checkOf(view, key) : null;
          const expiryStatus = view ? expiryOf(view, key).status : 'none';
          const status =
            check?.status === 'success'
              ? {
                  dot: 'bg-success-bright',
                }
              : check?.status === 'failed'
                ? {
                    dot: 'bg-danger',
                  }
                : {
                    dot: 'bg-ink-quaternary/35',
                  };
          const checkLabel = check
            ? getTestActionLabel(check.kind)
            : getTestActionLabel('request');
          const expiryLabel =
            expiryStatus === 'expired' || expiryStatus === 'expiring_soon'
              ? expiryStatusLabel(expiryStatus)
              : null;
          const expiryClassName =
            expiryStatus === 'expired'
              ? 'text-danger'
              : 'text-[#d97706] dark:text-[#fbbf24]';

          return (
            <div
              key={key.id}
              ref={(node) => {
                if (node) keyItemRefs.current.set(key.id, node);
                else keyItemRefs.current.delete(key.id);
              }}
              role="button"
              tabIndex={0}
              aria-pressed={isSelected}
              onClick={() => setSelectedKeyId(isSelected ? null : key.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setSelectedKeyId(isSelected ? null : key.id);
                }
              }}
              onMouseEnter={() => setHoveredKeyId(key.id)}
              onMouseLeave={() => setHoveredKeyId(null)}
              className={`group flex cursor-pointer items-center gap-3 rounded-lg border px-3.5 py-2.5
                         transition-colors duration-150 focus:outline-none focus:ring-1 focus:ring-accent-bright/40 focus-within:border-accent/30 focus-within:bg-surface-3
                         ${
                           isSelected
                             ? 'border-line-2 bg-surface-4'
                             : 'border-transparent hover:bg-surface-3'
}`}
            >
              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 items-center gap-2">
                  {key.archived_at ? (
                    <Archive className="size-3 shrink-0 text-ink-quaternary" />
                  ) : (
                    <span
                      className={`size-1.5 shrink-0 rounded-full ${status.dot}`}
                    />
                  )}
                  <span
                    className={`truncate text-sm font-medium ${
                      key.archived_at
                        ? 'text-ink-secondary'
                        : 'text-ink-primary'
                    }`}
                  >
                    {key.name}
                  </span>
                  {expiryLabel && !key.archived_at && (
                    <>
                      <span className="hidden text-divider sm:inline">·</span>
                      <span
                        className={`hidden shrink-0 text-xs font-medium sm:inline ${expiryClassName}`}
                      >
                        {expiryLabel}
                      </span>
                    </>
                  )}
                  {key.archived_at && (
                    <span className="hidden shrink-0 text-xs text-ink-quaternary sm:inline">
                      · Archived {format(new Date(key.archived_at), 'MMM d')}
                    </span>
                  )}
                </div>
                <div className="mt-0.5 flex min-w-0 items-center gap-1.5 text-xs text-ink-quaternary">
                  <ProviderLogo
                    provider={providerLabel(key.provider_id, providers)}
                    className="size-3"
                  />
                  <span className="shrink-0">
                    {providerLabel(key.provider_id, providers)}
                  </span>
                  {key.description && (
                    <>
                      <span className="text-divider">·</span>
                      <span className="hidden truncate md:inline">
                        {key.description}
                      </span>
                    </>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div
                onClick={(e) => e.stopPropagation()}
                className={`flex shrink-0 items-center gap-0.5 transition-opacity duration-150
                           sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100
                           ${hoveredKeyId === key.id ? 'opacity-100' : ''}`}
              >
                {!key.archived_at && (
                  <button
                    onClick={() => handleTest(key)}
                    disabled={isTesting}
                    className="inline-flex size-7 items-center justify-center rounded-md text-ink-quaternary transition-colors duration-150 hover:bg-surface-4 hover:text-ink-primary disabled:opacity-50"
                    title={isTesting ? 'Testing...' : checkLabel}
                    aria-label={isTesting ? 'Testing key' : checkLabel}
                  >
                    {isTesting ? (
                      <span className="size-3 border-[1.5px] border-ink-primary border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Flask className="size-4" />
                    )}
                  </button>
                )}

                <button
                  onClick={() => handleCopy(key.secret, key.id)}
                  className="inline-flex size-7 items-center justify-center rounded-md text-ink-quaternary transition-colors duration-150 hover:bg-surface-4 hover:text-ink-primary"
                  title={copiedId === key.id ? 'Copied!' : 'Copy to clipboard'}
                  aria-label={
                    copiedId === key.id ? 'Copied key' : 'Copy key to clipboard'
                  }
                >
                  {copiedId === key.id ? (
                    <span className="text-xs text-success-bright font-medium">
                      ✓
                    </span>
                  ) : (
                    <Copy className="size-4" />
                  )}
                </button>

                <DropdownMenu>
                  <DropdownMenuTrigger
                    className="inline-flex size-7 items-center justify-center rounded-md text-ink-quaternary transition-colors duration-150 hover:bg-surface-4 hover:text-ink-primary"
                    aria-label="Open key actions"
                  >
                    <DotsThree className="size-4" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-44">
                    {key.archived_at ? (
                      <DropdownMenuItem onClick={() => handleRestore(key)}>
                        <ArrowCounterClockwise className="size-3.5" /> Restore
                      </DropdownMenuItem>
                    ) : (
                      <>
                        <DropdownMenuItem onClick={() => setEditingKey(key)}>
                          <PencilSimple className="size-3.5" /> Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleArchive(key)}>
                          <Archive className="size-3.5" /> Archive
                        </DropdownMenuItem>
                      </>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => setDeletingKey(key)}
                      className="text-danger focus:text-danger"
                    >
                      <Trash className="size-3.5" /> Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          );
        })}
      </div>

      {/* Edit Dialog */}
      <EditKeyDialog
        key={editingKey?.id ?? 'none'}
        editingKey={editingKey}
        onClose={() => setEditingKey(null)}
        onSave={(id, updates) => {
          updateKey(id, updates);
          setEditingKey(null);
        }}
      />

      <DeleteKeyDialog
        deletingKey={deletingKey}
        onClose={() => setDeletingKey(null)}
      />
    </>
  );
}

/* ── Inline Edit Dialog ── */

export function EditKeyDialog({
  editingKey,
  onClose,
  onSave,
}: {
  editingKey: Key | null;
  onClose: () => void;
  onSave: (id: string, patch: KeyPatch) => void;
}) {
  const view = useStore((s) => s.view);
  const providers = view?.file.providers ?? [];
  const preferences = view?.preferences;
  const [showKey, setShowKey] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const calendarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showCalendar) return;
    const handler = (e: MouseEvent) => {
      if (
        calendarRef.current &&
        !calendarRef.current.contains(e.target as Node)
      ) {
        setShowCalendar(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showCalendar]);

  const [form, setForm] = useState({
    name: editingKey?.name ?? '',
    secret: editingKey?.secret ?? '',
    provider: editingKey
      ? providerLabel(editingKey.provider_id, providers)
      : 'OpenAI',
    endpoint: editingKey?.endpoint ?? '',
    description: editingKey?.description ?? '',
    groupId: editingKey?.group_id ?? (null as string | null),
    expiry: expiryToDate(editingKey?.expiry ?? null),
  });
  const [testState, setTestState] = useState<{
    testing: boolean;
    result: TestResult | null;
  }>({
    testing: false,
    result: null,
  });

  const providerSections = getProviderSections(preferences, providers);
  const formCheckKind = checkKind(
    providerIdForLabel(form.provider, providers),
    form.endpoint,
    providers
  );
  const defaultEndpoint = getDefaultEndpointForProvider(
    form.provider,
    providers
  );

  useEffect(() => {
    if (!editingKey) return;
    const label = providerLabel(editingKey.provider_id, providers);
    const endpoint =
      editingKey.endpoint ??
      getDefaultEndpointForProvider(label, providers) ??
      '';
    setForm({
      name: editingKey.name,
      secret: editingKey.secret,
      provider: label,
      endpoint,
      description: editingKey.description,
      groupId: editingKey.group_id,
      expiry: expiryToDate(editingKey.expiry),
    });
    setTestState({ testing: false, result: null });
  }, [editingKey, providers]);

  const handleTest = async () => {
    if (!form.secret) return;
    setTestState({ testing: true, result: null });
    const result = await ApiTester.testDraft({
      providerId: providerIdForLabel(form.provider, providers),
      endpoint: form.endpoint,
      secret: form.secret,
      providers,
    });
    setTestState({ testing: false, result });
    const feedback = describeTestResult(
      result,
      form.name.trim() || form.provider
    );
    toast[result.success ? 'success' : 'error'](feedback.title, {
      description: feedback.description,
    });
  };

  const handleSave = () => {
    if (!editingKey || !form.name.trim()) return;
    if (view && hasDuplicateSecret(view, form.secret.trim(), editingKey.id)) {
      toast.error('Credential already exists', {
        description: 'A matching key value is already saved in this vault.',
      });
      return;
    }

    toast.success('Key updated', { description: form.name.trim() });
    onSave(editingKey.id, {
      name: form.name.trim(),
      secret: form.secret.trim(),
      providerId: providerIdForLabel(form.provider, providers),
      endpoint: form.endpoint,
      description: form.description,
      groupId: form.groupId,
      expiry: dateToExpiry(form.expiry),
    });

    // Auto-test on save: the edit is stored now, so the check records itself.
    if (preferences?.auto_probe_on_save) {
      void runManualCheck(editingKey.id);
    }
  };

  return (
    <Dialog
      open={editingKey !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit API Key or Token</DialogTitle>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSave();
          }}
          className="space-y-4 mt-2"
        >
          {/* Name */}
          <div className="space-y-1.5">
            <Label className="text-xs">Name</Label>
            <Input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Key name"
              required
            />
          </div>

          {/* Key Value */}
          <div className="space-y-1.5">
            <Label className="text-xs">API Key or Token</Label>
            <div className="relative">
              <AutoResizeTextarea
                value={form.secret}
                masked={!showKey}
                onChange={(e) =>
                  setForm((f) => ({ ...f, key: e.target.value }))
                }
                placeholder="sk-... or your API token"
                className="pr-9 font-mono text-sm break-all"
                autoComplete="off"
                spellCheck={false}
                required
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-2 top-2 size-6 flex items-center justify-center rounded text-ink-quaternary hover:text-ink-secondary transition-colors"
              >
                {showKey ? (
                  <EyeSlash className="size-3.5" />
                ) : (
                  <Eye className="size-3.5" />
                )}
              </button>
            </div>
          </div>

          {/* Provider */}
          <div className="space-y-1.5">
            <Label className="text-xs">Service / Provider</Label>
            <Select
              value={form.provider}
              onValueChange={(v) => {
                if (!v) return;
                const endpoint =
                  getDefaultEndpointForProvider(v, providers) ?? form.endpoint;
                setForm((f) => ({ ...f, provider: v, endpoint }));
              }}
            >
              <SelectTrigger>
                <span className="inline-flex items-center gap-1.5 truncate">
                  <ProviderLogo provider={form.provider} className="size-3.5" />
                  {form.provider}
                </span>
              </SelectTrigger>
              <SelectContent>
                {providerSections.map((section) => (
                  <SelectGroup key={section.id}>
                    <SelectLabel>{section.label}</SelectLabel>
                    {section.providers.map((p) => (
                      <SelectItem key={p} value={p}>
                        <div className="flex items-center gap-2">
                          <ProviderLogo provider={p} className="size-3.5" />
                          <span>{p}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Endpoint */}
          <div className="space-y-1.5">
            <Label className="text-xs flex items-center gap-1.5">
              Endpoint
              {defaultEndpoint && (
                <button
                  type="button"
                  onClick={() =>
                    setForm((f) => ({ ...f, endpoint: defaultEndpoint }))
                  }
                  className="text-ink-quaternary hover:text-accent-bright transition-colors"
                  title="Reset to default"
                >
                  <ArrowCounterClockwise className="size-3" />
                </button>
              )}
            </Label>
            <Input
              value={form.endpoint}
              onChange={(e) =>
                setForm((f) => ({ ...f, endpoint: e.target.value }))
              }
              placeholder="https://api.openai.com/v1"
              className="font-mono text-xs"
            />
          </div>

          {/* Expiration */}
          <div className="relative" ref={calendarRef}>
            <Label className="text-xs">Expiration</Label>
            <button
              type="button"
              onClick={() => setShowCalendar(!showCalendar)}
              className="mt-1.5 w-full inline-flex items-center gap-1.5 h-9 px-3 rounded-md text-xs font-normal border border-line bg-transparent hover:bg-surface-4 hover:text-ink-primary transition-colors justify-start text-left"
            >
              <Calendar className="size-3.5 shrink-0" />
              <span
                className={
                  !form.expiry ? 'text-ink-quaternary' : 'text-ink-secondary'
                }
              >
                {form.expiry
                  ? format(form.expiry, 'MMM d, yyyy')
                  : 'Pick a date'}
              </span>
              {form.expiry && (
                <span
                  role="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setForm((f) => ({ ...f, expires_at: undefined }));
                  }}
                  className="ml-auto text-ink-quaternary hover:text-ink-secondary"
                >
                  <X className="size-3" />
                </span>
              )}
            </button>
            {showCalendar && (
              <div className="absolute top-full left-0 mt-1 z-50 rounded-lg border border-line bg-canvas-raised shadow-elevated">
                <DayPicker
                  value={form.expiry}
                  onChange={(d) => {
                    setForm((f) => ({ ...f, expires_at: d }));
                    setShowCalendar(false);
                  }}
                />
              </div>
            )}
          </div>

          {/* Group */}
          <div className="space-y-1.5">
            <Label className="text-xs">Group</Label>
            <GroupSelect
              groups={view ? sortedGroups(view) : []}
              value={form.groupId}
              onChange={(groupId) => setForm((f) => ({ ...f, groupId }))}
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label className="text-xs">Description</Label>
            <Input
              value={form.description}
              onChange={(e) =>
                setForm((f) => ({ ...f, description: e.target.value }))
              }
              placeholder="What is this credential used for?"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 pt-2">
            <Button type="submit" size="sm">
              <FloppyDisk className="size-3.5" />
              Save Changes
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleTest}
              disabled={!form.secret || testState.testing}
              title={getTestActionHint(formCheckKind)}
            >
              {testState.testing ? (
                <Spinner className="size-3.5 animate-spin" />
              ) : (
                <Flask className="size-3.5" />
              )}
              {getTestActionLabel(formCheckKind)}
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={onClose}>
              <X className="size-3.5" />
              Cancel
            </Button>
          </div>

          {formCheckKind !== 'credential' && (
            <p className="text-[11px] leading-relaxed text-ink-quaternary">
              {getTestActionHint(formCheckKind)}
            </p>
          )}
        </form>
      </DialogContent>
    </Dialog>
  );
}
