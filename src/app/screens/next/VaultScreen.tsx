/**
 * The unlocked view for the v2 stack.
 *
 * Shows the three things worth proving at this stage: reminders computed from
 * the payload, the recipe state of each key (including the ones that cannot run
 * at all), and a probe that goes through the authorization gate.
 */

import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useVault } from '@/app/store/next-vault';
import { classifyRecipe } from '@/core/presets/classify';
import type { Reminder } from '@/core/reminders';
import type { CheckOutcome } from '@/app/probe/check';
import { expiryStatus } from '@/core/time/expiry';

export function VaultScreen() {
  const payload = useVault((state) => state.payload);
  const fileName = useVault((state) => state.fileName);
  const saveState = useVault((state) => state.saveState);
  const reminders = useVault((state) => state.reminders);
  const error = useVault((state) => state.error);

  const [outcomes, setOutcomes] = useState<Record<string, string>>({});
  const [disclosed, setDisclosed] = useState<string | null>(null);

  useEffect(() => {
    void useVault.getState().refreshReminders();
  }, []);

  const states = useMemo(() => {
    if (!payload) return new Map();
    return new Map(
      payload.keys.map((key) => [
        key.id,
        classifyRecipe(
          { provider_id: key.provider_id, endpoint: key.endpoint },
          payload.providers
        ),
      ])
    );
  }, [payload]);

  if (!payload) return null;

  const probe = async (keyId: string, mode: 'manual' | 'automatic') => {
    const session = useVault.getState().session;
    if (!session) return;

    const outcome = await session.probe(keyId, mode);
    if (outcome.status === 'needs_authorization') {
      setDisclosed(outcome.fingerprint);
      return;
    }
    setOutcomes((previous) => ({ ...previous, [keyId]: describe(outcome) }));
    await useVault.getState().refreshReminders();
  };

  const approve = async (keyId: string, remember: boolean) => {
    const session = useVault.getState().session;
    if (!session) return;
    if (remember) await session.grant(keyId);
    else await session.approveOnce(keyId);
    setDisclosed(null);
    await probe(keyId, 'manual');
  };

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-8">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-ink-primary">
            {payload.vault.icon} {payload.vault.name}
          </h1>
          <p className="text-xs text-ink-secondary">
            {fileName} · {payload.keys.length} keys · save: {saveState}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="ghost"
            onClick={() => void useVault.getState().save()}
          >
            Save
          </Button>
          <Button
            variant="ghost"
            onClick={() => void useVault.getState().lock()}
          >
            Lock
          </Button>
        </div>
      </header>

      {error && <p className="text-xs text-danger">{error}</p>}

      <section className="space-y-2">
        <h2 className="text-sm font-medium text-ink-primary">
          Reminders ({reminders.length})
        </h2>
        {reminders.length === 0 && (
          <p className="text-xs text-ink-secondary">Nothing to report.</p>
        )}
        <ul className="space-y-1">
          {reminders.map((entry) => (
            <li
              key={`${entry.reminder.rule}:${entry.keyId}:${entry.fact}`}
              className="flex items-center justify-between rounded-md border border-line bg-surface-2 px-3 py-2 text-sm"
            >
              <span className="text-ink-primary">
                {labelFor(entry.reminder)}{' '}
                <span className="text-xs text-ink-secondary">
                  {keyName(payload.keys, entry.keyId)} · {entry.fact}
                </span>
              </span>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => void useVault.getState().dismiss(entry.reminder)}
              >
                Dismiss
              </Button>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-medium text-ink-primary">Keys</h2>
        <ul className="space-y-1">
          {payload.keys.map((key) => {
            const state = states.get(key.id);
            return (
              <li
                key={key.id}
                className="rounded-md border border-line bg-surface-2 px-3 py-2 text-sm"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-ink-primary">
                      {key.name}
                      {key.archived_at ? ' (archived)' : ''}
                    </p>
                    <p className="truncate text-xs text-ink-secondary">
                      {recipeLabel(state)} · {key.endpoint ?? 'no endpoint'}
                      {key.expiry
                        ? ` · ${expiryStatus(key.expiry, new Date(), timeZone())}`
                        : ''}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={!state || state.kind === 'not_executable'}
                    onClick={() => void probe(key.id, 'automatic')}
                  >
                    Check
                  </Button>
                </div>

                {outcomes[key.id] && (
                  <p className="pt-1 text-xs text-ink-secondary">
                    {outcomes[key.id]}
                  </p>
                )}

                {disclosed && (
                  <div className="mt-2 rounded-md border border-line bg-surface-4 p-2 text-xs">
                    <p className="text-ink-primary">
                      This request needs your approval.
                    </p>
                    {state && state.kind !== 'not_executable' && (
                      <p className="text-ink-secondary">
                        Destination: {state.plan.resolvedHref}
                      </p>
                    )}
                    <div className="flex gap-2 pt-2">
                      <Button
                        size="sm"
                        onClick={() => void approve(key.id, true)}
                      >
                        Always allow this destination
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => void approve(key.id, false)}
                      >
                        Just once
                      </Button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </section>
    </main>
  );
}

function timeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
}

function keyName(
  keys: readonly { id: string; name: string }[],
  keyId: string
): string {
  return keys.find((key) => key.id === keyId)?.name ?? keyId;
}

function labelFor(reminder: Reminder): string {
  switch (reminder.rule) {
    case 'expiry_upcoming':
      return 'Expires soon';
    case 'expiry_expired':
      return 'Expired';
    case 'insecure_endpoint':
      return 'Plaintext destination';
    case 'never_probed':
      return 'Never checked on this device';
    case 'probe_failed':
      return 'Last check failed';
    case 'probe_stale':
      return 'Last check is old';
  }
}

function recipeLabel(
  state: ReturnType<typeof classifyRecipe> | undefined
): string {
  if (!state) return 'unknown';
  if (state.kind === 'auto') return 'automatic';
  if (state.kind === 'manual_only') return 'manual only (plaintext)';
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

function describe(outcome: CheckOutcome): string {
  if (outcome.status === 'observed') {
    return `${outcome.observation.kind}/${outcome.observation.outcome}`;
  }
  if (outcome.status === 'discarded')
    return 'discarded (configuration changed)';
  if (outcome.status === 'skipped') return `skipped: ${outcome.reason}`;
  if (outcome.status === 'not_executable')
    return `not executable: ${outcome.reason}`;
  return outcome.status;
}
