import { exportVaultBytes, flushSave, useStore } from '../../store/useStore';
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

export function TopBar() {
  const {
    searchQuery,
    setSearchQuery,
    beginAddKeyFlow,
    db,
    storageMode,
    hasUnsavedChanges,
    markExported,
  } = useStore();
  const notifyUnavailable = (feature: string) => {
    toast('Not available in this build', {
      description: `${feature} is not wired up yet. Existing keys are unaffected.`,
    });
  };

  /* ──── Export .keya ──── */
  const handleExportKeya = async () => {
    if (!db) return;
    try {
      const saved = await flushSave();
      if (!saved) {
        toast.error('Save the vault before exporting.');
        return;
      }

      const bytes = await exportVaultBytes();
      if (!bytes) {
        toast.error('Export failed');
        return;
      }

      const date = new Date().toISOString().slice(0, 10);
      downloadBytes(bytes, `keya-${date}.keya`);
      markExported();
      toast.success('Exported .keya file');
    } catch {
      toast.error('Export failed', {
        description: 'Failed to export .keya file',
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
          <DropdownMenuItem
            disabled
            onClick={() => notifyUnavailable('Import .keya')}
          >
            <Key className="size-3.5" /> Import .keya
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleExportKeya}>
            <DownloadSimple className="size-3.5" /> Export .keya
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {/* JSON import/export — unencrypted, secondary */}
          <DropdownMenuItem
            disabled
            onClick={() => notifyUnavailable('Import JSON')}
          >
            <FileCode className="size-3.5" /> Import JSON
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleExportJson}>
            <DownloadSimple className="size-3.5" /> Export JSON
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <button
        onClick={() => useStore.getState().lock()}
        className="inline-flex items-center gap-1.5 h-7 px-2 rounded-md text-xs text-ink-quaternary hover:text-ink-secondary hover:bg-surface-3 transition-colors duration-150"
      >
        <Lock className="size-3.5" />
        Lock
      </button>
    </header>
  );
}
