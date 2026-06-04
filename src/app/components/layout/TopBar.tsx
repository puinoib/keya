import { useRef } from 'react';
import { useStore } from '../../store/useStore';
import {
  MagnifyingGlass,
  Plus,
  Sun,
  Moon,
  Monitor,
  DownloadSimple,
  Key,
  FileCode,
  DotsThree,
} from '@phosphor-icons/react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  deserializeFromFile,
  serializeToFile,
  type KeyaDatabase,
} from '../../../core';
import { FileStorage } from '../../lib/storage';
import { Database } from '../../../core/database';
import { useToast } from '@/components/ui/toast';

function downloadBytes(data: Uint8Array, filename: string) {
  const blob = new Blob([data], { type: 'application/octet-stream' });
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

/** Merge imported database into current DB — creates a fresh Database to trigger re-render */
function mergeIntoDb(current: Database, imported: KeyaDatabase): void {
  for (const key of imported.api_keys) {
    current.addApiKey({
      name: key.name || 'Imported Key',
      key: key.key || '',
      description: key.description || '',
      provider: key.provider || 'Custom',
      endpoint: key.endpoint || '',
      group_id: key.group_id || current.getData().groups[0]?.id || null,
      expires_at: key.expires_at ?? null,
      last_tested: key.last_tested ?? null,
      test_status: key.test_status ?? null,
      test_latency_ms: key.test_latency_ms ?? null,
    });
  }
}

export function TopBar() {
  const {
    searchQuery,
    setSearchQuery,
    setShowAddForm,
    theme,
    setTheme,
    db,
    password,
    setDb,
  } = useStore();
  const toast = useToast();
  const importKeyaRef = useRef<HTMLInputElement>(null);
  const importJsonRef = useRef<HTMLInputElement>(null);

  /* ──── Export .keya ──── */
  const handleExportKeya = async () => {
    if (!db || !password) return;
    try {
      const bytes = await serializeToFile(db.getData(), password);
      const date = new Date().toISOString().slice(0, 10);
      downloadBytes(bytes, `keya-${date}.keya`);
      toast.add({ title: 'Exported .keya file', timeout: 3000 });
    } catch (e) {
      console.error('Export .keya failed:', e);
      toast.add({
        title: 'Export failed',
        description: 'Failed to export .keya file',
        type: 'error',
        timeout: 4000,
      });
    }
  };

  /* ──── Import .keya ──── */
  const handleImportKeya = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !db) return;
    e.target.value = '';

    const pw = prompt('Enter the password for this .keya file:');
    if (!pw) return;

    try {
      const buffer = await file.arrayBuffer();
      const imported = await deserializeFromFile(new Uint8Array(buffer), pw);
      mergeIntoDb(db, imported);

      setDb(new Database(db.getData()));
      await FileStorage.save(db.getData(), password || '');
      toast.add({
        title: 'Imported .keya file',
        description: `${imported.api_keys.length} keys imported`,
        timeout: 3000,
      });
    } catch (e) {
      console.error('Import .keya failed:', e);
      toast.add({
        title: 'Import failed',
        description: 'Wrong password or corrupted file',
        type: 'error',
        timeout: 4000,
      });
    }
  };

  /* ──── Export JSON ──── */
  const handleExportJson = () => {
    if (!db) return;
    const date = new Date().toISOString().slice(0, 10);
    downloadJSON(db.getData(), `keya-export-${date}.json`);
    toast.add({ title: 'Exported JSON file', timeout: 3000 });
  };

  /* ──── Import JSON ──── */
  const handleImportJson = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !db) return;
    try {
      const text = await file.text();
      const imported = JSON.parse(text);
      if (!imported.api_keys || !Array.isArray(imported.api_keys)) {
        toast.add({
          title: 'Import failed',
          description: 'Invalid Keya export format',
          type: 'error',
          timeout: 4000,
        });
        return;
      }
      mergeIntoDb(db, imported as KeyaDatabase);

      setDb(new Database(db.getData()));
      await FileStorage.save(db.getData(), password || '');
      toast.add({
        title: 'Imported JSON file',
        description: `${imported.api_keys.length} keys imported`,
        timeout: 3000,
      });
    } catch {
      toast.add({
        title: 'Import failed',
        description: 'Failed to parse file',
        type: 'error',
        timeout: 4000,
      });
    }
    e.target.value = '';
  };

  return (
    <header className="h-11 flex items-center gap-2 px-3 shrink-0">
      <div className="relative flex-1 max-w-sm">
        <MagnifyingGlass className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-ink-quaternary pointer-events-none" />
        <input
          type="text"
          placeholder="Search keys..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full h-7 pl-8 pr-3 rounded-md bg-surface-2 border border-transparent
                          text-xs text-ink-primary placeholder:text-ink-quaternary
                          hover:bg-surface-3 hover:border-line-subtle
                          focus:outline-none focus:bg-surface-2 focus:border-line focus:ring-1 focus:ring-accent-bright/40
                          transition-all duration-150"
        />
      </div>

      <div className="flex-1" />

      {/* More menu */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="inline-flex items-center justify-center size-7 rounded-md text-ink-quaternary hover:text-ink-secondary hover:bg-surface-3 transition-colors duration-150">
            <DotsThree className="size-3.5" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
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
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setShowAddForm(true)}>
            <Plus className="size-3.5" /> Add Key
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <input
        ref={importKeyaRef}
        type="file"
        accept=".keya"
        className="hidden"
        onChange={handleImportKeya}
      />
      <input
        ref={importJsonRef}
        type="file"
        accept=".json"
        className="hidden"
        onChange={handleImportJson}
      />

      {/* Theme toggle */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="inline-flex items-center justify-center size-7 rounded-md text-ink-quaternary hover:text-ink-secondary hover:bg-surface-3 transition-colors duration-150">
            {theme === 'dark' ? (
              <Moon className="size-3.5" />
            ) : theme === 'light' ? (
              <Sun className="size-3.5" />
            ) : (
              <Monitor className="size-3.5" />
            )}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-36">
          <DropdownMenuItem onClick={() => setTheme('dark')} className="gap-2">
            <Moon className="size-3.5" /> {theme === 'dark' ? '✓ Dark' : 'Dark'}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setTheme('light')} className="gap-2">
            <Sun className="size-3.5" />{' '}
            {theme === 'light' ? '✓ Light' : 'Light'}
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => setTheme('system')}
            className="gap-2"
          >
            <Monitor className="size-3.5" />{' '}
            {theme === 'system' ? '✓ System' : 'System'}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <button
        onClick={() => setShowAddForm(true)}
        className="inline-flex items-center gap-1 h-7 px-2.5 rounded-md bg-accent text-xs font-medium text-white hover:bg-accent-bright transition-colors duration-150"
      >
        <Plus className="size-3.5" /> Add Key
      </button>
    </header>
  );
}
