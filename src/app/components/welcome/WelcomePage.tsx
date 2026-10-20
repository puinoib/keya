import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import { FileStorage, type CachedVaultMeta } from '../../lib/storage';
import { Database, deserializeFromFile } from '../../../core';
import { useStore } from '../../store/useStore';
import { Input } from '@/components/ui/input';
import { KeyaLogo } from '@/components/ui/keya-logo';
import { Label } from '@/components/ui/label';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import { VaultCard } from '../vault/VaultCard';
import { VaultPasswordDialog } from '../vault/VaultPasswordDialog';
import {
  FolderOpen,
  Spinner,
  UploadSimple,
  Warning,
  Sun,
  Moon,
  Monitor,
  Plus,
  Info,
  Check,
} from '@phosphor-icons/react';
import { EmojiPickerPanel } from '@/app/components/ui/emoji-picker-popover';
import {
  AlertDialogRoot,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog';

const supportsFSA =
  typeof window !== 'undefined' && 'showDirectoryPicker' in window;

const themeOptions = [
  { value: 'system' as const, label: 'System', icon: Monitor },
  { value: 'light' as const, label: 'Light', icon: Sun },
  { value: 'dark' as const, label: 'Dark', icon: Moon },
];

type Mode = 'home' | 'unlock' | 'new';

export function WelcomePage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>('home');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [folderName, setFolderName] = useState<string | null>(null);
  const [vaultFiles, setVaultFiles] = useState<string[]>([]);
  const [needsPermission, setNeedsPermission] = useState(false);
  const [showFolderPickerInfo, setShowFolderPickerInfo] = useState(false);
  const [cachedMetas, setCachedMetas] = useState<
    Record<string, CachedVaultMeta>
  >({});
  const [selectedVault, setSelectedVault] = useState<string | null>(null);
  const [newVaultName, setNewVaultName] = useState('');
  const [newVaultIcon, setNewVaultIcon] = useState('');
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { theme, setTheme, setBiometricPrompt, workspaceState } = useStore();
  const CurrentIcon =
    themeOptions.find((o) => o.value === theme)?.icon ?? Monitor;

  // Auto-redirect to /keys when unlocked
  useEffect(() => {
    if (workspaceState === 'unlocked') {
      navigate({ to: '/keys' });
    }
  }, [workspaceState, navigate]);

  useEffect(() => {
    if (mode !== 'home') return;
    if (supportsFSA) {
      FileStorage.getWorkspaceName().then(setFolderName);
      FileStorage.listVaultFiles().then((files) => {
        if (files === null) {
          setNeedsPermission(true);
          setVaultFiles([]);
        } else {
          setNeedsPermission(false);
          setVaultFiles(files);
        }
      });
      FileStorage.getCachedVaultMetas().then((list) => {
        const map: Record<string, CachedVaultMeta> = {};
        for (const m of list) map[m.fileName] = m;
        setCachedMetas(map);
      });
    }
  }, [mode]);

  useEffect(() => {
    if (!emojiPickerOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (
        emojiPickerRef.current &&
        !emojiPickerRef.current.contains(e.target as Node)
      ) {
        setEmojiPickerOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [emojiPickerOpen]);

  // ── Handlers ──

  const handleChooseFolder = () => {
    setShowFolderPickerInfo(true);
  };

  const handleConfirmChooseFolder = async () => {
    setShowFolderPickerInfo(false);
    setLoading(true);
    setError('');
    try {
      const dirHandle = await FileStorage.setupWorkspace();
      setFolderName(dirHandle.name);
      const files = await FileStorage.listVaultFiles();
      if (files === null) {
        setNeedsPermission(true);
        setVaultFiles([]);
      } else {
        setNeedsPermission(false);
        setVaultFiles(files);
      }
      const metas = await FileStorage.getCachedVaultMetas();
      const map: Record<string, CachedVaultMeta> = {};
      for (const m of metas) map[m.fileName] = m;
      setCachedMetas(map);
    } catch {
      /* cancelled */
    }
    setLoading(false);
  };

  const handleRequestPermission = async () => {
    const granted = await FileStorage.requestPermission();
    if (granted) {
      setNeedsPermission(false);
      const files = await FileStorage.listVaultFiles();
      if (files) setVaultFiles(files);
    } else {
      setError(
        'Permission denied. Please click "Grant Access" again and allow access when prompted by your browser.'
      );
    }
  };

  const handleUnlockVault = async (fileName: string, password: string) => {
    const db = await FileStorage.openVault(fileName, password);
    const vaultId = db.getData().vault_id;
    await useStore.getState().unlock(db, password, fileName);
    setBiometricPrompt({ vaultId, password });
  };

  const handleCreateVault = async (password: string) => {
    const fileName = newVaultName
      ? `${newVaultName.replace(/\.keya$/, '')}.keya`
      : `vault-${Date.now()}.keya`;
    const db = await FileStorage.createVault(fileName, password, {
      name: newVaultName || undefined,
      icon: newVaultIcon || undefined,
    });
    await useStore.getState().unlock(db, password, fileName);
  };

  const handleSwitchFolder = async () => {
    await FileStorage.clearWorkspace();
    setFolderName(null);
    setVaultFiles([]);
    setCachedMetas({});
  };

  const handleOpenFolder = async () => {
    const handle = await FileStorage.getWorkspaceHandle();
    const picker = window.showDirectoryPicker;
    if (!handle || !picker) return;
    try {
      await picker({
        mode: 'read',
        startIn: handle,
      });
    } catch {
      /* cancelled */
    }
  };

  // ── Legacy (mobile) ──

  const handleLegacyFilePicked = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    window.__legacyFile = file;
    setSelectedVault(file.name);
    setMode('unlock');
  };

  const handleLegacyUnlock = async (password: string) => {
    const file = window.__legacyFile;
    if (!file) throw new Error('Please select a .keya file first.');
    const buffer = await file.arrayBuffer();
    const data = await deserializeFromFile(new Uint8Array(buffer), password);
    const db = new Database(data);
    await useStore.getState().unlock(db, password, file.name, 'download');
  };

  // ── Render ──

  return (
    <div className="flex flex-col min-h-screen bg-canvas-deepest">
      {/* Theme toggle */}
      <div className="flex justify-end px-4 pt-4">
        <DropdownMenu>
          <DropdownMenuTrigger className="inline-flex items-center justify-center size-8 rounded-md text-ink-quaternary hover:text-ink-secondary hover:bg-surface-3 transition-colors">
            <CurrentIcon className="size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            {themeOptions.map((opt) => (
              <DropdownMenuItem
                key={opt.value}
                onClick={() => setTheme(opt.value)}
                className="text-xs"
              >
                <opt.icon className="size-3.5" />
                <span>{opt.label}</span>
                {theme === opt.value && (
                  <Check className="size-3.5 ml-auto text-accent-bright" />
                )}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="flex-1 flex items-center justify-center px-4 py-6">
        <div className="w-full max-w-sm">
          {/* Logo */}
          <div className="flex flex-col items-center mb-8">
            <KeyaLogo className="size-14" />
            <h1 className="text-2xl font-semibold tracking-heading text-ink-primary">
              Keya
            </h1>
            <p className="text-xs text-ink-quaternary mt-1.5">
              Local-first AI API key manager
            </p>
          </div>

          {/* Browser warning */}
          {!supportsFSA && mode === 'home' && (
            <div className="mb-4 flex items-start gap-2 px-3 py-2.5 rounded-md bg-amber-500/10 border border-amber-500/20">
              <Warning className="size-3.5 text-amber-400 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-300 leading-relaxed">
                Your browser doesn't support automatic file syncing. Use desktop
                Chrome for the best experience.
              </p>
            </div>
          )}

          {/* Mode content with fade transition */}
          <div key={mode} className="animate-fade-in">
            {/* Mode: Home — vault list */}
            {mode === 'home' && supportsFSA && (
              <div className="space-y-2">
                {folderName ? (
                  <>
                    <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-surface-2 border border-line">
                      <button
                        onClick={handleOpenFolder}
                        className="text-ink-quaternary hover:text-ink-secondary transition-colors shrink-0"
                        title="Open folder"
                      >
                        <FolderOpen className="size-4" />
                      </button>
                      <span className="text-xs text-ink-secondary truncate">
                        {folderName}
                      </span>
                    </div>

                    {vaultFiles.length > 0 ? (
                      <div className="space-y-1.5">
                        {vaultFiles.map((f) => (
                          <VaultCard
                            key={f}
                            fileName={f}
                            meta={cachedMetas[f]}
                            onClick={() => {
                              setSelectedVault(f);
                              setMode('unlock');
                            }}
                          />
                        ))}
                      </div>
                    ) : needsPermission ? (
                      <div className="flex flex-col items-center gap-2 px-4 py-4 rounded-md border border-dashed border-line">
                        <Warning className="size-5 text-amber-400" />
                        <p className="text-xs text-ink-tertiary text-center">
                          Permission required to access vault files
                        </p>
                        <button
                          onClick={handleRequestPermission}
                          className="mt-1 text-xs text-accent hover:text-accent-bright transition-colors"
                        >
                          Grant Access
                        </button>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-1.5 px-4 py-5 rounded-md border border-dashed border-line">
                        <FolderOpen className="size-5 text-ink-quaternary" />
                        <p className="text-xs text-ink-tertiary">
                          No vaults yet
                        </p>
                        <p className="text-xs text-ink-quaternary">
                          Create your first vault to get started
                        </p>
                      </div>
                    )}

                    <button
                      onClick={() => setMode('new')}
                      className="w-full flex items-center justify-center gap-2 rounded-md bg-accent px-4 py-2.5 text-sm font-medium text-white hover:bg-accent-bright transition-colors"
                    >
                      <Plus className="size-4" /> New Vault
                    </button>
                    <button
                      onClick={handleSwitchFolder}
                      className="w-full text-xs text-ink-quaternary hover:text-ink-tertiary transition-colors py-1"
                    >
                      Change Sync Folder
                    </button>
                  </>
                ) : (
                  <button
                    onClick={handleChooseFolder}
                    disabled={loading}
                    className="w-full flex items-center justify-center gap-2 rounded-md bg-accent px-4 py-2.5 text-sm font-medium text-white hover:bg-accent-bright transition-colors disabled:opacity-50"
                  >
                    {loading ? (
                      <Spinner className="size-4 animate-spin" />
                    ) : (
                      <FolderOpen className="size-4" />
                    )}
                    Choose Sync Folder
                  </button>
                )}
              </div>
            )}

            {/* Mode: Home — legacy (mobile) */}
            {mode === 'home' && !supportsFSA && (
              <div className="space-y-2">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 rounded-md bg-accent px-4 py-2.5 text-sm font-medium text-white hover:bg-accent-bright transition-colors disabled:opacity-50"
                >
                  <UploadSimple className="size-4" /> Open .keya File
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".keya"
                  className="hidden"
                  onChange={handleLegacyFilePicked}
                />
              </div>
            )}

            {/* Mode: Unlock */}
            {mode === 'unlock' && selectedVault && (
              <VaultPasswordDialog
                mode="unlock"
                vaultName={
                  cachedMetas[selectedVault]?.name ||
                  selectedVault.replace(/\.keya$/, '')
                }
                vaultIcon={cachedMetas[selectedVault]?.icon}
                fileName={selectedVault}
                vaultId={cachedMetas[selectedVault]?.vault_id}
                onSubmit={
                  supportsFSA
                    ? (pw) => handleUnlockVault(selectedVault, pw)
                    : handleLegacyUnlock
                }
                onCancel={() => {
                  setMode('home');
                  setSelectedVault(null);
                }}
              />
            )}

            {/* Mode: New */}
            {mode === 'new' && (
              <div className="space-y-3">
                <p className="text-sm font-medium text-ink-primary">
                  Create: {newVaultName || 'New Vault'}
                </p>
                <div className="space-y-1.5">
                  <Label className="text-xs text-ink-tertiary">
                    Vault Name
                  </Label>
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <button
                        onClick={() => setEmojiPickerOpen(!emojiPickerOpen)}
                        className="size-9 rounded-md border border-line bg-surface-2 flex items-center justify-center text-base hover:bg-surface-3 transition-colors"
                      >
                        {newVaultIcon || '🔒'}
                      </button>
                      {emojiPickerOpen && (
                        <div
                          ref={emojiPickerRef}
                          className="absolute left-0 top-full mt-1.5 z-50 rounded-lg bg-canvas-panel border border-line shadow-dialog"
                        >
                          <EmojiPickerPanel
                            onSelect={(emoji) => {
                              setNewVaultIcon(emoji);
                              setEmojiPickerOpen(false);
                            }}
                          />
                        </div>
                      )}
                    </div>
                    <Input
                      value={newVaultName}
                      onChange={(e) => setNewVaultName(e.target.value)}
                      placeholder="My Vault"
                      className="flex-1"
                    />
                  </div>
                </div>
                <VaultPasswordDialog
                  mode="new"
                  vaultName={newVaultName || 'New Vault'}
                  vaultIcon={newVaultIcon}
                  onSubmit={handleCreateVault}
                  onCancel={() => {
                    setMode('home');
                    setNewVaultName('');
                    setNewVaultIcon('');
                    setEmojiPickerOpen(false);
                  }}
                />
              </div>
            )}
          </div>

          {error && mode === 'home' && (
            <p className="text-xs text-danger text-center mt-2">{error}</p>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="px-6 py-5">
        <div className="mx-auto max-w-sm flex flex-col items-center gap-3">
          <div className="flex items-center gap-1.5 text-ink-quaternary">
            <svg
              className="size-3 opacity-40"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            <span className="text-xs">
              End-to-end encrypted. Your keys never leave your device.
            </span>
          </div>
          <div className="flex items-center gap-4">
            <Link
              to="/home"
              className="text-xs text-ink-quaternary hover:text-ink-tertiary transition-colors"
            >
              About Keya
            </Link>
            <a
              href="https://coryso.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-ink-quaternary hover:text-ink-tertiary transition-colors"
            >
              Coryso Studio
            </a>
            <a
              href="https://x.com/intent/follow?screen_name=puinoib_"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-ink-quaternary hover:text-ink-tertiary transition-colors"
            >
              X
            </a>
            <a
              href="https://github.com/puinoib/keya"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-ink-quaternary hover:text-ink-tertiary transition-colors"
            >
              GitHub
            </a>
          </div>
        </div>
      </div>

      {/* Folder Picker Info Dialog */}
      <AlertDialogRoot
        open={showFolderPickerInfo}
        onOpenChange={setShowFolderPickerInfo}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="flex items-center gap-2 mb-2">
              <Info className="size-5 text-accent" />
              <AlertDialogTitle>About Sync Folder</AlertDialogTitle>
            </div>
            <AlertDialogDescription className="text-sm text-ink-secondary space-y-3">
              <p>
                Next, you'll see a browser prompt asking for permission to
                access a folder.
              </p>
              <div className="bg-surface-2 rounded-md px-3 py-2 border border-line">
                <p className="text-xs text-ink-tertiary">
                  This allows Keya to save encrypted vault files directly to
                  your chosen folder. Your files stay on your device - nothing
                  is uploaded to any server.
                </p>
              </div>
              <p className="text-xs text-ink-quaternary">
                You can change or revoke this permission at any time.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmChooseFolder}
              className="bg-accent text-white hover:bg-accent-bright"
            >
              Continue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialogRoot>
    </div>
  );
}
