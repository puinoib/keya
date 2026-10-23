/**
 * The plaintext JSON export.
 *
 * This is the vault's own model, not a second one: the same keys, providers and
 * groups the file holds, with the same names. Device-local state (preferences,
 * check results, dismissals, grants) is not part of it, because none of it
 * belongs to the vault.
 *
 * The output contains secrets in clear text; the caller warns before writing it.
 */

import type { Group, Key, KeyaFile, Provider } from '../../core/payload/types';

export const JSON_EXPORT_FORMAT = 'keya-exchange';
export const JSON_EXPORT_VERSION = 1;

/** The §14.3 exchange shape; it carries assets, never device state. */
export interface KeyaJsonExport {
  format: typeof JSON_EXPORT_FORMAT;
  version: typeof JSON_EXPORT_VERSION;
  vault: {
    name: string;
    icon: string;
  };
  providers: Provider[];
  groups: Group[];
  keys: Key[];
}

/** A copy of the vault's content, in the payload's own shape. */
export function buildJsonExport(file: KeyaFile): KeyaJsonExport {
  return {
    format: JSON_EXPORT_FORMAT,
    version: JSON_EXPORT_VERSION,
    vault: {
      name: file.vault.name,
      icon: file.vault.icon,
    },
    providers: file.providers.map((provider) => structuredClone(provider)),
    groups: file.groups.map((group) => structuredClone(group)),
    keys: file.keys.map((key) => structuredClone(key)),
  };
}

/** The filename the export suggests, so two exports never overwrite silently. */
export function jsonExportFileName(now: Date = new Date()): string {
  return `keya-export-${now.toISOString().slice(0, 10)}.json`;
}
