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
import type { RecipeState } from '../../core/presets/classify';
import { classifyRecipe } from '../../core/presets/classify';
import { providerLabel } from './providers';
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
  /** Recipe state per key, including the ones that cannot run at all. */
  recipes: Map<string, RecipeState>;
  /** `send_fingerprint` values this device has approved permanently. */
  grants: Set<string>;
  /** Every reminder the current state produces, dismissed or not. */
  reminders: ReminderRow[];
}

/** The rules an Inbox row can carry, in the order the list knows them. */
export type InboxRule =
  | 'expiry_upcoming'
  | 'expiry_expired'
  | 'insecure_endpoint'
  | 'never_probed'
  | 'probe_failed'
  | 'probe_stale';

/** A reminder plus the key it is about and whether it was put away. */
export interface ReminderRow {
  reminder: Reminder;
  key: Key;
  dismissed: boolean;
  /** When the dismissal was recorded, for the archived list. */
  dismissedAt: string | null;
  /** The check result behind the row, or the refresh time for business rows. */
  stamp: string;
}

export interface ViewInput {
  file: KeyaFile;
  preferences: Preferences;
  now: Date;
  timeZone: string;
  checks: Map<string, Observation>;
  bindings: Map<string, KeyBinding>;
  grants: Set<string>;
  dismissals: {
    business: BusinessDismissal[];
    observation: ObservationDismissal[];
  };
}

export function buildVaultView(input: ViewInput): VaultView {
  const { file } = input;
  const byId = new Map(file.keys.map((key) => [key.id, key]));
  const recipes = new Map<string, RecipeState>();
  for (const key of file.keys) {
    recipes.set(
      key.id,
      classifyRecipe(
        { provider_id: key.provider_id, endpoint: key.endpoint },
        file.providers
      )
    );
  }

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

    const businessKey = `${reminder.key_id}|${reminder.rule}|${
      reminder.kind === 'business' ? reminder.condition : reminder.binding
    }`;
    const dismissed =
      reminder.kind === 'business'
        ? dismissedBusiness.has(businessKey)
        : dismissedObservation.has(businessKey);
    const dismissedAt = dismissed
      ? ((reminder.kind === 'business'
          ? input.dismissals.business.find(
              (entry) =>
                entry.key_id === reminder.key_id &&
                entry.rule === reminder.rule &&
                entry.condition === reminder.condition
            )?.dismissed_at
          : input.dismissals.observation.find(
              (entry) =>
                entry.key_id === reminder.key_id &&
                entry.rule === reminder.rule &&
                entry.binding === reminder.binding
            )?.dismissed_at) ?? null)
      : null;

    reminders.push({
      reminder,
      key,
      dismissed,
      dismissedAt,
      stamp:
        reminder.kind === 'observation'
          ? (input.checks.get(key.id)?.finished_at ?? input.now.toISOString())
          : input.now.toISOString(),
    });
  }

  return {
    file,
    vaultId: file.vault.id,
    preferences: input.preferences,
    now: input.now,
    timeZone: input.timeZone,
    checks: input.checks,
    bindings: input.bindings,
    recipes,
    grants: input.grants,
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
  return [...view.file.groups].sort(
    (left, right) =>
      left.order - right.order ||
      (left.id < right.id ? -1 : left.id > right.id ? 1 : 0)
  );
}

export function providers(view: VaultView): Provider[] {
  return view.file.providers;
}

export function searchKeys(
  view: VaultView,
  keys: readonly Key[],
  query: string
): Key[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [...keys];
  return keys.filter(
    (key) =>
      key.name.toLowerCase().includes(needle) ||
      key.description.toLowerCase().includes(needle) ||
      providerLabel(key.provider_id, view.file.providers)
        .toLowerCase()
        .includes(needle)
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
  /** The recipe's own state, including why it cannot run. */
  recipe: RecipeState | undefined;
  /** `http:` targets can only ever be approved one request at a time (I7). */
  manualOnly: boolean;
  /** Executable, but this device has no standing consent for the request. */
  needsAuthorization: boolean;
}

export function checkOf(view: VaultView, key: Key): KeyCheck {
  const observation = view.checks.get(key.id);
  const binding = view.bindings.get(key.id);
  const checkable = binding !== undefined;
  const recipe = view.recipes.get(key.id);
  const manualOnly = recipe?.kind === 'manual_only';

  return {
    status: checkStatus(observation),
    observation,
    checkable,
    kind: binding ? binding.plan.verifies : 'unverifiable',
    recipe,
    manualOnly,
    needsAuthorization:
      binding !== undefined && !manualOnly && !view.grants.has(binding.send),
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
