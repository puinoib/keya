import { useState, useRef } from "react"
import { FileStorage } from "../../lib/storage"
import { Database } from "../../../core/database"
import { useStore } from "../../store/useStore"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { FolderOpen, FileKey, Key, ArrowRight, Loader2, Upload, AlertTriangle } from "lucide-react"

const supportsFSA = typeof window !== "undefined" && "showDirectoryPicker" in window

export function WelcomePage() {
  const [mode, setMode] = useState<"home" | "new" | "unlock">("home")
  const [password, setPassword] = useState("")
  const [passwordConfirm, setPasswordConfirm] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { setWorkspaceState, setDb, setPassword: setStorePassword } = useStore()

  // ── Password strength ──

  function getStrength(pw: string): { score: number; label: string; color: string } {
    let score = 0
    if (pw.length >= 8) score++
    if (pw.length >= 12) score++
    if (/[A-Z]/.test(pw)) score++
    if (/[0-9]/.test(pw)) score++
    if (/[^A-Za-z0-9]/.test(pw)) score++
    if (score <= 1) return { score: 1, label: "Weak", color: "#ef4444" }
    if (score <= 2) return { score: 2, label: "Fair", color: "#f59e0b" }
    if (score <= 3) return { score: 3, label: "Good", color: "#10b981" }
    if (score <= 4) return { score: 4, label: "Strong", color: "#3b82f6" }
    return { score: 5, label: "Very Strong", color: "#8b5cf6" }
  }

  // ── Native (desktop Chrome) ──

  const handleSetup = async () => {
    setLoading(true)
    setError("")
    try {
      const { existingFile } = await FileStorage.setupWorkspace()
      if (existingFile) setMode("unlock")
      else setMode("new")
    } catch { /* cancelled */ }
    setLoading(false)
  }

  const handleCreate = async () => {
    if (!password) return
    if (password !== passwordConfirm) { setError("Passwords don't match."); return }
    if (password.length < 8) { setError("Password must be at least 8 characters."); return }
    setLoading(true)
    setError("")
    try {
      const db = new Database()
      if (supportsFSA) {
        await FileStorage.save(db.getData(), password)
      } else {
        await FileStorage.saveViaDownload(db.getData(), password)
      }
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
      if (!result) { setError("No workspace found. Set up a sync folder first."); setLoading(false); return }
      setMode("unlock")
    } catch { setError("No .keya file found.") }
    setLoading(false)
  }

  const handleUnlock = async () => {
    if (!password) return
    setLoading(true)
    setError("")
    try {
      const result = await FileStorage.autoOpen()
      if (!result) { setError("Workspace not accessible."); setLoading(false); return }
      const data = await FileStorage.load(result.file, password)
      const db = new Database(data)
      setDb(db)
      setStorePassword(password)
      setWorkspaceState("unlocked")
    } catch { setError("Wrong password. Try again.") }
    setLoading(false)
  }

  // ── Legacy fallback (iOS / mobile) ──

  const handleLegacyOpen = () => {
    fileInputRef.current?.click()
  }

  const handleLegacyFilePicked = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setMode("unlock")
    // Store file ref for unlock
    ;(window as any).__legacyFile = file
  }

  const handleLegacyUnlock = async () => {
    if (!password) return
    setLoading(true)
    setError("")
    try {
      const file = (window as any).__legacyFile as File | undefined
      if (!file) { setError("Please select a .keya file first."); setLoading(false); return }
      const data = await FileStorage.load(file, password)
      const db = new Database(data)
      setDb(db)
      setStorePassword(password)
      setWorkspaceState("unlocked")
    } catch { setError("Wrong password. Try again.") }
    setLoading(false)
  }

  // ── Render ──

  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas-deepest">
      <div className="w-full max-w-xs">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="flex items-center justify-center size-11 rounded-xl bg-accent text-white mb-3.5 shadow-lg shadow-accent/20">
            <Key className="size-5" />
          </div>
          <h1 className="text-xl font-semibold tracking-tight text-ink-primary">Keya</h1>
          <p className="text-xs text-ink-tertiary mt-1">Your Key Guardian</p>
        </div>

        {/* ── Browser warning ── */}
        {!supportsFSA && mode === "home" && (
          <div className="mb-4 flex items-start gap-2 px-3 py-2.5 rounded-md bg-amber-500/10 border border-amber-500/20">
            <AlertTriangle className="size-3.5 text-amber-400 shrink-0 mt-0.5" />
            <p className="text-2xs text-amber-300 leading-relaxed">
              Your browser doesn't support automatic file syncing. Use desktop Chrome for the best experience.
              You can still open a .keya file below.
            </p>
          </div>
        )}

        {/* Mode: Home */}
        {mode === "home" && (
          <div className="space-y-2.5">
            {supportsFSA && (
              <>
                <button onClick={handleSetup} disabled={loading}
                        className="w-full flex items-center justify-center gap-2 rounded-md bg-accent px-4 py-2.5 text-sm font-medium text-white hover:bg-accent-bright transition-colors disabled:opacity-50">
                  {loading ? <Loader2 className="size-4 animate-spin" /> : <FolderOpen className="size-4" />}
                  Setup Sync Folder
                </button>
                <Separator className="my-3" />
                <button onClick={handleOpen} disabled={loading}
                        className="w-full flex items-center justify-center gap-2 rounded-md bg-surface-2 border border-line px-4 py-2.5 text-sm text-ink-secondary hover:bg-surface-5 hover:text-ink-primary transition-colors disabled:opacity-50">
                  <FileKey className="size-4" /> Open .keya File
                </button>
              </>
            )}

            {!supportsFSA && (
              <>
                <button onClick={handleLegacyOpen} disabled={loading}
                        className="w-full flex items-center justify-center gap-2 rounded-md bg-accent px-4 py-2.5 text-sm font-medium text-white hover:bg-accent-bright transition-colors disabled:opacity-50">
                  <Upload className="size-4" /> Open .keya File
                </button>
                <input ref={fileInputRef} type="file" accept=".keya" className="hidden" onChange={handleLegacyFilePicked} />
              </>
            )}

            {error && <p className="text-xs text-danger text-center">{error}</p>}
          </div>
        )}

        {/* Mode: New */}
        {mode === "new" && (
          <div className="space-y-3">
            <div className="flex items-center gap-2.5 mb-2">
              <div className="flex items-center justify-center size-8 rounded-lg bg-accent/15 text-accent-bright"><Key className="size-4" /></div>
              <div>
                <p className="text-sm font-medium text-ink-primary">Create Vault</p>
                <p className="text-2xs text-ink-quaternary">Set a master password</p>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="new-password" className="text-xs text-ink-tertiary">Master Password</Label>
              <Input id="new-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                     placeholder="Choose a strong password..." onKeyDown={(e) => e.key === "Enter" && handleCreate()} />
              {/* Strength bar */}
              {password && (() => {
                const s = getStrength(password)
                return (
                  <div className="space-y-1">
                    <div className="flex gap-1">
                      {[1,2,3,4,5].map((i) => (
                        <div key={i} className="h-1 flex-1 rounded-full transition-colors duration-200"
                             style={{ backgroundColor: i <= s.score ? s.color : "var(--surface-6)" }} />
                      ))}
                    </div>
                    <p className="text-2xs" style={{ color: s.color }}>{s.label}</p>
                  </div>
                )
              })()}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="new-password-confirm" className="text-xs text-ink-tertiary">Confirm Password</Label>
              <Input id="new-password-confirm" type="password" value={passwordConfirm}
                     onChange={(e) => setPasswordConfirm(e.target.value)}
                     placeholder="Re-enter your password..."
                     className={passwordConfirm && password !== passwordConfirm ? "border-red-500/50" : ""}
                     onKeyDown={(e) => e.key === "Enter" && handleCreate()} />
              {passwordConfirm && password !== passwordConfirm && (
                <p className="text-2xs text-danger">Passwords don't match</p>
              )}
            </div>
            {error && <p className="text-xs text-danger">{error}</p>}
            <button onClick={handleCreate} disabled={loading || !password || !passwordConfirm || password !== passwordConfirm}
                    className="w-full flex items-center justify-center gap-2 rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-bright transition-colors disabled:opacity-50">
              {loading ? <Loader2 className="size-4 animate-spin" /> : <ArrowRight className="size-4" />} Create Vault
            </button>
            <button onClick={() => { setMode("home"); setPassword(""); setPasswordConfirm(""); setError("") }}
                    className="w-full text-xs text-ink-quaternary hover:text-ink-tertiary transition-colors py-1">← Back</button>
          </div>
        )}

        {/* Mode: Unlock */}
        {mode === "unlock" && (
          <div className="space-y-3">
            <div className="flex items-center gap-2.5 mb-2">
              <div className="flex items-center justify-center size-8 rounded-lg bg-accent/15 text-accent-bright"><Key className="size-4" /></div>
              <div>
                <p className="text-sm font-medium text-ink-primary">Unlock Vault</p>
                <p className="text-2xs text-ink-quaternary">Enter your master password</p>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="unlock-password" className="text-xs text-ink-tertiary">Master Password</Label>
              <Input id="unlock-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                     placeholder="Enter password..." onKeyDown={(e) => e.key === "Enter" && (supportsFSA ? handleUnlock() : handleLegacyUnlock())} />
            </div>
            {error && <p className="text-xs text-danger">{error}</p>}
            <button onClick={supportsFSA ? handleUnlock : handleLegacyUnlock} disabled={loading || !password}
                    className="w-full flex items-center justify-center gap-2 rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-bright transition-colors disabled:opacity-50">
              {loading ? <Loader2 className="size-4 animate-spin" /> : <ArrowRight className="size-4" />} Unlock
            </button>
            <button onClick={() => { setMode("home"); setPassword(""); setError(""); delete (window as any).__legacyFile }}
                    className="w-full text-xs text-ink-quaternary hover:text-ink-tertiary transition-colors py-1">← Back</button>
          </div>
        )}

        {/* Footer */}
        <p className="text-center text-2xs text-ink-quaternary mt-10">
          Your keys stay on your device. Encrypted end-to-end.
        </p>
      </div>
    </div>
  )
}
