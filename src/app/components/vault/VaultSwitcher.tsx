import { useState, useEffect } from 'react';
import { useStore } from '../../store/useStore';
import { FileStorage, type CachedVaultMeta } from '../../lib/storage';
import { VaultPasswordDialog } from './VaultPasswordDialog';
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Lock,
  Plus,
  Gear,
  ArrowsLeftRight,
  Sun,
  Moon,
  Monitor,
  Check,
} from '@phosphor-icons/react';
import { useNavigate } from '@tanstack/react-router';

export function VaultSwitcher() {
  const { db, activeVaultFileName, theme, setTheme } = useStore();
  const navigate = useNavigate();
  const [vaults, setVaults] = useState<string[]>([]);
  const [metas, setMetas] = useState<Record<string, CachedVaultMeta>>({});
  const [switchTarget, setSwitchTarget] = useState<string | null>(null);
  const [showNewVault, setShowNewVault] = useState(false);

  useEffect(() => {
    FileStorage.listVaultFiles().then((files) => setVaults(files ?? []));
    FileStorage.getCachedVaultMetas().then((list) => {
      const map: Record<string, CachedVaultMeta> = {};
      for (const m of list) map[m.fileName] = m;
      setMetas(map);
    });
  }, [activeVaultFileName]);

  const vaultData = db?.getData();
  const currentName =
    (vaultData?.name && vaultData.name.trim()) ||
    activeVaultFileName?.replace(/\.keya$/, '') ||
    'Vault';
  const currentIcon = vaultData?.icon?.trim() || '';

  const handleSwitch = async (fileName: string, password: string) => {
    const newDb = await FileStorage.openVault(fileName, password);
    useStore.getState().unlock(newDb, password, fileName);
    setSwitchTarget(null);
  };

  const handleCreate = async (password: string) => {
    const fileName = `vault-${Date.now()}.keya`;
    const newDb = await FileStorage.createVault(fileName, password);
    useStore.getState().unlock(newDb, password, fileName);
    setShowNewVault(false);
  };

  return (
    <div className="shrink-0 pt-3 px-2">
      <DropdownMenu>
        <DropdownMenuTrigger className="w-full h-12 flex items-center gap-2.5 px-2.5 hover:bg-surface-3 transition-colors rounded-md bg-canvas-panel">
          <div className="flex items-center justify-center size-7 rounded-lg bg-accent/20 text-accent-bright text-sm shrink-0">
            {currentIcon ? currentIcon : <Lock className="size-3.5" />}
          </div>
          <div className="flex-1 min-w-0">
            <span className="text-sm font-semibold tracking-tight text-ink-primary truncate block text-left">
              {currentName || 'Vault'}
            </span>
          </div>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-52 ml-2">
          <DropdownMenuItem
            onClick={() => navigate({ to: '/settings' })}
            className="text-ink-quaternary"
          >
            <Gear className="size-3.5" />
            <span>Settings</span>
          </DropdownMenuItem>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger className="text-ink-quaternary">
              {theme === 'dark' ? (
                <Moon className="size-3.5" />
              ) : theme === 'light' ? (
                <Sun className="size-3.5" />
              ) : (
                <Monitor className="size-3.5" />
              )}
              <span>Theme</span>
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="w-36">
              <DropdownMenuItem onClick={() => setTheme('dark')}>
                <Moon className="size-3.5" />
                <span>Dark</span>
                {theme === 'dark' && <Check className="size-3.5 ml-auto" />}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTheme('light')}>
                <Sun className="size-3.5" />
                <span>Light</span>
                {theme === 'light' && <Check className="size-3.5 ml-auto" />}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTheme('system')}>
                <Monitor className="size-3.5" />
                <span>System</span>
                {theme === 'system' && <Check className="size-3.5 ml-auto" />}
              </DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuSeparator />
          <DropdownMenuSub>
            <DropdownMenuSubTrigger className="text-ink-quaternary">
              <ArrowsLeftRight className="size-3.5" />
              <span>Switch Vault</span>
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="w-52 max-h-64 overflow-y-auto">
              {vaults.map((f) => {
                const meta = metas[f];
                const isActive = f === activeVaultFileName;
                const name = meta?.name || f.replace(/\.keya$/, '');
                return (
                  <DropdownMenuItem
                    key={f}
                    disabled={isActive}
                    onClick={() => setSwitchTarget(f)}
                    className={
                      isActive
                        ? 'bg-surface-4 text-ink-secondary'
                        : 'text-ink-tertiary'
                    }
                  >
                    <span className="text-sm">
                      {meta?.icon ? meta.icon : <Lock className="size-3.5" />}
                    </span>
                    <span className="truncate flex-1">{name}</span>
                    {isActive && (
                      <span className="ml-auto text-xs text-ink-quaternary">
                        active
                      </span>
                    )}
                  </DropdownMenuItem>
                );
              })}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => setShowNewVault(true)}
                className="text-ink-quaternary"
              >
                <Plus className="size-3" />
                <span>New Vault</span>
              </DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuItem
            onClick={() => useStore.getState().lock()}
            className="text-ink-quaternary"
          >
            <Lock className="size-3.5" />
            <span>Lock</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog
        open={!!switchTarget}
        onOpenChange={(v) => !v && setSwitchTarget(null)}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Unlock Vault</DialogTitle>
            <DialogDescription>
              Enter the master password for{' '}
              {metas[switchTarget!]?.name ||
                switchTarget?.replace(/\.keya$/, '')}
            </DialogDescription>
          </DialogHeader>
          <VaultPasswordDialog
            mode="unlock"
            vaultName={
              metas[switchTarget!]?.name ||
              switchTarget?.replace(/\.keya$/, '') ||
              ''
            }
            vaultId={metas[switchTarget!]?.vault_id}
            onSubmit={(pw) =>
              switchTarget ? handleSwitch(switchTarget, pw) : Promise.resolve()
            }
            onCancel={() => setSwitchTarget(null)}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={showNewVault} onOpenChange={setShowNewVault}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Create New Vault</DialogTitle>
            <DialogDescription>
              Set a master password for your new vault
            </DialogDescription>
          </DialogHeader>
          <VaultPasswordDialog
            mode="new"
            vaultName="New Vault"
            onSubmit={handleCreate}
            onCancel={() => setShowNewVault(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
