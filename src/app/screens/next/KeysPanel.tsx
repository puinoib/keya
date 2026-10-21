/**
 * Key management for the v2 stack: list, detail, create and edit.
 *
 * The screen never decides legality. It builds a `Key` and hands it to the
 * store, which runs the edit transaction and classifies the recipe; whatever is
 * rejected comes back as an error string.
 */

import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useVault } from '@/app/store/next-vault';
import { findPreset, PRESETS } from '@/core/presets/data';
import { classifyRecipe, type RecipePlan } from '@/core/presets/classify';
import { expiryStatus } from '@/core/time/expiry';
import type { CheckOutcome } from '@/app/probe/check';
import { MAX_KEYS } from '@/core/payload/limits';
import type { Expiry } from '@/core/time/expiry';
import type { Key, Provider } from '@/core/payload/types';

type ExpiryKind = 'none' | 'date' | 'instant';

interface Draft {
  id: string | null;
  name: string;
  description: string;
  providerId: string;
  endpoint: string;
  secret: string;
  groupId: string;
  expiryKind: ExpiryKind;
  expiryValue: string;
}

const emptyDraft = (): Draft => ({
  id: null,
  name: '',
  description: '',
  providerId: '',
  endpoint: '',
  secret: '',
  groupId: '',
  expiryKind: 'none',
  expiryValue: '',
});

function draftFrom(key: Key): Draft {
  return {
    id: key.id,
    name: key.name,
    description: key.description,
    providerId: key.provider_id ?? '',
    endpoint: key.endpoint ?? '',
    secret: key.secret,
    groupId: key.group_id ?? '',
    expiryKind: key.expiry?.kind ?? 'none',
    expiryValue: key.expiry?.value ?? '',
  };
}

export function KeysPanel() {
  const payload = useVault((state) => state.payload);
  const error = useVault((state) => state.error);
  const saveState = useVault((state) => state.saveState);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [checkResult, setCheckResult] = useState<string | null>(null);
  const [pending, setPending] = useState<RecipePlan | null>(null);

  const presets = useMemo(
    () =>
      PRESETS.map((preset) => ({
        id: `preset:${preset.slug}`,
        label: preset.label,
      })),
    []
  );

  if (!payload) return null;

  const active = payload.keys.filter((key) => key.archived_at === null);
  const archived = payload.keys.filter((key) => key.archived_at !== null);
  const selected = payload.keys.find((key) => key.id === selectedId) ?? null;

  const providerLabel = (id: string | null): string => {
    if (!id) return 'unassigned';
    if (id.startsWith('preset:')) {
      return (
        findPreset(id.slice('preset:'.length))?.label ?? 'unknown provider'
      );
    }
    return (
      payload.providers.find((entry) => entry.id === id)?.name ??
      'deleted provider'
    );
  };

  const save = async () => {
    if (!draft) return;
    if (!draft.name.trim()) {
      setNotice('A name is required.');
      return;
    }
    if (!draft.secret) {
      setNotice('A secret is required.');
      return;
    }

    const existing = draft.id
      ? payload.keys.find((key) => key.id === draft.id)
      : undefined;
    const now = new Date().toISOString();

    let expiry: Expiry | null = null;
    if (draft.expiryKind !== 'none') {
      if (!draft.expiryValue.trim()) {
        setNotice('Set a date or an instant, or choose "no expiry".');
        return;
      }
      expiry = { kind: draft.expiryKind, value: draft.expiryValue.trim() };
    }

    const key: Key = {
      id: existing?.id ?? crypto.randomUUID(),
      name: draft.name.trim(),
      description: draft.description,
      provider_id: draft.providerId || null,
      endpoint: draft.endpoint.trim() || null,
      secret: draft.secret.trim(),
      group_id: draft.groupId || null,
      expiry,
      archived_at: existing?.archived_at ?? null,
      created_at: existing?.created_at ?? now,
      content_updated_at: now,
    };

    setNotice(null);
    await useVault.getState().saveKey(key);
    if (useVault.getState().error) return;
    setDraft(null);
    setSelectedId(key.id);
    await useVault.getState().save();
  };

  const recipeState = selected
    ? classifyRecipe(
        { provider_id: selected.provider_id, endpoint: selected.endpoint },
        payload.providers
      )
    : null;

  const check = async (keyId: string) => {
    const session = useVault.getState().session;
    if (!session) return;
    setCheckResult(null);

    const outcome = await session.probe(keyId, 'automatic');
    if (outcome.status === 'needs_authorization') {
      setPending(outcome.plan);
      return;
    }
    setCheckResult(describeOutcome(outcome));
    await useVault.getState().refreshReminders();
  };

  const approve = async (remember: boolean) => {
    const session = useVault.getState().session;
    if (!session || !selected) return;
    if (remember) await session.grant(selected.id);
    else await session.approveOnce(selected.id);
    setPending(null);
    await check(selected.id);
  };

  const remove = async (keyId: string) => {
    await useVault.getState().removeKey(keyId);
    if (useVault.getState().error) return;
    if (selectedId === keyId) setSelectedId(null);
    await useVault.getState().save();
  };

  const toggleArchive = async (key: Key) => {
    await useVault.getState().archiveKey(key.id, key.archived_at === null);
    if (useVault.getState().error) return;
    await useVault.getState().save();
  };

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-medium text-ink-primary">
          Keys{' '}
          <span className="text-xs font-normal text-ink-secondary">
            {active.length} active · {archived.length} archived · quota{' '}
            {payload.keys.length}/{MAX_KEYS}
          </span>
        </h2>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setDraft(emptyDraft());
              setNotice(null);
            }}
          >
            New key
          </Button>
        </div>
      </div>

      {payload.keys.length >= MAX_KEYS && (
        <p className="text-xs text-danger">
          The key quota is exhausted, and archived keys count toward it. Delete
          entries you no longer need.
        </p>
      )}

      <ul className="space-y-1">
        {[...active, ...archived].map((key) => {
          const state = classifyRecipe(
            { provider_id: key.provider_id, endpoint: key.endpoint },
            payload.providers
          );
          return (
            <li key={key.id}>
              <button
                type="button"
                onClick={() => {
                  setSelectedId(key.id);
                  setDraft(null);
                  setRevealed(false);
                }}
                className={`w-full rounded-md border px-3 py-2 text-left text-sm ${
                  selectedId === key.id
                    ? 'border-accent bg-surface-4'
                    : 'border-line bg-surface-2'
                }`}
              >
                <span className="font-medium text-ink-primary">
                  {key.name}
                  {key.archived_at ? ' (archived)' : ''}
                </span>
                <span className="ml-2 text-xs text-ink-secondary">
                  {providerLabel(key.provider_id)} · {recipeLabel(state)}
                  {key.expiry ? ` · ${expiryLabel(key.expiry)}` : ''}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      {(notice || error) && (
        <p className="text-xs text-danger">{notice ?? error}</p>
      )}

      {selected && !draft && (
        <article className="space-y-2 rounded-md border border-line bg-surface-2 p-4 text-sm">
          <header className="flex items-start justify-between gap-3">
            <div>
              <h3 className="font-medium text-ink-primary">{selected.name}</h3>
              <p className="text-xs text-ink-secondary">
                {providerLabel(selected.provider_id)} ·{' '}
                {selected.endpoint ?? 'no endpoint'}
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setDraft(draftFrom(selected))}
              >
                Edit
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => void toggleArchive(selected)}
              >
                {selected.archived_at ? 'Restore' : 'Archive'}
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => void remove(selected.id)}
              >
                Delete
              </Button>
            </div>
          </header>

          {selected.description && (
            <p className="whitespace-pre-wrap text-xs text-ink-secondary">
              {selected.description}
            </p>
          )}

          <dl className="grid grid-cols-[8rem_1fr] gap-1 text-xs">
            <dt className="text-ink-secondary">Secret</dt>
            <dd className="flex items-center gap-2">
              <code className="truncate text-ink-primary">
                {revealed ? selected.secret : mask(selected.secret)}
              </code>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setRevealed((v) => !v)}
              >
                {revealed ? 'Hide' : 'Reveal'}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() =>
                  void navigator.clipboard.writeText(selected.secret)
                }
              >
                Copy
              </Button>
            </dd>

            <dt className="text-ink-secondary">Expiry</dt>
            <dd className="text-ink-primary">{expiryLabel(selected.expiry)}</dd>

            <dt className="text-ink-secondary">Group</dt>
            <dd className="text-ink-primary">
              {payload.groups.find((group) => group.id === selected.group_id)
                ?.name ?? 'ungrouped'}
            </dd>

            <dt className="text-ink-secondary">Created</dt>
            <dd className="text-ink-primary">{selected.created_at}</dd>

            <dt className="text-ink-secondary">Updated</dt>
            <dd className="text-ink-primary">{selected.content_updated_at}</dd>
          </dl>

          <div className="space-y-2 border-t border-line pt-2">
            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                variant="ghost"
                disabled={!recipeState || recipeState.kind === 'not_executable'}
                onClick={() => void check(selected.id)}
              >
                Check now
              </Button>
              {checkResult && (
                <span className="text-xs text-ink-secondary">
                  {checkResult}
                </span>
              )}
            </div>

            {pending && (
              <div className="rounded-md border border-line bg-surface-4 p-2 text-xs">
                <p className="text-ink-primary">
                  Sending the secret needs your approval.
                </p>
                <p className="text-ink-secondary">
                  Destination: {pending.resolvedHref}
                </p>
                <p className="text-ink-secondary">
                  Method: GET · credential in{' '}
                  {pending.auth.mode === 'query'
                    ? `query parameter "${pending.auth.param}"`
                    : pending.auth.mode === 'header'
                      ? `header "${pending.auth.name}"`
                      : 'the Authorization header'}
                </p>
                <div className="flex gap-2 pt-2">
                  <Button size="sm" onClick={() => void approve(true)}>
                    Always allow this destination
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => void approve(false)}
                  >
                    Just once
                  </Button>
                </div>
              </div>
            )}
          </div>

          <p className="text-xs text-ink-secondary">save: {saveState}</p>
        </article>
      )}

      {draft && (
        <article className="space-y-2 rounded-md border border-line bg-surface-2 p-4 text-sm">
          <h3 className="font-medium text-ink-primary">
            {draft.id ? 'Edit key' : 'New key'}
          </h3>

          <Label htmlFor="key-name">Name</Label>
          <Input
            id="key-name"
            value={draft.name}
            onChange={(event) =>
              setDraft({ ...draft, name: event.target.value })
            }
          />

          <Label htmlFor="key-description">Description</Label>
          <Input
            id="key-description"
            value={draft.description}
            onChange={(event) =>
              setDraft({ ...draft, description: event.target.value })
            }
          />

          <Label htmlFor="key-provider">Provider</Label>
          <select
            id="key-provider"
            className="h-9 w-full rounded-md border border-line bg-surface-4 px-2 text-sm text-ink-primary"
            value={draft.providerId}
            onChange={(event) => {
              const providerId = event.target.value;
              setDraft({
                ...draft,
                providerId,
                // Copy the provider default only when creating, never on edit.
                endpoint:
                  draft.endpoint ||
                  defaultEndpointFor(providerId, payload.providers),
              });
            }}
          >
            <option value="">Unassigned</option>
            {presets.map((preset) => (
              <option key={preset.id} value={preset.id}>
                {preset.label}
              </option>
            ))}
            {payload.providers.map((provider) => (
              <option key={provider.id} value={provider.id}>
                {provider.name}
              </option>
            ))}
          </select>

          <Label htmlFor="key-endpoint">
            Endpoint (base address, no query)
          </Label>
          <Input
            id="key-endpoint"
            value={draft.endpoint}
            placeholder="https://api.example.com/v1"
            onChange={(event) =>
              setDraft({ ...draft, endpoint: event.target.value })
            }
          />

          <Label htmlFor="key-secret">Secret</Label>
          <Input
            id="key-secret"
            value={draft.secret}
            onChange={(event) =>
              setDraft({ ...draft, secret: event.target.value })
            }
          />

          <Label htmlFor="key-group">Group</Label>
          <select
            id="key-group"
            className="h-9 w-full rounded-md border border-line bg-surface-4 px-2 text-sm text-ink-primary"
            value={draft.groupId}
            onChange={(event) =>
              setDraft({ ...draft, groupId: event.target.value })
            }
          >
            <option value="">Ungrouped</option>
            {payload.groups.map((group) => (
              <option key={group.id} value={group.id}>
                {group.name}
              </option>
            ))}
          </select>

          <Label htmlFor="key-expiry-kind">Expiry</Label>
          <div className="flex gap-2">
            <select
              id="key-expiry-kind"
              className="h-9 rounded-md border border-line bg-surface-4 px-2 text-sm text-ink-primary"
              value={draft.expiryKind}
              onChange={(event) =>
                setDraft({
                  ...draft,
                  expiryKind: event.target.value as ExpiryKind,
                })
              }
            >
              <option value="none">No expiry</option>
              <option value="date">A calendar day</option>
              <option value="instant">An exact instant</option>
            </select>
            {draft.expiryKind !== 'none' && (
              <Input
                value={draft.expiryValue}
                placeholder={
                  draft.expiryKind === 'date'
                    ? '2026-12-01'
                    : '2026-12-01T00:00:00.000Z'
                }
                onChange={(event) =>
                  setDraft({ ...draft, expiryValue: event.target.value })
                }
              />
            )}
          </div>
          <p className="text-xs text-ink-secondary">
            A calendar day expires at the end of that day in this device's
            timezone; an instant is the same everywhere.
          </p>

          <div className="flex gap-2 pt-1">
            <Button onClick={() => void save()}>Save</Button>
            <Button variant="ghost" onClick={() => setDraft(null)}>
              Cancel
            </Button>
          </div>
        </article>
      )}
    </section>
  );
}

function defaultEndpointFor(
  providerId: string,
  providers: readonly Provider[]
): string {
  if (providerId.startsWith('preset:')) {
    const preset = findPreset(providerId.slice('preset:'.length));
    return preset?.defaultEndpoint ?? '';
  }
  const provider = providers.find((entry) => entry.id === providerId);
  return provider?.default_endpoint ?? '';
}

function mask(secret: string): string {
  if (secret.length <= 8) return '••••••••';
  return `${secret.slice(0, 4)}••••${secret.slice(-4)}`;
}

function expiryLabel(expiry: Expiry | null): string {
  if (!expiry) return 'no expiry';
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  const status = expiryStatus(expiry, new Date(), timeZone);
  return `${expiry.value} · ${status}`;
}

function recipeLabel(state: ReturnType<typeof classifyRecipe>): string {
  if (state.kind === 'auto') return 'checkable';
  if (state.kind === 'manual_only') return 'manual only';
  switch (state.reason) {
    case 'capability_missing':
      return 'cannot be checked';
    case 'missing_endpoint':
      return 'needs an endpoint';
    case 'invalid_target':
      return 'invalid target';
    case 'unknown_preset':
      return 'unknown provider';
  }
}

function describeOutcome(outcome: CheckOutcome): string {
  switch (outcome.status) {
    case 'observed':
      return `${outcome.observation.kind}/${outcome.observation.outcome}`;
    case 'discarded':
      return 'discarded: the key changed while the request was in flight';
    case 'skipped':
      return `skipped: ${outcome.reason}`;
    case 'not_executable':
      return `cannot check: ${outcome.reason}`;
    case 'no_key':
      return 'this key no longer exists';
    case 'needs_authorization':
      return 'needs approval';
  }
}
