import { useRef } from "react"
import { useStore } from "../../store/useStore"
import { Search, Plus, Sun, Moon, Monitor, Download, Upload, MoreHorizontal } from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"

function downloadJSON(data: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url; a.download = filename
  document.body.appendChild(a); a.click(); document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export function TopBar() {
  const { searchQuery, setSearchQuery, setShowAddForm, theme, setTheme, db, password, setDb } = useStore()
  const importRef = useRef<HTMLInputElement>(null)

  const handleExport = () => {
    if (!db) return
    const data = db.getData()
    // Warn: contains plain-text keys
    downloadJSON(data, `keya-export-${new Date().toISOString().slice(0, 10)}.json`)
  }

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !db) return
    try {
      const text = await file.text()
      const imported = JSON.parse(text)
      if (!imported.api_keys || !Array.isArray(imported.api_keys)) {
        alert("Invalid Keya export format.")
        return
      }
      // Merge: import all keys, categories, tags, settings
      const current = db.getData()
      for (const key of imported.api_keys) {
        db.addApiKey({
          name: key.name || "Imported Key",
          key: key.key || "",
          description: key.description || "",
          provider: key.provider || "Custom",
          service: key.service || "",
          endpoint: key.endpoint || "",
          category_id: key.category_id || current.categories[0]?.id || null,
          tag_ids: key.tag_ids || [],
          notes: key.notes || "",
          last_tested: null,
          test_status: null,
          test_latency_ms: null,
        })
      }
      // Create new DB reference to trigger re-render
      const freshDb = new Database(db.getData())
      setDb(freshDb)
      // Save to .keya
      const { FileStorage } = await import("../../lib/storage")
      await FileStorage.save(freshDb.getData(), password || "")
    } catch {
      alert("Failed to parse file.")
    }
    // Reset input
    e.target.value = ""
  }

  return (
    <header className="h-12 flex items-center gap-3 px-4 border-b border-white/[0.05] bg-canvas-base shrink-0">
      <div className="relative flex-1 max-w-md">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-ink-quaternary" />
        <input type="text" placeholder="Search keys..." value={searchQuery}
               onChange={(e) => setSearchQuery(e.target.value)}
               className="w-full h-8 pl-8 pr-3 rounded-md bg-white/[0.02] border border-white/[0.08]
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
        <DropdownMenuContent align="end" className="w-40">
          <DropdownMenuItem onClick={() => importRef.current?.click()}>
            <Upload className="size-3.5" /> Import JSON
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleExport}>
            <Download className="size-3.5" /> Export JSON
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setShowAddForm(true)}>
            <Plus className="size-3.5" /> Add Key
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <input ref={importRef} type="file" accept=".json" className="hidden" onChange={handleImport} />

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
