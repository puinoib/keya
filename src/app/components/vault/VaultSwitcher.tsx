import { useState, useEffect } from 'react'
import { useStore } from '../../store/useStore'
import { FileStorage, type CachedVaultMeta } from '../../lib/storage'
import { VaultPasswordDialog } from './VaultPasswordDialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Lock, Plus, Cog, ArrowRightLeft, LogOut } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

export function VaultSwitcher() {
  const { db, activeVaultFileName } = useStore()
  const navigate = useNavigate()
  const [vaults, setVaults] = useState<string[]>([])
  const [metas, setMetas] = useState<Record<string, CachedVaultMeta>>({})
  const [switchTarget, setSwitchTarget] = useState<string | null>(null)
  const [showNewVault, setShowNewVault] = useState(false)

  useEffect(() => {
    FileStorage.listVaultFiles().then(setVaults)
    FileStorage.getCachedVaultMetas().then((list) => {
      const map: Record<string, CachedVaultMeta> = {}
      for (const m of list) map[m.fileName] = m
      setMetas(map)
    })
  }, [activeVaultFileName])

  const currentName = db?.getData().name || activeVaultFileName?.replace(/\.keya$/, '') || 'Vault'
  const currentIcon = db?.getData().icon || ''

  const handleSwitch = async (fileName: string, password: string) => {
    const newDb = await FileStorage.openVault(fileName, password)
    useStore.getState().lock()
    useStore.setState({
      db: newDb,
      password,
      activeVaultFileName: fileName,
      workspaceState: 'unlocked',
    })
    setSwitchTarget(null)
  }

  const handleCreate = async (password: string) => {
    const fileName = `vault-${Date.now()}.keya`
    const newDb = await FileStorage.createVault(fileName, password)
    useStore.getState().lock()
    useStore.setState({
      db: newDb,
      password,
      activeVaultFileName: fileName,
      workspaceState: 'unlocked',
    })
    setShowNewVault(false)
  }

  return (
    <div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="w-full h-12 flex items-center gap-2 px-4 hover:bg-surface-3 transition-colors">
            <div className="flex items-center justify-center size-6 rounded-md bg-surface-3 text-ink-secondary text-xs shrink-0">
              {currentIcon ? currentIcon : <Lock className="size-3.5" />}
            </div>
            <span className="text-sm font-semibold tracking-tight text-ink-primary truncate flex-1 text-left">
              {currentName}
            </span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-52">
          <DropdownMenuItem onClick={() => navigate("/settings")} className="text-ink-quaternary">
            <Cog className="size-3.5" />
            <span>Settings</span>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuSub>
            <DropdownMenuSubTrigger className="text-ink-quaternary">
              <ArrowRightLeft className="size-3.5" />
              <span>Switch Vault</span>
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="w-52 max-h-64 overflow-y-auto">
              {vaults.map((f) => {
                const meta = metas[f]
                const isActive = f === activeVaultFileName
                const name = meta?.name || f.replace(/\.keya$/, '')
                return (
                  <DropdownMenuItem
                    key={f}
                    disabled={isActive}
                    onClick={() => setSwitchTarget(f)}
                    className={isActive ? 'bg-surface-4 text-ink-secondary' : 'text-ink-tertiary'}
                  >
                    <span className="text-sm">{meta?.icon ? meta.icon : <Lock className="size-3.5" />}</span>
                    <span className="truncate flex-1">{name}</span>
                    {isActive && <span className="ml-auto text-2xs text-ink-quaternary">active</span>}
                  </DropdownMenuItem>
                )
              })}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setShowNewVault(true)} className="text-ink-quaternary">
                <Plus className="size-3" />
                <span>New Vault</span>
              </DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuItem onClick={() => useStore.getState().lock()} className="text-ink-quaternary">
            <LogOut className="size-3.5" />
            <span>Lock</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={!!switchTarget} onOpenChange={(v) => !v && setSwitchTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Unlock Vault</DialogTitle>
            <DialogDescription>
              Enter the master password for {metas[switchTarget!]?.name || switchTarget?.replace(/\.keya$/, '')}
            </DialogDescription>
          </DialogHeader>
          <VaultPasswordDialog
            mode="unlock"
            vaultName={metas[switchTarget!]?.name || switchTarget?.replace(/\.keya$/, '') || ''}
            onSubmit={(pw) => switchTarget && handleSwitch(switchTarget, pw)}
            onCancel={() => setSwitchTarget(null)}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={showNewVault} onOpenChange={setShowNewVault}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Create New Vault</DialogTitle>
            <DialogDescription>Set a master password for your new vault</DialogDescription>
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
  )
}
