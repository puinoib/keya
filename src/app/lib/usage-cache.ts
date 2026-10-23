import type { UsageEntry, UsageSnapshot, UsageWindow } from './usage';

/**
 * A short-lived cache of allowance snapshots, kept in this tab's
 * `sessionStorage`.
 *
 * Only the figures the provider stated are kept, never anything derived, and
 * they expire quickly: the vault is written by no refresh, and a number the app
 * cannot keep current must not hang around long enough to be trusted. Closing
 * the tab clears it; the vault remains the only durable copy of anything.
 *
 * Failures are deliberately not cached. "The provider rejected this key" is a
 * statement about a moment, and replaying it from storage would let a stale
 * rejection outlive the key that caused it.
 */

/** Below this age a snapshot is shown as current. */
export const USAGE_FRESH_MS = 15 * 60 * 1000;

/** Above this age a snapshot is dropped instead of being shown as history. */
export const USAGE_MAX_AGE_MS = 24 * 60 * 60 * 1000;

const PREFIX = 'keya-usage:v1:';

interface CachedWindow {
  id: string;
  label: string;
  percent_used: number;
  resets_at: string | null;
}

interface CachedSnapshot {
  provider: string;
  checked_at: string;
  windows: CachedWindow[];
}

interface CachedVault {
  entries: Record<string, CachedSnapshot>;
}

function storageKey(vaultId: string): string {
  return `${PREFIX}${vaultId}`;
}

/** sessionStorage throws when storage is disabled or full; treat both as empty. */
function readStore(): Storage | null {
  try {
    return typeof sessionStorage === 'undefined' ? null : sessionStorage;
  } catch {
    return null;
  }
}

function readVault(vaultId: string): CachedVault {
  const store = readStore();
  if (!store) return { entries: {} };
  try {
    const raw = store.getItem(storageKey(vaultId));
    if (!raw) return { entries: {} };
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return { entries: {} };
    const entries = (parsed as CachedVault).entries;
    if (!entries || typeof entries !== 'object') return { entries: {} };
    return { entries };
  } catch {
    return { entries: {} };
  }
}

function writeVault(vaultId: string, vault: CachedVault): void {
  const store = readStore();
  if (!store) return;
  try {
    const entries = Object.entries(vault.entries);
    if (entries.length === 0) {
      store.removeItem(storageKey(vaultId));
      return;
    }
    store.setItem(
      storageKey(vaultId),
      JSON.stringify({ entries: Object.fromEntries(entries) })
    );
  } catch {
    /* storage full or denied: the cache is an optimization, never a requirement */
  }
}

function isWindow(value: unknown): value is CachedWindow {
  if (!value || typeof value !== 'object') return false;
  const window = value as Record<string, unknown>;
  return (
    typeof window.id === 'string' &&
    typeof window.label === 'string' &&
    typeof window.percent_used === 'number' &&
    Number.isFinite(window.percent_used) &&
    (window.resets_at === null || typeof window.resets_at === 'string')
  );
}

function toSnapshot(value: unknown): UsageSnapshot | null {
  if (!value || typeof value !== 'object') return null;
  const snapshot = value as Record<string, unknown>;
  if (typeof snapshot.provider !== 'string') return null;
  if (typeof snapshot.checked_at !== 'string') return null;
  if (Number.isNaN(Date.parse(snapshot.checked_at))) return null;
  if (!Array.isArray(snapshot.windows)) return null;
  if (!snapshot.windows.every(isWindow) || snapshot.windows.length === 0) {
    return null;
  }
  return {
    provider: snapshot.provider,
    checked_at: snapshot.checked_at,
    windows: snapshot.windows.map(
      (window): UsageWindow => ({
        id: window.id,
        label: window.label,
        percent_used: window.percent_used,
        resets_at: window.resets_at,
      })
    ),
  };
}

/**
 * Snapshots cached for this vault, as store entries. Anything unreadable, of
 * another provider's shape, or older than the cache horizon is dropped and
 * forgotten.
 */
export function readUsageCache(
  vaultId: string,
  now: Date = new Date()
): Record<string, UsageEntry> {
  const vault = readVault(vaultId);
  const entries: Record<string, UsageEntry> = {};
  let changed = false;

  for (const [keyId, raw] of Object.entries(vault.entries)) {
    const snapshot = toSnapshot(raw);
    const age = snapshot
      ? now.getTime() - Date.parse(snapshot.checked_at)
      : Number.POSITIVE_INFINITY;

    if (!snapshot || age > USAGE_MAX_AGE_MS || age < -60_000) {
      changed = true;
      continue;
    }

    entries[keyId] = {
      state: 'ok',
      vault_id: vaultId,
      snapshot,
      checked_at: snapshot.checked_at,
    };
  }

  if (changed)
    writeVault(vaultId, { entries: withoutIds(vault.entries, entries) });
  return entries;
}

function withoutIds(
  all: Record<string, CachedSnapshot>,
  keep: Record<string, UsageEntry>
): Record<string, CachedSnapshot> {
  const kept: Record<string, CachedSnapshot> = {};
  for (const keyId of Object.keys(all)) {
    if (keep[keyId]) kept[keyId] = all[keyId];
  }
  return kept;
}

/** Remember a snapshot for this vault, replacing any entry for the key. */
export function writeUsageSnapshot(
  vaultId: string,
  keyId: string,
  snapshot: UsageSnapshot
): void {
  const vault = readVault(vaultId);
  vault.entries[keyId] = {
    provider: snapshot.provider,
    checked_at: snapshot.checked_at,
    windows: snapshot.windows,
  };
  writeVault(vaultId, vault);
}

/** Forget one key's snapshot, e.g. because it was deleted or archived. */
export function dropUsageSnapshot(vaultId: string, keyId: string): void {
  const vault = readVault(vaultId);
  if (!(keyId in vault.entries)) return;
  delete vault.entries[keyId];
  writeVault(vaultId, vault);
}

/** Forget every snapshot cached for this vault. */
export function clearUsageVault(vaultId: string): void {
  writeVault(vaultId, { entries: {} });
}

/** Drop entries for keys that are no longer in the vault. */
export function pruneUsageCache(
  vaultId: string,
  keyIds: Iterable<string>
): void {
  const vault = readVault(vaultId);
  const live = new Set(keyIds);
  const stale = Object.keys(vault.entries).filter((id) => !live.has(id));
  if (stale.length === 0) return;
  for (const id of stale) delete vault.entries[id];
  writeVault(vaultId, vault);
}

/** True when a snapshot is old enough that it should be shown as history. */
export function isStaleSnapshot(
  checkedAt: string | undefined,
  now: Date = new Date()
): boolean {
  if (!checkedAt) return false;
  const parsed = Date.parse(checkedAt);
  if (Number.isNaN(parsed)) return true;
  return now.getTime() - parsed > USAGE_FRESH_MS;
}
