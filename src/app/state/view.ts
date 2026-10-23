/**
 * The vault as the screens read it.
 *
 * One snapshot per refresh: the v2 payload, this device's latest observation
 * per key, the attention facts derived from both, and the preferences that
 * decide what a screen offers. Nothing here is written back, and nothing is
 * stored in a second shape: the fields are the payload's own, and only the
 * verdicts and labels a screen shows are computed.
 */

import type { Group, Key, KeyaFile, Provider } from '../../core/payload/types';
import type { Observation } from '../../core/runtime/observations';
import type { KeyBinding } from '../runtime/binding';
import {
  attentionFacts,
  attentionPriority,
  deviceVerifications,
  sortAttention,
  type AttentionFact,
  type AttentionSignals,
  type DeviceVerification,
} from '../../core/reminders';
import type { Preferences } from '../storage/local/state';
import type { RecipeState } from '../../core/presets/classify';
import { classifyRecipe } from '../../core/presets/classify';
import { isPlaintextRequest } from '../../core/payload/url';
import { providerLabel } from './providers';
import {
  checkStatus,
  daysUntilExpiry,
  expiryVerdict,
  rejectionReason,
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
  /** Facts that need a decision now, most urgent first. Empty when all is well. */
  attention: AttentionRow[];
  /** This device's verification standing, for every key that can be checked. */
  device: DeviceVerificationRow[];
}

/** One attention fact plus the key it is about and its computed priority. */
export interface AttentionRow {
  fact: AttentionFact;
  key: Key;
  priority: number;
}

/** A device verification row with the key it describes. */
export interface DeviceVerificationRow extends DeviceVerification {
  key: Key;
}

export interface ViewInput {
  file: KeyaFile;
  preferences: Preferences;
  now: Date;
  timeZone: string;
  checks: Map<string, Observation>;
  bindings: Map<string, KeyBinding>;
  grants: Set<string>;
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

  const bindingOf = (key: Key) => input.bindings.get(key.id)?.binding ?? null;
  const context = { now: input.now, timeZone: input.timeZone };

  const signals = new Map<string, AttentionSignals>();
  for (const key of file.keys) {
    const observation = input.checks.get(key.id);
    const binding = bindingOf(key);
    signals.set(key.id, {
      grouped: key.group_id !== null,
      verified:
        observation !== undefined &&
        binding !== null &&
        observation.binding === binding &&
        observation.outcome === 'ok',
    });
  }

  const facts = attentionFacts(file, bindingOf, input.checks, context);
  const priorities = new Map(
    facts.map((fact) => [
      fact,
      attentionPriority(
        fact,
        signals.get(fact.key_id) ?? { grouped: false, verified: false },
        input.now
      ),
    ])
  );

  const attention: AttentionRow[] = [];
  for (const fact of sortAttention(
    facts,
    (fact) => priorities.get(fact) ?? 0
  )) {
    const key = byId.get(fact.key_id);
    if (!key) continue;
    attention.push({ fact, key, priority: priorities.get(fact) ?? 0 });
  }

  const device: DeviceVerificationRow[] = [];
  for (const row of deviceVerifications(
    file,
    bindingOf,
    input.checks,
    context
  )) {
    const key = byId.get(row.key_id);
    if (!key) continue;
    device.push({ ...row, key });
  }
  device.sort((left, right) => {
    if (left.never_verified !== right.never_verified) {
      return left.never_verified ? -1 : 1;
    }
    const leftDays = left.days_since ?? Number.MAX_SAFE_INTEGER;
    const rightDays = right.days_since ?? Number.MAX_SAFE_INTEGER;
    if (leftDays !== rightDays) return rightDays - leftDays;
    return left.key.name.localeCompare(right.key.name);
  });

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
    attention,
    device,
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

/** The count the sidebar badge shows: only facts that need a decision. */
export function attentionCount(view: VaultView | null): number {
  return view?.attention.length ?? 0;
}

/** Device rows worth offering a check for, quiet and batchable. */
export function deviceBacklog(view: VaultView): DeviceVerificationRow[] {
  return view.device.filter((row) => row.never_verified || row.stale);
}

/** The highest severity an attention fact carries, for colour and icon. */
export type AttentionSeverity = 'critical' | 'warning';

export function attentionSeverity(fact: AttentionFact): AttentionSeverity {
  if (fact.kind === 'rejected') return 'critical';
  return fact.phase === 'expired' ? 'critical' : 'warning';
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

/**
 * The plaintext destination this key would actually reach, if any.
 *
 * Judged from the resolved request rather than the endpoint alone, so an
 * absolute `http:` target is caught even when `endpoint` is https or null. This
 * is a property of the configuration, shown on the key, never an inbox item.
 */
export function plaintextTargetOf(
  view: VaultView,
  key: Key
): { href: string; origin: string } | null {
  const recipe = view.recipes.get(key.id);
  const candidates: string[] = [];

  if (recipe && recipe.kind !== 'not_executable') {
    candidates.push(recipe.plan.resolvedHref);
  }
  if (key.endpoint !== null) candidates.push(key.endpoint);

  for (const candidate of candidates) {
    let url: URL;
    try {
      url = new URL(candidate);
    } catch {
      continue;
    }
    if (isPlaintextRequest(url)) {
      return { href: url.href, origin: url.origin };
    }
  }

  return null;
}

/** The one-line fact behind a rejected row, using the shared failure copy. */
export function rejectionText(row: AttentionRow): string {
  return row.fact.kind === 'rejected' ? rejectionReason(row.fact.outcome) : '';
}
