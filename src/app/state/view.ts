/**
 * The vault as the screens read it.
 *
 * One snapshot per refresh: the v2 payload, this device's latest observation
 * per key, the reminder rows derived from both, and the preferences that decide
 * what a screen offers. Nothing here is written back, and nothing is stored in
 * a second shape: the fields are the payload's own, and only the verdicts and
 * labels a screen shows are computed.
 */

import type { Group, Key, KeyaFile, Provider } from '../../core/payload/types';
import type { Observation } from '../../core/runtime/observations';
import type { KeyBinding } from '../runtime/binding';
import type {
  BusinessDismissal,
  ObservationDismissal,
} from '../../core/runtime/dismissals';
import type { Reminder } from '../../core/reminders';
import { businessAlerts, observationAlerts } from '../../core/reminders';
import type { Preferences } from '../storage/local/state';
import {
  checkStatus,
  daysSince,
  daysUntilExpiry,
  describeFailure,
  expiryVerdict,
  type CheckStatus,
  type ExpiryStatus,
} from './presentation';

export interface VaultView {
  file: KeyaFile;
  vaultId: string;
  preferences: Preferences;
  now: Date;
  timeZone: string;
  /** Latest observation per key, under the binding it was recorded for. */
  checks: Map<string, Observation>;
  /** Current binding and plan per key whose provider can be checked at all. */
  bindings: Map<string, KeyBinding>;
  /** Every reminder the current state produces, dismissed or not. */
  reminders: ReminderRow[];
}

/** A reminder plus the key it is about and whether it was put away. */
export interface ReminderRow {
  reminder: Reminder;
  key: Key;
  dismissed: boolean;
}

export interface ViewInput {
  file: KeyaFile;
  preferences: Preferences;
  now: Date;
  timeZone: string;
  checks: Map<string, Observation>;
  bindings: Map<string, KeyBinding>;
  dismissals: {
    business: BusinessDismissal[];
    observation: ObservationDismissal[];
  };
}

export function buildVaultView(input: ViewInput): VaultView {
  const { file } = input;
  const byId = new Map(file.keys.map((key) => [key.id, key]));

  const dismissedBusiness = new Set(
    input.dismissals.business.map(
      (entry) => `${entry.key_id}|${entry.rule}|${entry.condition}`
    )
  );
  const dismissedObservation = new Set(
    input.dismissals.observation.map(
      (entry) => `${entry.key_id}|${entry.rule}|${entry.binding}`
    )
  );

  const business = businessAlerts(file, {
    now: input.now,
    timeZone: input.timeZone,
  });
  const observation = observationAlerts(
    file,
    (key) => input.bindings.get(key.id)?.binding ?? null,
    [...input.checks.values()],
    { now: input.now, timeZone: input.timeZone }
  );

  const reminders: ReminderRow[] = [];
  for (const reminder of [...business, ...observation]) {
    const key = byId.get(reminder.key_id);
    if (!key) continue;

    const dismissed =
      reminder.kind === 'business'
        ? dismissedBusiness.has(
            `${reminder.key_id}|${reminder.rule}|${reminder.condition}`
          )
        : dismissedObservation.has(
            `${reminder.key_id}|${reminder.rule}|${reminder.binding}`
          );

    reminders.push({ reminder, key, dismissed });
  }

  return {
    file,
    vaultId: file.vault.id,
    preferences: input.preferences,
    now: input.now,
    timeZone: input.timeZone,
    checks: input.checks,
    bindings: input.bindings,
    reminders,
  };
}

// ── selectors ────────────────────────────────────────────────────────────────

export function activeKeys(view: VaultView): Key[] {
  return view.file.keys.filter((key) => key.archived_at === null);
}

export function archivedKeys(view: VaultView): Key[] {
  return view.file.keys
    .filter((key) => key.archived_at !== null)
    .sort((left, right) => {
      const delta =
        Date.parse(right.archived_at ?? '') -
        Date.parse(left.archived_at ?? '');
      return delta !== 0
        ? delta
        : Date.parse(right.content_updated_at) -
            Date.parse(left.content_updated_at);
    });
}

export function keyById(view: VaultView, id: string): Key | undefined {
  return view.file.keys.find((key) => key.id === id);
}

export function sortedGroups(view: VaultView): Group[] {
  return [...view.file.groups].sort((left, right) => left.order - right.order);
}

export function providers(view: VaultView): Provider[] {
  return view.file.providers;
}

export function searchKeys(keys: readonly Key[], query: string): Key[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [...keys];
  return keys.filter(
    (key) =>
      key.name.toLowerCase().includes(needle) ||
      key.description.toLowerCase().includes(needle) ||
      key.secret.toLowerCase().includes(needle) ||
      key.endpoint?.toLowerCase().includes(needle) === true
  );
}

/** A secret already in the vault cannot be added twice while it is live. */
export function hasDuplicateSecret(
  view: VaultView,
  secret: string,
  excludeKeyId?: string
): boolean {
  return view.file.keys.some(
    (key) =>
      key.archived_at === null &&
      key.secret === secret &&
      key.id !== excludeKeyId
  );
}

export interface KeyCheck {
  status: CheckStatus;
  observation: Observation | undefined;
  /** Whether the provider can be checked from a browser at all. */
  checkable: boolean;
  kind: 'credential' | 'request' | 'unverifiable';
}

export function checkOf(view: VaultView, key: Key): KeyCheck {
  const observation = view.checks.get(key.id);
  const binding = view.bindings.get(key.id);
  const checkable = binding !== undefined;

  return {
    status: checkStatus(observation),
    observation,
    checkable,
    kind: binding ? binding.plan.verifies : 'unverifiable',
  };
}

export interface KeyExpiry {
  status: ExpiryStatus;
  days: number | null;
}

export function expiryOf(view: VaultView, key: Key): KeyExpiry {
  return {
    status: expiryVerdict(key.expiry, view.now, view.timeZone),
    days: daysUntilExpiry(key.expiry, view.now, view.timeZone),
  };
}

export interface ReminderDisplay {
  keyName: string;
  provider: string;
  expiryDay: string | null;
  daysUntilExpiry: number | null;
  checkedAt: string | null;
  failureText: string | null;
  endpoint: string | null;
  daysSinceCheck: number | null;
}

/** The values a reminder row prints, derived once so rows stay dumb. */
export function reminderDisplay(
  view: VaultView,
  row: ReminderRow,
  providerOf: (key: Key) => string
): ReminderDisplay {
  const observation = view.checks.get(row.key.id);

  return {
    keyName: row.key.name,
    provider: providerOf(row.key),
    expiryDay: row.key.expiry?.value ?? null,
    daysUntilExpiry: daysUntilExpiry(row.key.expiry, view.now, view.timeZone),
    checkedAt: observation?.finished_at ?? null,
    failureText: describeFailure(observation),
    endpoint:
      row.reminder.rule === 'insecure_endpoint' ? row.key.endpoint : null,
    daysSinceCheck: daysSince(observation?.finished_at ?? null, view.now),
  };
}
