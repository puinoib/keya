import { useCallback, useEffect, useState } from 'react';
import { flushSave, useStore } from '../../store/useStore';
import { FileStorage, type CachedVaultMeta } from '../../lib/storage';
import {
  formatShortcut,
  formatShortcutCompact,
  getShortcutKeys,
} from '../../lib/shortcuts';
import { VaultIdentity } from './VaultIdentity';
import { VaultPasswordDialog } from './VaultPasswordDialog';
import { sortVaultFiles, vaultDisplayName } from './vault-order';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Kbd } from '@/components/ui/kbd';
import {
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogRoot,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  ArrowsLeftRight,
  CaretUpDown,
  Check,
  FolderSimple,
  Gear,
  Lock,
  Plus,
  Warning,
} from '@phosphor-icons/react';
import { useNavigate } from '@tanstack/react-router';

export function VaultSwitcher() {
  const { view, activeVaultFileName, keyboardShortcuts, storageMode } =
    useStore();
  const navigate = useNavigate();
  const [vaults, setVaults] = useState<string[]>([]);
  const [metas, setMetas] = useState<Record<string, CachedVaultMeta>>({});
  const [folderName, setFolderName] = useState<string | null>(null);
  const [listingFailed, setListingFailed] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [switchTarget, setSwitchTarget] = useState<string | null>(null);
  const [showNewVault, setShowNewVault] = useState(false);
  const [confirmFolderChange, setConfirmFolderChange] = useState(false);

  const loadVaults = useCallback(async () => {
    const files = await FileStorage.listVaultFiles().catch(() => null);
    setVaults(files ?? []);
    setListingFailed(files === null);
    const list = await FileStorage.getCachedVaultMetas().catch(() => []);
    const map: Record<string, CachedVaultMeta> = {};
    for (const meta of list) map[meta.fileName] = meta;
    setMetas(map);
    setFolderName(await FileStorage.getWorkspaceName().catch(() => null));
  }, []);

  // Reload on mount, on vault change, and every time the menu opens so a file
  // added or removed outside Keya is not missing from the list.
  useEffect(() => {
    void loadVaults();
  }, [loadVaults, activeVaultFileName]);

  const vaultName = useCallback(
    (fileName: string) => vaultDisplayName(fileName, metas[fileName]),
    [metas]
  );

  const vaultData = view?.file.vault;
  const currentName =
    (vaultData?.name && vaultData.name.trim()) ||
    activeVaultFileName?.replace(/\.keya$/, '') ||
    'Vault';
  const currentIcon = vaultData?.icon?.trim() || '';

  const switchMeta = switchTarget ? metas[switchTarget] : undefined;
  const switchName = switchTarget ? vaultName(switchTarget) : 'Vault';

  const lockKeys = getShortcutKeys(keyboardShortcuts, 'vault.lock');
  const lockShortcut = formatShortcutCompact(lockKeys);
  const settingsKeys = getShortcutKeys(keyboardShortcuts, 'nav.settings');
  const settingsShortcut = formatShortcutCompact(settingsKeys);
  // The menu names the file by where it lives: "Keya/work.keya". A browser
  // exposes the folder's name and nothing more, so this is a label rather than
  // a path. The identity block keeps one line either way, so it does not change
  // shape per vault.
  const fileLabel = folderName
    ? `${folderName}/${activeVaultFileName ?? 'unnamed.keya'}`
    : (activeVaultFileName ?? undefined);
  // With no folder to join, the honest copy about why moves to a second line.
  const folderNote = folderName
    ? undefined
    : storageMode === 'folder'
      ? 'Folder permission required'
      : 'Not saved to a folder';

  const sortedVaults = sortVaultFiles(vaults, metas, activeVaultFileName);

  const handleSwitch = async (
    fileName: string,
    password: string,
    signal?: AbortSignal
  ) => {
    // A failed save must keep the user on the vault that owns the changes.
    if (!(await flushSave())) return;
    const newDb = await FileStorage.openVault(fileName, password, signal);
    if (signal?.aborted) return;
    await useStore.getState().unlock(newDb, fileName);
    setSwitchTarget(null);
  };

  const handleCreate = async (password: string, _signal?: AbortSignal) => {
    if (!(await flushSave())) return;
    const fileName = `vault-${Date.now()}.keya`;
    const newDb = await FileStorage.createVault(fileName, password);
    await useStore.getState().unlock(newDb, fileName);
    setShowNewVault(false);
  };

  /**
   * The folder handle has to be dropped before the lock flips the app back to
   * the welcome screen; otherwise that screen renders the old folder name and
   * vault list from a handle we already abandoned. Saving first keeps a dirty
   * vault from being stranded.
   */
  const handleChangeFolder = async () => {
    setConfirmFolderChange(false);
    if (!(await flushSave())) return;
    await FileStorage.clearWorkspace();
    await useStore.getState().lock();
  };

  return (
    <div className="shrink-0 pt-3 px-2">
      <DropdownMenu
        open={menuOpen}
        onOpenChange={(open) => {
          setMenuOpen(open);
          if (open) void loadVaults();
        }}
      >
        <DropdownMenuTrigger className="w-full h-12 flex items-center gap-2.5 px-2.5 hover:bg-surface-3 transition-colors rounded-md bg-canvas-panel">
          <div className="flex items-center justify-center size-7 rounded-lg bg-accent/20 text-accent-bright text-sm shrink-0">
            {currentIcon ? currentIcon : <Lock className="size-3.5" />}
          </div>
          <div className="flex-1 min-w-0">
            <span className="text-sm font-semibold tracking-tight text-ink-primary truncate block text-left">
              {currentName || 'Vault'}
            </span>
          </div>
          <CaretUpDown className="size-3.5 shrink-0 text-ink-quaternary" />
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-60 ml-2">
          <div className="px-2 pt-1 pb-2">
            <VaultIdentity
              size="sm"
              name={currentName}
              icon={currentIcon}
              fileName={fileLabel}
              fileLine="always"
              footnote={folderNote}
            />
          </div>
          <DropdownMenuSeparator />

          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <ArrowsLeftRight className="size-3.5" />
              <span>Switch Vault</span>
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="w-64 max-h-64 overflow-y-auto">
              {listingFailed ? (
                <DropdownMenuItem onClick={() => void loadVaults()}>
                  <Warning className="size-3.5 text-danger" />
                  <span>Can't read this folder</span>
                  <span className="ml-auto text-[11px] text-ink-quaternary">
                    Retry
                  </span>
                </DropdownMenuItem>
              ) : sortedVaults.length === 0 ? (
                <p className="px-2 py-1.5 text-xs text-ink-quaternary">
                  No vaults in this folder
                </p>
              ) : (
                sortedVaults.map((fileName) => {
                  const meta = metas[fileName];
                  const isActive = fileName === activeVaultFileName;
                  return (
                    <DropdownMenuItem
                      key={fileName}
                      onClick={() => {
                        if (!isActive) setSwitchTarget(fileName);
                      }}
                      className="items-center py-1.5"
                    >
                      <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-surface-3 text-sm leading-none">
                        {meta?.icon ? meta.icon : <Lock className="size-3.5" />}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex min-w-0 items-center gap-1.5">
                          <span className="truncate text-[13px] text-ink-primary">
                            {vaultName(fileName)}
                          </span>
                          {isActive && (
                            <Check className="size-3 shrink-0 text-accent-bright" />
                          )}
                        </div>
                        {/* The date here was the container's last write: it
                            names nothing the user can act on, and the list is
                            already ordered by it. Only the count stays. */}
                        <p className="truncate text-[11px] text-ink-quaternary">
                          {meta ? `${meta.keyCount} keys` : fileName}
                        </p>
                      </div>
                    </DropdownMenuItem>
                  );
                })
              )}
            </DropdownMenuSubContent>
          </DropdownMenuSub>

          <DropdownMenuItem onClick={() => setShowNewVault(true)}>
            <Plus className="size-3.5" />
            <span>New Vault</span>
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          <DropdownMenuItem onClick={() => setConfirmFolderChange(true)}>
            <FolderSimple className="size-3.5" />
            <span>Change Sync Folder…</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => navigate({ to: '/settings' })}>
            <Gear className="size-3.5" />
            <span>Settings</span>
            {settingsShortcut !== 'Disabled' && (
              <Kbd label={formatShortcut(settingsKeys)} className="ml-auto">
                {settingsShortcut}
              </Kbd>
            )}
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          <DropdownMenuItem onClick={() => useStore.getState().lock()}>
            <Lock className="size-3.5" />
            <span>Lock</span>
            {lockShortcut !== 'Disabled' && (
              <Kbd label={formatShortcut(lockKeys)} className="ml-auto">
                {lockShortcut}
              </Kbd>
            )}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialogRoot
        open={confirmFolderChange}
        onOpenChange={setConfirmFolderChange}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Change sync folder?</AlertDialogTitle>
            <AlertDialogDescription>
              Keya saves this vault, locks it, and forgets the current folder.
              The vault files themselves stay where they are, and you pick the
              new folder on the welcome screen.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void handleChangeFolder()}
              className="bg-accent text-white hover:bg-accent-hover"
            >
              Change Folder
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialogRoot>

      <Dialog
        open={!!switchTarget}
        onOpenChange={(v) => !v && setSwitchTarget(null)}
      >
        <DialogContent className="max-w-sm gap-5">
          <DialogTitle className="sr-only">{`Unlock ${switchName}`}</DialogTitle>
          <VaultIdentity
            name={switchName}
            icon={switchMeta?.icon}
            fileName={switchTarget ?? undefined}
          />
          <VaultPasswordDialog
            mode="unlock"
            showBack={false}
            vaultId={switchMeta?.vault_id}
            fileName={switchTarget ?? undefined}
            onSubmit={(pw, signal) =>
              switchTarget
                ? handleSwitch(switchTarget, pw, signal)
                : Promise.resolve()
            }
            onExportRaw={(pw) =>
              switchTarget
                ? FileStorage.exportPlaintext(switchTarget, pw)
                : Promise.reject(new Error('No vault selected.'))
            }
            onCancel={() => setSwitchTarget(null)}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={showNewVault} onOpenChange={setShowNewVault}>
        <DialogContent className="max-w-sm gap-5">
          <DialogTitle>Create New Vault</DialogTitle>
          <VaultPasswordDialog
            mode="new"
            showBack={false}
            onSubmit={handleCreate}
            onCancel={() => setShowNewVault(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
