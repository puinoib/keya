/**
 * Reminder evaluation (§10.3).
 *
 * Reminders are computed, never stored. The only persisted decisions are the
 * dismissal records, and they are compared by fact fingerprint, so nothing here
 * writes anything.
 */

import { classifyRecipe, type RecipeState } from './presets/classify';
import type { Key, KeyaFile } from './payload/types';
import { expiryCondition, expiryStatus } from './time/expiry';
import { isPlaintextRequest, insecureEndpointCondition } from './payload/url';
import {
  isFailure,
  isStale,
  relevantObservations,
  type Observation,
} from './runtime/observations';
import type { BusinessFact, ObservationFact } from './runtime/dismissals';
import { EXPIRY_UPCOMING_DAYS, OBSERVATION_STALE_DAYS } from './payload/limits';

export interface BusinessAlert extends BusinessFact {
  kind: 'business';
}

export interface ObservationAlert extends ObservationFact {
  kind: 'observation';
}

export type Reminder = BusinessAlert | ObservationAlert;

export interface ReminderContext {
  now: Date;
  timeZone: string;
  upcomingDays?: number;
}

const activeKeys = (file: KeyaFile): Key[] =>
  file.keys.filter((key) => key.archived_at === null);

/** The recipe state for a key, resolved against the file's own providers. */
export function recipeStateFor(file: KeyaFile, key: Key): RecipeState {
  return classifyRecipe(
    { provider_id: key.provider_id, endpoint: key.endpoint },
    file.providers
  );
}

/**
 * Business reminders: expiry and plaintext destinations.
 *
 * `condition` is part of the alert because a dismissal is bound to the fact it
 * dismissed — without it, "changed the date" and "changed it back" would look
 * identical.
 */
export function businessAlerts(
  file: KeyaFile,
  context: ReminderContext
): BusinessAlert[] {
  const reminders: BusinessAlert[] = [];
  const upcomingDays = context.upcomingDays ?? EXPIRY_UPCOMING_DAYS;

  for (const key of activeKeys(file)) {
    const status = expiryStatus(
      key.expiry,
      context.now,
      context.timeZone,
      upcomingDays
    );
    const condition = expiryCondition(key.expiry);

    if (status === 'expired' && condition) {
      reminders.push({
        kind: 'business',
        vault_id: file.vault.id,
        key_id: key.id,
        rule: 'expiry_expired',
        condition,
      });
    } else if (status === 'upcoming' && condition) {
      reminders.push({
        kind: 'business',
        vault_id: file.vault.id,
        key_id: key.id,
        rule: 'expiry_upcoming',
        condition,
      });
    }

    const state = recipeStateFor(file, key);
    if (state.kind !== 'not_executable') {
      const resolved = new URL(state.plan.resolvedHref);
      if (isPlaintextRequest(resolved)) {
        reminders.push({
          kind: 'business',
          vault_id: file.vault.id,
          key_id: key.id,
          rule: 'insecure_endpoint',
          condition: insecureEndpointCondition(resolved),
        });
      }
    } else if (key.endpoint !== null) {
      const endpoint = safeUrl(key.endpoint);
      if (endpoint && isPlaintextRequest(endpoint)) {
        reminders.push({
          kind: 'business',
          vault_id: file.vault.id,
          key_id: key.id,
          rule: 'insecure_endpoint',
          condition: insecureEndpointCondition(endpoint),
        });
      }
    }
  }

  return reminders;
}

function safeUrl(value: string): URL | null {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

/**
 * Observation reminders. The gate is executability: a key whose recipe cannot
 * run must never report "never checked", or the message is permanent and
 * meaningless.
 */
export function observationAlerts(
  file: KeyaFile,
  bindingOf: (key: Key) => string | null,
  observations: readonly Observation[],
  context: ReminderContext
): ObservationAlert[] {
  const reminders: ObservationAlert[] = [];

  for (const key of activeKeys(file)) {
    const binding = bindingOf(key);
    if (binding === null) continue;

    const relevant = relevantObservations(observations, binding, 1);
    const latest = relevant[0];

    if (!latest) {
      reminders.push({
        kind: 'observation',
        vault_id: file.vault.id,
        key_id: key.id,
        rule: 'never_probed',
        binding,
      });
      continue;
    }

    if (isFailure(latest)) {
      reminders.push({
        kind: 'observation',
        vault_id: file.vault.id,
        key_id: key.id,
        rule: 'probe_failed',
        binding,
      });
      continue;
    }

    if (isStale(latest, context.now, OBSERVATION_STALE_DAYS)) {
      reminders.push({
        kind: 'observation',
        vault_id: file.vault.id,
        key_id: key.id,
        rule: 'probe_stale',
        binding,
      });
    }
  }

  return reminders;
}

/**
 * Drop the reminders the user has already dismissed. Everything else is shown,
 * which is why "dismissed" must stay inspectable: a hidden reminder with no
 * visible record is unrecoverable.
 */
export function visibleReminders(
  reminders: readonly Reminder[],
  businessDismissals: readonly BusinessFact[],
  observationDismissals: readonly ObservationFact[]
): Reminder[] {
  const businessKeys = new Set(
    businessDismissals.map(
      (dismissal) =>
        `${dismissal.vault_id}|${dismissal.key_id}|${dismissal.rule}|${dismissal.condition}`
    )
  );
  const observationKeys = new Set(
    observationDismissals.map(
      (dismissal) =>
        `${dismissal.vault_id}|${dismissal.key_id}|${dismissal.rule}|${dismissal.binding}`
    )
  );

  return reminders.filter((reminder) =>
    reminder.kind === 'business'
      ? !businessKeys.has(
          `${reminder.vault_id}|${reminder.key_id}|${reminder.rule}|${reminder.condition}`
        )
      : !observationKeys.has(
          `${reminder.vault_id}|${reminder.key_id}|${reminder.rule}|${reminder.binding}`
        )
  );
}
