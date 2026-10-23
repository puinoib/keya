/**
 * The two exports, shared by the top bar shortcut and Settings › Data.
 *
 * Both paths must behave the same: same warning, same filename, same "this is
 * a copy, not a save" rule in folder mode. Keeping them here is what stops the
 * two entry points from drifting.
 */

import { toast } from 'sonner';
import { buildJsonExport, jsonExportFileName } from './export-json';
import { downloadBytes, downloadJSON } from './download';
import { recordExport } from './export-history';
import { exportVaultBytes, useStore } from '../store/useStore';

/** Encrypted copy. In folder mode the file is already saved, so this is a
 * copy and the unsaved flag stays as it was. */
export async function exportKeyaCopy(): Promise<boolean> {
  const { view, storageMode, markExported } = useStore.getState();
  if (!view) return false;

  try {
    const bytes = await exportVaultBytes(storageMode === 'download');
    if (!bytes) {
      toast.error('Export failed');
      return false;
    }

    const date = new Date().toISOString().slice(0, 10);
    downloadBytes(bytes, `keya-${date}.keya`);
    if (storageMode === 'download') markExported();
    recordExport(view.vaultId);
    toast.success('Exported .keya file');
    return true;
  } catch {
    toast.error('Export failed', {
      description: 'Failed to export .keya file',
    });
    return false;
  }
}

/** Plaintext exchange copy. The confirmation is part of the action, not the
 * caller, so neither entry point can skip it. */
export async function exportJsonCopy(): Promise<boolean> {
  const confirmed = window.confirm(
    'Export JSON writes every key in this vault as plain text, including the secrets.\n\n' +
      'The file is not a backup. Store it somewhere safe and delete it when you are done.\n\n' +
      'Export the plaintext JSON file?'
  );
  if (!confirmed) return false;

  try {
    // The view lags a debounced edit; refresh before snapshotting so the
    // export cannot silently omit the key that was just saved.
    await useStore.getState().refresh();
    const current = useStore.getState().view;
    if (!current) return false;
    downloadJSON(buildJsonExport(current.file), jsonExportFileName());
    recordExport(current.vaultId);
    toast.success('Exported JSON file', {
      description: 'Plain text: delete it once the keys have been moved.',
    });
    return true;
  } catch {
    toast.error('Export failed', {
      description: 'The vault could not be read for export.',
    });
    return false;
  }
}
