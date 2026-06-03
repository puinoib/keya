import { useState, useEffect, useRef } from 'react'
import { useStore } from '../../store/useStore'
import { FileStorage, type CachedVaultMeta } from '../../lib/storage'
import { VaultPasswordDialog } from './VaultPasswordDialog'
import { ChevronDown, Plus } from 'lucide-react'

export function VaultSwitcher() {
  const { db, activeVaultFileName } = useStore()
  const [open, setOpen] = useState(false)
  const [vaults, setVaults] = useState<string[]>([])
  const [metas, setMetas] = useState<Record<string, CachedVaultMeta>>({})
  const [switchTarget, setSwitchTarget] = useState<string | null>(null)
  const [showNewVault, setShowNewVault] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    FileStorage.listVaultFiles().then(setVaults)
    FileStorage.getCachedVaultMetas().then((list) => {
      const map: Record<string, CachedVaultMeta> = {}
      for (const m of list) map[m.fileName] = m
      setMetas(map)
    })
  }, [activeVaultFileName])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  const currentName = db?.getData().name || activeVaultFileName?.replace(/\.keya$/, '') || 'Vault'
  const currentIcon = db?.getData().icon || '🔐'
  const currentColor = db?.getData().color || '#3b82f6'

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
    setOpen(false)
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
    setOpen(false)
  }

  if (switchTarget) {
    return (
      <div className="p-3 border-b border-line-subtle">
        <VaultPasswordDialog
          mode="unlock"
          vaultName={metas[switchTarget]?.name || switchTarget.replace(/\.keya$/, '')}
          onSubmit={(pw) => handleSwitch(switchTarget, pw)}
          onCancel={() => setSwitchTarget(null)}
        />
      </div>
    )
  }

  if (showNewVault) {
    return (
      <div className="p-3 border-b border-line-subtle">
        <VaultPasswordDialog
          mode="new"
          vaultName="New Vault"
          onSubmit={handleCreate}
          onCancel={() => setShowNewVault(false)}
        />
      </div>
    )
  }

  return (
    <div ref={ref} className="relative border-b border-line-subtle">
      <button
        onClick={() => setOpen(!open)}
        className="w-full h-12 flex items-center gap-2 px-4 hover:bg-surface-3 transition-colors"
      >
        <div
          className="flex items-center justify-center size-6 rounded-md text-xs shrink-0"
          style={{ backgroundColor: `${currentColor}20`, color: currentColor }}
        >
          {currentIcon}
        </div>
        <span className="text-sm font-semibold tracking-tight text-ink-primary truncate flex-1 text-left">
          {currentName}
        </span>
        <ChevronDown className={`size-3.5 text-ink-quaternary transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full z-50 bg-canvas-panel border border-line rounded-b-md shadow-lg py-1 max-h-64 overflow-y-auto">
          {vaults.map((f) => {
            const meta = metas[f]
            const isActive = f === activeVaultFileName
            const name = meta?.name || f.replace(/\.keya$/, '')
            return (
              <button
                key={f}
                disabled={isActive}
                onClick={() => { setSwitchTarget(f) }}
                className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs transition-colors
                  ${isActive ? 'bg-surface-4 text-ink-secondary' : 'text-ink-tertiary hover:bg-surface-3 hover:text-ink-primary'}`}
              >
                <span className="text-sm">{meta?.icon ?? '🔐'}</span>
                <span className="truncate">{name}</span>
                {isActive && <span className="ml-auto text-2xs text-ink-quaternary">active</span>}
              </button>
            )
          })}
          <div className="border-t border-line-subtle mt-1 pt-1">
            <button
              onClick={() => setShowNewVault(true)}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-ink-quaternary hover:text-ink-tertiary hover:bg-surface-3 transition-colors"
            >
              <Plus className="size-3" />
              <span>New Vault</span>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
