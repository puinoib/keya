import { useRef, useState } from 'react';
import { flushSave, useStore } from '../../store/useStore';
import {
  MagnifyingGlass,
  Plus,
  Download,
  Key,
  FileCode,
  DownloadSimple,
  Lock,
} from '@phosphor-icons/react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { deserializeFromFile, serializeToFile } from '../../../core';
import { Database } from '../../../core/database';
import {
  mergeImportedData,
  type ImportMergeResult,
  type ImportSource,
} from '../../lib/import-merge';
import { VaultPasswordDialog } from '../vault/VaultPasswordDialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';

function downloadBytes(data: Uint8Array, filename: string) {
  const blob = new Blob([new Uint8Array(data)], {
    type: 'application/octet-stream',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function downloadJSON(data: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function importSummary(result: ImportMergeResult): string {
  const parts = [`${result.addedKeys} keys imported`];
  if (result.createdGroups > 0)
    parts.push(`${result.createdGroups} groups created`);
  if (result.skippedDuplicateKeys > 0)
    parts.push(`${result.skippedDuplicateKeys} duplicates skipped`);
  if (result.invalidKeys > 0)
    parts.push(`${result.invalidKeys} invalid entries skipped`);
  return parts.join(' · ');
}

export function TopBar() {
  const {
    searchQuery,
    setSearchQuery,
    beginAddKeyFlow,
    db,
    password,
    setDb,
    storageMode,
    hasUnsavedChanges,
    markExported,
  } = useStore();
  const importKeyaRef = useRef<HTMLInputElement>(null);
  const importJsonRef = useRef<HTMLInputElement>(null);
  const pendingImportDbRef = useRef<Database | null>(null);
  const [pendingKeyaFile, setPendingKeyaFile] = useState<File | null>(null);

  const applyImport = async (
    source: ImportSource,
    expectedDb: Database,
    label: string
  ): Promise<void> => {
    if (useStore.getState().db !== expectedDb) {
      throw new Error('Vault changed during import.');
    }

    const result = mergeImportedData(expectedDb, source);
    setDb(new Database(expectedDb.getData()));
    useStore.getState().runInboxChecks();

    try {
      await flushSave();
      toast.success(`Imported ${label}`, {
        description: importSummary(result),
      });
    } catch (error) {
      toast.error('Imported, but the vault was not saved', {
        description:
          error instanceof Error
            ? error.message
            : 'Export a .keya file to keep these changes.',
      });
    }
  };

  /* ──── Export .keya ──── */
  const handleExportKeya = async () => {
    if (!db || !password) return;
    try {
      const snapshot = structuredClone(db.getData());
      const bytes = await serializeToFile(snapshot, password);
      const date = new Date().toISOString().slice(0, 10);
      downloadBytes(bytes, `keya-${date}.keya`);

      if (storageMode === 'download') {
        const stillCurrent =
          useStore.getState().db === db &&
          JSON.stringify(db.getData()) === JSON.stringify(snapshot);
        if (stillCurrent) {
          markExported();
        } else {
          toast.warning('Exported a snapshot, but newer edits are unsaved', {
            description: 'Export again to capture the latest changes.',
          });
          return;
        }
      }
      toast.success('Exported .keya file');
    } catch (e) {
      console.error('Export .keya failed:', e);
      toast.error('Export failed', {
        description: 'Failed to export .keya file',
      });
    }
  };

  /* ──── Import .keya ──── */
  const handleKeyaFilePicked = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !db) return;
    pendingImportDbRef.current = db;
    setPendingKeyaFile(file);
  };

  const handleImportKeyaPassword = async (password: string) => {
    const file = pendingKeyaFile;
    const expectedDb = pendingImportDbRef.current;
    if (!file || !expectedDb) return;

    const buffer = await file.arrayBuffer();
    const imported = await deserializeFromFile(
      new Uint8Array(buffer),
      password
    );

    setPendingKeyaFile(null);
    pendingImportDbRef.current = null;
    try {
      await applyImport(imported, expectedDb, '.keya file');
    } catch (error) {
      toast.error('Import failed', {
        description: error instanceof Error ? error.message : 'Vault changed.',
      });
    }
  };

  /* ──── Export JSON ──── */
  const handleExportJson = () => {
    if (!db) return;
    const date = new Date().toISOString().slice(0, 10);
    downloadJSON(db.getData(), `keya-export-${date}.json`);
    toast.success('Exported JSON file');
  };

  /* ──── Import JSON ──── */
  const handleImportJson = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const expectedDb = db;
    e.target.value = '';
    if (!file || !expectedDb) return;

    try {
      const text = await file.text();
      const imported: unknown = JSON.parse(text);
      if (
        typeof imported !== 'object' ||
        imported === null ||
        !Array.isArray((imported as { api_keys?: unknown }).api_keys)
      ) {
        toast.error('Import failed', {
          description: 'Invalid Keya export format',
        });
        return;
      }

      await applyImport(imported as ImportSource, expectedDb, 'JSON export');
    } catch (error) {
      toast.error('Import failed', {
        description:
          error instanceof Error ? error.message : 'Failed to parse file',
      });
    }
  };

  return (
    <header className="h-11 flex items-center gap-2 px-3 shrink-0">
      <button
        onClick={() => void beginAddKeyFlow()}
        className="inline-flex items-center gap-1 h-7 px-2.5 ml-1 rounded-md bg-accent text-xs font-medium text-white hover:bg-accent-bright transition-colors duration-150"
      >
        <Plus className="size-3.5" /> Add Key
      </button>

      <div className="relative flex-1 max-w-sm">
        <MagnifyingGlass className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-ink-quaternary pointer-events-none" />
        <input
          type="text"
          placeholder="Search keys..."
          value={searchQuery}
          data-keya-search="true"
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              if (searchQuery) setSearchQuery('');
              else e.currentTarget.blur();
            }
          }}
          className="w-full h-7 pl-8 pr-3 rounded-md bg-surface-2 border border-transparent
                          text-xs text-ink-primary placeholder:text-ink-quaternary
                          hover:bg-surface-3 hover:border-line-subtle
                          focus:outline-none focus:bg-surface-2 focus:border-line focus:ring-1 focus:ring-accent-bright/40
                          transition-all duration-150"
        />
      </div>

      <div className="flex-1" />

      {storageMode === 'download' && hasUnsavedChanges && (
        <span className="shrink-0 text-xs text-amber-600 dark:text-amber-400">
          Unsaved — export .keya to save
        </span>
      )}

      {/* Import/Export menu */}
      <DropdownMenu>
        <DropdownMenuTrigger className="inline-flex items-center justify-center size-7 rounded-md text-ink-quaternary hover:text-ink-secondary hover:bg-surface-3 transition-colors duration-150">
          <Download className="size-3.5" />
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-44">
          {/* Keya import/export — encrypted, first priority */}
          <DropdownMenuItem onClick={() => importKeyaRef.current?.click()}>
            <Key className="size-3.5" /> Import .keya
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleExportKeya}>
            <DownloadSimple className="size-3.5" /> Export .keya
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {/* JSON import/export — unencrypted, secondary */}
          <DropdownMenuItem onClick={() => importJsonRef.current?.click()}>
            <FileCode className="size-3.5" /> Import JSON
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleExportJson}>
            <DownloadSimple className="size-3.5" /> Export JSON
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <input
        ref={importKeyaRef}
        type="file"
        accept=".keya"
        className="hidden"
        onChange={handleKeyaFilePicked}
      />
      <input
        ref={importJsonRef}
        type="file"
        accept=".json"
        className="hidden"
        onChange={handleImportJson}
      />

      <button
        onClick={() => useStore.getState().lock()}
        className="inline-flex items-center gap-1.5 h-7 px-2 rounded-md text-xs text-ink-quaternary hover:text-ink-secondary hover:bg-surface-3 transition-colors duration-150"
      >
        <Lock className="size-3.5" />
        Lock
      </button>

      <Dialog
        open={!!pendingKeyaFile}
        onOpenChange={(open) => {
          if (!open) {
            setPendingKeyaFile(null);
            pendingImportDbRef.current = null;
          }
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Import .keya file</DialogTitle>
            <DialogDescription>
              Enter the master password for {pendingKeyaFile?.name}
            </DialogDescription>
          </DialogHeader>
          <VaultPasswordDialog
            mode="unlock"
            vaultName={pendingKeyaFile?.name ?? 'Imported vault'}
            fileName={pendingKeyaFile?.name}
            onSubmit={handleImportKeyaPassword}
            onCancel={() => {
              setPendingKeyaFile(null);
              pendingImportDbRef.current = null;
            }}
          />
        </DialogContent>
      </Dialog>
    </header>
  );
}
