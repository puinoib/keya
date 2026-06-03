import { useRef } from "react"
import { useStore } from "../../store/useStore"
import { Search, Plus, Sun, Moon, Monitor, Download, Upload, FileKey, FileJson, MoreHorizontal } from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { deserializeFromFile, serializeToFile, type KeyaDatabase } from "../../../core"
import { FileStorage } from "../../lib/storage"
import { Database } from "../../../core/database"

function downloadBytes(data: Uint8Array, filename: string) {
  const blob = new Blob([data], { type: "application/octet-stream" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url; a.download = filename
  document.body.appendChild(a); a.click(); document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

function downloadJSON(data: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url; a.download = filename
  document.body.appendChild(a); a.click(); document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/** Merge imported database into current DB — creates a fresh Database to trigger re-render */
function mergeIntoDb(current: Database, imported: KeyaDatabase): void {
  for (const key of imported.api_keys) {
    current.addApiKey({
      name: key.name || "Imported Key",
      key: key.key || "",
      description: key.description || "",
      provider: key.provider || "Custom",
      service: key.service || "",
      endpoint: key.endpoint || "",
      status: key.status || "active",
      category_id: key.category_id || current.getData().categories[0]?.id || null,
      tag_ids: key.tag_ids || [],
      notes: key.notes || "",
      last_tested: key.last_tested ?? null,
      test_status: key.test_status ?? null,
      test_latency_ms: key.test_latency_ms ?? null,
    })
  }
}

export function TopBar() {
  const { searchQuery, setSearchQuery, setShowAddForm, theme, setTheme, db, password, setDb } = useStore()
  const importKeyaRef = useRef<HTMLInputElement>(null)
  const importJsonRef = useRef<HTMLInputElement>(null)

  /* ──── Export .keya ──── */
  const handleExportKeya = async () => {
    if (!db || !password) return
    try {
      const bytes = await serializeToFile(db.getData(), password)
      const date = new Date().toISOString().slice(0, 10)
      downloadBytes(bytes, `keya-${date}.keya`)
    } catch (e) {
      console.error("Export .keya failed:", e)
      alert("Failed to export .keya file.")
    }
  }

  /* ──── Import .keya ──── */
  const handleImportKeya = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !db) return
    e.target.value = ""

    const pw = prompt("Enter the password for this .keya file:")
    if (!pw) return

    try {
      const buffer = await file.arrayBuffer()
      const imported = await deserializeFromFile(new Uint8Array(buffer), pw)
      mergeIntoDb(db, imported)

      // Refresh store with fresh Database ref
      setDb(new Database(db.getData()))

      // Save merged database to workspace
      await FileStorage.save(db.getData(), password || "")
    } catch (e) {
      console.error("Import .keya failed:", e)
      alert("Failed to open .keya file. Wrong password or corrupted file.")
    }
  }

  /* ──── Export JSON ──── */
  const handleExportJson = () => {
    if (!db) return
    const date = new Date().toISOString().slice(0, 10)
    downloadJSON(db.getData(), `keya-export-${date}.json`)
  }

  /* ──── Import JSON ──── */
  const handleImportJson = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !db) return
    try {
      const text = await file.text()
      const imported = JSON.parse(text)
      if (!imported.api_keys || !Array.isArray(imported.api_keys)) {
        alert("Invalid Keya export format.")
        return
      }
      mergeIntoDb(db, imported as KeyaDatabase)

      // Refresh store with fresh Database ref
      setDb(new Database(db.getData()))

      // Save to .keya
      await FileStorage.save(db.getData(), password || "")
    } catch {
      alert("Failed to parse file.")
    }
    e.target.value = ""
  }

  return (
    <header className="h-12 flex items-center gap-3 px-4 border-b border-line-subtle bg-canvas-base shrink-0">
      <div className="relative flex-1 max-w-md">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-ink-quaternary" />
        <input type="text" placeholder="Search keys..." value={searchQuery}
               onChange={(e) => setSearchQuery(e.target.value)}
               className="w-full h-8 pl-8 pr-3 rounded-md bg-surface-2 border border-line
                          text-sm text-ink-primary placeholder:text-ink-quaternary
                          focus:outline-none focus:ring-1 focus:ring-accent-bright transition-colors duration-150" />
      </div>

      <div className="flex-1" />

      {/* More menu */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="btn-ghost text-xs">
            <MoreHorizontal className="size-3.5" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          {/* Keya import/export — encrypted, first priority */}
          <DropdownMenuItem onClick={() => importKeyaRef.current?.click()}>
            <FileKey className="size-3.5" /> Import .keya
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleExportKeya}>
            <Download className="size-3.5" /> Export .keya
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {/* JSON import/export — unencrypted, secondary */}
          <DropdownMenuItem onClick={() => importJsonRef.current?.click()}>
            <FileJson className="size-3.5" /> Import JSON
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleExportJson}>
            <Download className="size-3.5" /> Export JSON
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setShowAddForm(true)}>
            <Plus className="size-3.5" /> Add Key
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <input ref={importKeyaRef} type="file" accept=".keya" className="hidden" onChange={handleImportKeya} />
      <input ref={importJsonRef} type="file" accept=".json" className="hidden" onChange={handleImportJson} />

      {/* Theme toggle */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="btn-ghost text-xs">
            {theme === "dark" ? <Moon className="size-3.5" /> : theme === "light" ? <Sun className="size-3.5" /> : <Monitor className="size-3.5" />}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-36">
          <DropdownMenuItem onClick={() => setTheme("dark")} className="gap-2">
            <Moon className="size-3.5" /> {theme === "dark" ? "✓ Dark" : "Dark"}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setTheme("light")} className="gap-2">
            <Sun className="size-3.5" /> {theme === "light" ? "✓ Light" : "Light"}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setTheme("system")} className="gap-2">
            <Monitor className="size-3.5" /> {theme === "system" ? "✓ System" : "System"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <button onClick={() => setShowAddForm(true)} className="btn-primary text-xs">
        <Plus className="size-3.5" /> Add Key
      </button>
    </header>
  )
}
