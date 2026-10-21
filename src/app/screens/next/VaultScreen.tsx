/**
 * The unlocked view: reminders, what is currently silenced, and the key panel.
 *
 * Reminders are computed, so this screen only decides how to present them. The
 * "silenced" list exists because a dismissal that cannot be seen or undone is a
 * one-way door.
 */

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useVault } from '@/app/store/next-vault';
import type { Reminder } from '@/core/reminders';
import type {
  BusinessDismissal,
  ObservationDismissal,
} from '@/core/runtime/dismissals';
import { KeysPanel } from './KeysPanel';

export function VaultScreen() {
  const payload = useVault((state) => state.payload);
  const fileName = useVault((state) => state.fileName);
  const saveState = useVault((state) => state.saveState);
  const reminders = useVault((state) => state.reminders);
  const error = useVault((state) => state.error);

  const [silenced, setSilenced] = useState<{
    business: BusinessDismissal[];
    observation: ObservationDismissal[];
  } | null>(null);

  useEffect(() => {
    void useVault.getState().refreshReminders();
  }, []);

  if (!payload) return null;

  const showSilenced = async () => {
    const session = useVault.getState().session;
    if (!session) return;
    setSilenced(await session.dismissed());
  };

  const restoreBusiness = async (dismissal: BusinessDismissal) => {
    await useVault.getState().restore({
      kind: 'business',
      ...dismissal,
    } as Reminder);
    setSilenced(null);
  };

  const restoreObservation = async (dismissal: ObservationDismissal) => {
    await useVault.getState().restore({
      kind: 'observation',
      ...dismissal,
    } as Reminder);
    setSilenced(null);
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
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-ink-primary">
            Reminders ({reminders.length})
          </h2>
          <Button size="sm" variant="ghost" onClick={() => void showSilenced()}>
            Silenced
          </Button>
        </div>

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
                  {nameOf(payload.keys, entry.keyId)} · {entry.fact}
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

        {silenced && (
          <div className="space-y-1 rounded-md border border-line bg-surface-4 p-3 text-xs">
            <p className="text-ink-primary">Silenced on this device</p>
            {silenced.business.length === 0 &&
              silenced.observation.length === 0 && (
                <p className="text-ink-secondary">Nothing is silenced.</p>
              )}
            {silenced.business.map((dismissal) => (
              <div
                key={`b:${dismissal.key_id}:${dismissal.rule}`}
                className="flex items-center justify-between gap-2"
              >
                <span className="text-ink-secondary">
                  {labelForRule(dismissal.rule)} ·{' '}
                  {nameOf(payload.keys, dismissal.key_id)} ·{' '}
                  {dismissal.condition}
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => void restoreBusiness(dismissal)}
                >
                  Restore
                </Button>
              </div>
            ))}
            {silenced.observation.map((dismissal) => (
              <div
                key={`o:${dismissal.key_id}:${dismissal.rule}`}
                className="flex items-center justify-between gap-2"
              >
                <span className="text-ink-secondary">
                  {labelForRule(dismissal.rule)} ·{' '}
                  {nameOf(payload.keys, dismissal.key_id)}
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => void restoreObservation(dismissal)}
                >
                  Restore
                </Button>
              </div>
            ))}
          </div>
        )}
      </section>

      <KeysPanel />
    </main>
  );
}

function nameOf(
  keys: readonly { id: string; name: string }[],
  keyId: string
): string {
  return keys.find((key) => key.id === keyId)?.name ?? keyId;
}

function labelFor(reminder: Reminder): string {
  return labelForRule(reminder.rule);
}

function labelForRule(rule: Reminder['rule']): string {
  switch (rule) {
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
