/**
 * When this device last wrote a copy of the open vault.
 *
 * Device-local by nature: it describes an export from this browser, not the
 * file, so it is kept out of the payload and keyed by `vault_id`. A missing or
 * unreadable store simply means "no record".
 */

const PREFIX = 'keya-last-export';

function keyOf(vaultId: string): string {
  return `${PREFIX}:${vaultId}`;
}

function storage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

export function readLastExport(vaultId: string): string | null {
  const store = storage();
  if (!store) return null;
  try {
    const value = store.getItem(keyOf(vaultId));
    return value && !Number.isNaN(Date.parse(value)) ? value : null;
  } catch {
    return null;
  }
}

export function recordExport(
  vaultId: string,
  at: Date = new Date()
): string | null {
  const iso = at.toISOString();
  const store = storage();
  if (!store) return iso;
  try {
    store.setItem(keyOf(vaultId), iso);
  } catch {
    // Quota or a blocked store: the export itself already succeeded.
  }
  return iso;
}
