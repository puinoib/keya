import type { CachedVaultMeta } from '../../lib/storage';

export function vaultDisplayName(
  fileName: string,
  meta?: CachedVaultMeta
): string {
  const name = meta?.name?.trim();
  return name ? name : fileName.replace(/\.keya$/, '');
}

/**
 * Active vault first, then the most recently saved, then by display name.
 * A switcher answers "where am I" before "what else is there", so alphabetical
 * order alone would bury the current vault in the middle of the list.
 */
export function sortVaultFiles(
  fileNames: string[],
  metas: Record<string, CachedVaultMeta>,
  activeFileName?: string | null
): string[] {
  return [...fileNames].sort((a, b) => {
    const activeA = a === activeFileName;
    const activeB = b === activeFileName;
    if (activeA !== activeB) return activeA ? -1 : 1;

    const updatedA = metas[a]?.updatedAt ?? '';
    const updatedB = metas[b]?.updatedAt ?? '';
    if (updatedA !== updatedB) {
      // An empty timestamp sorts as text before every date, so treat "never
      // saved" explicitly to keep those vaults at the end.
      if (!updatedA) return 1;
      if (!updatedB) return -1;
      return updatedB.localeCompare(updatedA);
    }

    return vaultDisplayName(a, metas[a]).localeCompare(
      vaultDisplayName(b, metas[b])
    );
  });
}
