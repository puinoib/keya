import { useState } from "react"
import { FileStorage } from "../../lib/storage"
import { Database } from "../../../core/database"
import { useStore } from "../../store/useStore"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { FolderOpen, FileKey, Key, ArrowRight, Loader2 } from "lucide-react"

export function WelcomePage() {
  const [mode, setMode] = useState<"home" | "new" | "unlock">("home")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const { setWorkspaceState, setDb, setPassword: setStorePassword } = useStore()

  const handleSetup = async () => {
    setLoading(true)
    setError("")
    try {
      const { directoryHandle, existingFile } = await FileStorage.setupWorkspace()
      if (existingFile) {
        // Existing .keya found → go to unlock
        setMode("unlock")
      } else {
        // New workspace → go to create password
        setMode("new")
      }
    } catch {
      // User cancelled
    }
    setLoading(false)
  }

  const handleCreate = async () => {
    if (!password) return
    setLoading(true)
    setError("")
    try {
      const db = new Database()
      await FileStorage.save(db.getData(), password)
      setDb(db)
      setStorePassword(password)
      setWorkspaceState("unlocked")
    } catch (e) {
      setError(String(e))
    }
    setLoading(false)
  }

  const handleOpen = async () => {
    setLoading(true)
    setError("")
    try {
      const result = await FileStorage.autoOpen()
      if (!result) {
        setError("No workspace found. Set up a sync folder first.")
        setLoading(false)
        return
      }
      // File found → go to unlock
      setMode("unlock")
    } catch {
      setError("No .keya file found.")
    }
    setLoading(false)
  }

  const handleUnlock = async () => {
    if (!password) return
    setLoading(true)
    setError("")
    try {
      const result = await FileStorage.autoOpen()
      if (!result) {
        setError("Workspace not accessible.")
        setLoading(false)
        return
      }
      const data = await FileStorage.load(result.file, password)
      const db = new Database(data)
      setDb(db)
      setStorePassword(password)
      setWorkspaceState("unlocked")
    } catch {
      setError("Wrong password. Try again.")
    }
    setLoading(false)
  }

  // ── Render by mode ──

  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas-deepest">
      <div className="w-full max-w-xs">
        {/* ── Logo ── */}
        <div className="flex flex-col items-center mb-8">
          <div className="flex items-center justify-center size-11 rounded-xl bg-accent text-white mb-3.5 shadow-lg shadow-accent/20">
            <Key className="size-5" />
          </div>
          <h1 className="text-xl font-semibold tracking-tight text-ink-primary">
            Keya
          </h1>
          <p className="text-xs text-ink-tertiary mt-1">
            Your Key Guardian
          </p>
        </div>

        {/* ── Mode: Home ── */}
        {mode === "home" && (
          <div className="space-y-2.5">
            <button
              onClick={handleSetup}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 rounded-md bg-accent px-4 py-2.5 text-sm font-medium text-white
                         hover:bg-accent-bright transition-colors duration-150 disabled:opacity-50"
            >
              {loading ? <Loader2 className="size-4 animate-spin" /> : <FolderOpen className="size-4" />}
              Setup Sync Folder
            </button>

            <Separator className="my-3" />

            <button
              onClick={handleOpen}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 rounded-md bg-white/[0.02] border border-white/[0.08] px-4 py-2.5 text-sm text-ink-secondary
                         hover:bg-white/[0.05] hover:text-ink-primary transition-colors duration-150 disabled:opacity-50"
            >
              <FileKey className="size-4" />
              Open .keya File
            </button>
          </div>
        )}

        {/* ── Mode: New ── */}
        {mode === "new" && (
          <div className="space-y-3">
            <div className="flex items-center gap-2.5 mb-2">
              <div className="flex items-center justify-center size-8 rounded-lg bg-accent/15 text-accent-bright">
                <Key className="size-4" />
              </div>
              <div>
                <p className="text-sm font-medium text-ink-primary">Create Vault</p>
                <p className="text-2xs text-ink-quaternary">Set a master password</p>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="new-password" className="text-xs text-ink-tertiary">Master Password</Label>
              <Input
                id="new-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Choose a strong password..."
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              />
            </div>

            {error && (
              <p className="text-xs text-danger">{error}</p>
            )}

            <button
              onClick={handleCreate}
              disabled={loading || !password}
              className="w-full flex items-center justify-center gap-2 rounded-md bg-accent px-4 py-2 text-sm font-medium text-white
                         hover:bg-accent-bright transition-colors duration-150 disabled:opacity-50"
            >
              {loading ? <Loader2 className="size-4 animate-spin" /> : <ArrowRight className="size-4" />}
              Create Vault
            </button>

            <button
              onClick={() => { setMode("home"); setPassword(""); setError("") }}
              className="w-full text-xs text-ink-quaternary hover:text-ink-tertiary transition-colors py-1"
            >
              ← Back
            </button>
          </div>
        )}

        {/* ── Mode: Unlock ── */}
        {mode === "unlock" && (
          <div className="space-y-3">
            <div className="flex items-center gap-2.5 mb-2">
              <div className="flex items-center justify-center size-8 rounded-lg bg-accent/15 text-accent-bright">
                <Key className="size-4" />
              </div>
              <div>
                <p className="text-sm font-medium text-ink-primary">Unlock Vault</p>
                <p className="text-2xs text-ink-quaternary">Enter your master password</p>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="unlock-password" className="text-xs text-ink-tertiary">Master Password</Label>
              <Input
                id="unlock-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password..."
                onKeyDown={(e) => e.key === "Enter" && handleUnlock()}
              />
            </div>

            {error && (
              <p className="text-xs text-danger">{error}</p>
            )}

            <button
              onClick={handleUnlock}
              disabled={loading || !password}
              className="w-full flex items-center justify-center gap-2 rounded-md bg-accent px-4 py-2 text-sm font-medium text-white
                         hover:bg-accent-bright transition-colors duration-150 disabled:opacity-50"
            >
              {loading ? <Loader2 className="size-4 animate-spin" /> : <ArrowRight className="size-4" />}
              Unlock
            </button>

            <button
              onClick={() => { setMode("home"); setPassword(""); setError("") }}
              className="w-full text-xs text-ink-quaternary hover:text-ink-tertiary transition-colors py-1"
            >
              ← Back
            </button>
          </div>
        )}

        {/* ── Footer ── */}
        <p className="text-center text-2xs text-ink-quaternary mt-10">
          Your keys stay on your device. Encrypted end-to-end.
        </p>
      </div>
    </div>
  )
}
