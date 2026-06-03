import { useState, useEffect, useRef } from 'react'
import { FileStorage, type CachedVaultMeta } from '../../lib/storage'
import { Database, deserializeFromFile } from '../../../core'
import { useStore } from '../../store/useStore'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { VaultCard } from '../vault/VaultCard'
import { VaultPasswordDialog } from '../vault/VaultPasswordDialog'
import { FolderOpen, Loader2, Upload, AlertTriangle, Sun, Moon, Monitor, Plus } from 'lucide-react'
import logoSvg from '../../../../public/icon.svg'

const supportsFSA = typeof window !== 'undefined' && 'showDirectoryPicker' in window

type Mode = 'home' | 'unlock' | 'new'

export function WelcomePage() {
  const [mode, setMode] = useState<Mode>('home')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [folderName, setFolderName] = useState<string | null>(null)
  const [vaultFiles, setVaultFiles] = useState<string[]>([])
  const [cachedMetas, setCachedMetas] = useState<Record<string, CachedVaultMeta>>({})
  const [selectedVault, setSelectedVault] = useState<string | null>(null)
  const [newVaultName, setNewVaultName] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { theme, setTheme } = useStore()

  useEffect(() => {
    if (mode !== 'home') return
    if (supportsFSA) {
      FileStorage.getWorkspaceName().then(setFolderName)
      FileStorage.listVaultFiles().then(setVaultFiles)
      FileStorage.getCachedVaultMetas().then((list) => {
        const map: Record<string, CachedVaultMeta> = {}
        for (const m of list) map[m.fileName] = m
        setCachedMetas(map)
      })
    }
  }, [mode])

  // ── Handlers ──

  const handleChooseFolder = async () => {
    setLoading(true)
    setError('')
    try {
      const dirHandle = await FileStorage.setupWorkspace()
      setFolderName(dirHandle.name)
      const files = await FileStorage.listVaultFiles()
      setVaultFiles(files)
    } catch { /* cancelled */ }
    setLoading(false)
  }

  const handleUnlockVault = async (fileName: string, password: string) => {
    const db = await FileStorage.openVault(fileName, password)
    useStore.setState({
      db,
      password,
      activeVaultFileName: fileName,
      workspaceState: 'unlocked',
    })
  }

  const handleCreateVault = async (password: string) => {
    const fileName = newVaultName
      ? `${newVaultName.replace(/\.keya$/, '')}.keya`
      : `vault-${Date.now()}.keya`
    const db = await FileStorage.createVault(fileName, password)
    useStore.setState({
      db,
      password,
      activeVaultFileName: fileName,
      workspaceState: 'unlocked',
    })
  }

  const handleSwitchFolder = async () => {
    await FileStorage.clearWorkspace()
    setFolderName(null)
    setVaultFiles([])
    setCachedMetas({})
  }

  // ── Legacy (mobile) ──

  const handleLegacyFilePicked = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    ;(window as any).__legacyFile = file
    setSelectedVault(file.name)
    setMode('unlock')
  }

  const handleLegacyUnlock = async (password: string) => {
    const file = (window as any).__legacyFile as File | undefined
    if (!file) throw new Error('Please select a .keya file first.')
    const buffer = await file.arrayBuffer()
    const data = await deserializeFromFile(new Uint8Array(buffer), password)
    const db = new Database(data)
    useStore.setState({
      db,
      password,
      activeVaultFileName: file.name,
      workspaceState: 'unlocked',
    })
  }

  // ── Render ──

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-canvas-deepest">
      {/* Theme toggle */}
      <div className="absolute top-4 right-4 flex items-center gap-1 bg-surface-2 rounded-md border border-line p-0.5">
        {([['system', Monitor], ['light', Sun], ['dark', Moon]] as const).map(([t, Icon]) => (
          <button key={t} onClick={() => setTheme(t)}
                  className={`p-1.5 rounded transition-colors ${theme === t ? 'bg-surface-5 text-ink-primary' : 'text-ink-quaternary hover:text-ink-secondary'}`}>
            <Icon className="size-3.5" />
          </button>
        ))}
      </div>
      <div className="w-full max-w-xs">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <img src={logoSvg} alt="Keya" className="size-11 mb-3.5" />
          <h1 className="text-xl font-semibold tracking-tight text-ink-primary">Keya</h1>
          <p className="text-xs text-ink-tertiary mt-1">Your Key Guardian</p>
        </div>

        {/* Browser warning */}
        {!supportsFSA && mode === 'home' && (
          <div className="mb-4 flex items-start gap-2 px-3 py-2.5 rounded-md bg-amber-500/10 border border-amber-500/20">
            <AlertTriangle className="size-3.5 text-amber-400 shrink-0 mt-0.5" />
            <p className="text-2xs text-amber-300 leading-relaxed">
              Your browser doesn't support automatic file syncing. Use desktop Chrome for the best experience.
            </p>
          </div>
        )}

        {/* Mode: Home — vault list */}
        {mode === 'home' && supportsFSA && (
          <div className="space-y-2.5">
            {folderName ? (
              <>
                <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-surface-2 border border-line">
                  <FolderOpen className="size-4 text-ink-quaternary shrink-0" />
                  <span className="text-xs text-ink-secondary truncate">{folderName}</span>
                </div>

                {vaultFiles.length > 0 ? (
                  <div className="space-y-1.5">
                    {vaultFiles.map((f) => (
                      <VaultCard
                        key={f}
                        fileName={f}
                        meta={cachedMetas[f]}
                        onClick={() => { setSelectedVault(f); setMode('unlock') }}
                      />
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-ink-quaternary text-center py-2">No vaults found</p>
                )}

                <button onClick={() => setMode('new')}
                        className="w-full flex items-center justify-center gap-2 rounded-md bg-accent px-4 py-2.5 text-sm font-medium text-white hover:bg-accent-bright transition-colors">
                  <Plus className="size-4" /> New Vault
                </button>
                <button onClick={handleSwitchFolder}
                        className="w-full text-xs text-ink-quaternary hover:text-ink-tertiary transition-colors py-1">
                  Change Sync Folder
                </button>
              </>
            ) : (
              <button onClick={handleChooseFolder} disabled={loading}
                      className="w-full flex items-center justify-center gap-2 rounded-md bg-accent px-4 py-2.5 text-sm font-medium text-white hover:bg-accent-bright transition-colors disabled:opacity-50">
                {loading ? <Loader2 className="size-4 animate-spin" /> : <FolderOpen className="size-4" />}
                Choose Sync Folder
              </button>
            )}
          </div>
        )}

        {/* Mode: Home — legacy (mobile) */}
        {mode === 'home' && !supportsFSA && (
          <div className="space-y-2.5">
            <button onClick={() => fileInputRef.current?.click()} disabled={loading}
                    className="w-full flex items-center justify-center gap-2 rounded-md bg-accent px-4 py-2.5 text-sm font-medium text-white hover:bg-accent-bright transition-colors disabled:opacity-50">
              <Upload className="size-4" /> Open .keya File
            </button>
            <input ref={fileInputRef} type="file" accept=".keya" className="hidden" onChange={handleLegacyFilePicked} />
          </div>
        )}

        {/* Mode: Unlock */}
        {mode === 'unlock' && selectedVault && (
          <VaultPasswordDialog
            mode="unlock"
            vaultName={cachedMetas[selectedVault]?.name || selectedVault.replace(/\.keya$/, '')}
            onSubmit={supportsFSA
              ? (pw) => handleUnlockVault(selectedVault, pw)
              : handleLegacyUnlock}
            onCancel={() => { setMode('home'); setSelectedVault(null) }}
          />
        )}

        {/* Mode: New */}
        {mode === 'new' && (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-ink-tertiary">Vault Name</Label>
              <Input
                value={newVaultName}
                onChange={(e) => setNewVaultName(e.target.value)}
                placeholder="My Vault"
              />
            </div>
            <VaultPasswordDialog
              mode="new"
              vaultName={newVaultName || 'New Vault'}
              onSubmit={handleCreateVault}
              onCancel={() => { setMode('home'); setNewVaultName('') }}
            />
          </div>
        )}

        {error && <p className="text-xs text-danger text-center mt-2">{error}</p>}

        <p className="text-center text-2xs text-ink-quaternary mt-10">
          Your keys stay on your device. Encrypted end-to-end.
        </p>
        <a href="https://github.com/puinoib/keya" target="_blank" rel="noopener noreferrer"
           className="block text-center text-2xs text-ink-quaternary hover:text-ink-tertiary transition-colors mt-2">
          GitHub
        </a>
      </div>
    </div>
  )
}
