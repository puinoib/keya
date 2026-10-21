/**
 * Edit transactions (class B, §8).
 *
 * Every write goes through one of these functions. They are pure: given the
 * current payload and the desired change they return either a new payload or a
 * rejection, and they are the only place that decides whether something counts
 * as a change, when `content_updated_at` moves, and which operations are
 * refused outright.
 *
 * They deliberately know nothing about dismissals or observations: those live
 * on the device and expire by comparing a stored fact fingerprint (§10.3).
 */

import { MAX_GROUPS, MAX_KEYS, MAX_PROVIDERS } from './limits';
import type { Group, Key, KeyaFile, Provider } from './types';

export type EditRejection =
  | 'unknown_key'
  | 'unknown_group'
  | 'unknown_provider'
  | 'duplicate_key'
  | 'duplicate_group'
  | 'duplicate_provider'
  | 'key_limit'
  | 'group_limit'
  | 'provider_limit'
  | 'provider_in_use'
  | 'duplicate_provider_name';

export type EditResult =
  | { ok: true; changed: false; value: KeyaFile }
  | { ok: true; changed: true; value: KeyaFile }
  | { ok: false; reason: EditRejection };

const unchanged = (value: KeyaFile): EditResult => ({
  ok: true,
  changed: false,
  value,
});

const changed = (value: KeyaFile): EditResult => ({
  ok: true,
  changed: true,
  value,
});

/** Structural equality, ignoring key order. */
export function deepEqual(left: unknown, right: unknown): boolean {
  if (left === right) return true;
  if (typeof left !== typeof right) return false;
  if (left === null || right === null) return false;
  if (Array.isArray(left) || Array.isArray(right)) {
    if (!Array.isArray(left) || !Array.isArray(right)) return false;
    if (left.length !== right.length) return false;
    return left.every((item, index) => deepEqual(item, right[index]));
  }
  if (typeof left === 'object' && typeof right === 'object') {
    const leftObject = left as Record<string, unknown>;
    const rightObject = right as Record<string, unknown>;
    const leftKeys = Object.keys(leftObject);
    const rightKeys = Object.keys(rightObject);
    if (leftKeys.length !== rightKeys.length) return false;
    return leftKeys.every(
      (key) =>
        Object.hasOwn(rightObject, key) &&
        deepEqual(leftObject[key], rightObject[key])
    );
  }
  return false;
}

function withVaultTimestamp(file: KeyaFile, now: string): KeyaFile['vault'] {
  return { ...file.vault, content_updated_at: now };
}

function foldedName(name: string): string {
  return name.replace(/[A-Z]/g, (char) => char.toLowerCase());
}

/** Compare a candidate edit against the stored object, ignoring timestamps. */
function sameIgnoringTimestamp<T extends { content_updated_at: string }>(
  before: T,
  after: T
): boolean {
  const strip = (value: T) => {
    const { content_updated_at: _ignored, ...rest } = value;
    return rest;
  };
  return deepEqual(strip(before), strip(after));
}

/** Create or replace a key. Timestamps move only when something changed. */
export function upsertKey(file: KeyaFile, key: Key, now: string): EditResult {
  const index = file.keys.findIndex((entry) => entry.id === key.id);

  if (index === -1) {
    if (file.keys.length >= MAX_KEYS) return { ok: false, reason: 'key_limit' };
    return changed({
      ...file,
      vault: withVaultTimestamp(file, now),
      keys: [...file.keys, { ...key, content_updated_at: now }],
    });
  }

  const existing = file.keys[index];
  if (sameIgnoringTimestamp(existing, key)) return unchanged(file);

  if (
    key.group_id !== null &&
    !file.groups.some((group) => group.id === key.group_id)
  ) {
    return { ok: false, reason: 'unknown_group' };
  }

  const next = [...file.keys];
  next[index] = {
    ...key,
    created_at: existing.created_at,
    content_updated_at: now,
  };
  return changed({
    ...file,
    vault: withVaultTimestamp(file, now),
    keys: next,
  });
}

export function deleteKey(
  file: KeyaFile,
  keyId: string,
  now: string
): EditResult {
  if (!file.keys.some((key) => key.id === keyId)) {
    return { ok: false, reason: 'unknown_key' };
  }
  return changed({
    ...file,
    vault: withVaultTimestamp(file, now),
    keys: file.keys.filter((key) => key.id !== keyId),
  });
}

/** Archiving is the only soft state; it never changes the identity of a key. */
export function setArchived(
  file: KeyaFile,
  keyId: string,
  archived: boolean,
  now: string
): EditResult {
  const index = file.keys.findIndex((key) => key.id === keyId);
  if (index === -1) return { ok: false, reason: 'unknown_key' };

  const existing = file.keys[index];
  const archivedAt = archived ? now : null;
  if (existing.archived_at === archivedAt) return unchanged(file);
  if (archived && existing.archived_at !== null) return unchanged(file);
  if (!archived && existing.archived_at === null) return unchanged(file);

  const next = [...file.keys];
  next[index] = {
    ...existing,
    archived_at: archivedAt,
    content_updated_at: now,
  };
  return changed({
    ...file,
    vault: withVaultTimestamp(file, now),
    keys: next,
  });
}

export function upsertGroup(
  file: KeyaFile,
  group: Group,
  now: string
): EditResult {
  const index = file.groups.findIndex((entry) => entry.id === group.id);

  if (index === -1) {
    if (file.groups.length >= MAX_GROUPS) {
      return { ok: false, reason: 'group_limit' };
    }
    return changed({
      ...file,
      vault: withVaultTimestamp(file, now),
      // New groups are appended with a dense order value.
      groups: [...file.groups, { ...group, order: file.groups.length }],
    });
  }

  if (deepEqual(file.groups[index], group)) return unchanged(file);

  const next = [...file.groups];
  next[index] = group;
  return changed({
    ...file,
    vault: withVaultTimestamp(file, now),
    groups: next,
  });
}

/** Deleting a group unbinds its keys; it never deletes keys. */
export function deleteGroup(
  file: KeyaFile,
  groupId: string,
  now: string
): EditResult {
  if (!file.groups.some((group) => group.id === groupId)) {
    return { ok: false, reason: 'unknown_group' };
  }

  return changed({
    ...file,
    vault: withVaultTimestamp(file, now),
    groups: file.groups.filter((group) => group.id !== groupId),
    keys: file.keys.map((key) =>
      key.group_id === groupId
        ? { ...key, group_id: null, content_updated_at: now }
        : key
    ),
  });
}

/**
 * Rewrite group order densely (0..n-1).
 *
 * Incremental insertion ("split the gap between two neighbours") runs out of
 * integers quickly and fails silently, because duplicate orders are legal and
 * tie-broken by id. Renumbering on every reorder removes the whole failure
 * mode, and 500 small integers cost nothing.
 */
export function reorderGroups(
  file: KeyaFile,
  orderedIds: readonly string[],
  now: string
): EditResult {
  const known = new Set(file.groups.map((group) => group.id));
  if (orderedIds.length !== known.size) {
    return { ok: false, reason: 'unknown_group' };
  }
  for (const id of orderedIds) {
    if (!known.has(id)) return { ok: false, reason: 'unknown_group' };
  }

  const byId = new Map(file.groups.map((group) => [group.id, group]));
  const groups = orderedIds.map((id, index) => ({
    ...byId.get(id)!,
    order: index,
  }));

  if (deepEqual(groups, file.groups)) return unchanged(file);

  return changed({
    ...file,
    vault: withVaultTimestamp(file, now),
    groups,
  });
}

export function upsertProvider(
  file: KeyaFile,
  provider: Provider,
  now: string
): EditResult {
  const index = file.providers.findIndex((entry) => entry.id === provider.id);

  const clash = file.providers.some(
    (entry) =>
      entry.id !== provider.id &&
      foldedName(entry.name) === foldedName(provider.name)
  );
  if (clash) return { ok: false, reason: 'duplicate_provider_name' };

  if (index === -1) {
    if (file.providers.length >= MAX_PROVIDERS) {
      return { ok: false, reason: 'provider_limit' };
    }
    return changed({
      ...file,
      vault: withVaultTimestamp(file, now),
      providers: [...file.providers, provider],
    });
  }

  if (deepEqual(file.providers[index], provider)) return unchanged(file);

  const next = [...file.providers];
  next[index] = provider;
  return changed({
    ...file,
    vault: withVaultTimestamp(file, now),
    providers: next,
  });
}

/** A provider still referenced by a key cannot be deleted (§8). */
export function deleteProvider(
  file: KeyaFile,
  providerId: string,
  now: string
): EditResult {
  if (!file.providers.some((provider) => provider.id === providerId)) {
    return { ok: false, reason: 'unknown_provider' };
  }
  if (file.keys.some((key) => key.provider_id === providerId)) {
    return { ok: false, reason: 'provider_in_use' };
  }

  return changed({
    ...file,
    vault: withVaultTimestamp(file, now),
    providers: file.providers.filter((provider) => provider.id !== providerId),
  });
}

/** Vault identity edits (name, icon) share the same no-op rule. */
export function updateVaultMeta(
  file: KeyaFile,
  patch: { name?: string; icon?: string },
  now: string
): EditResult {
  const next = { ...file.vault };
  if (patch.name !== undefined) next.name = patch.name;
  if (patch.icon !== undefined) next.icon = patch.icon;

  if (next.name === file.vault.name && next.icon === file.vault.icon) {
    return unchanged(file);
  }

  return changed({ ...file, vault: { ...next, content_updated_at: now } });
}
