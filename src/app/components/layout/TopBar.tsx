import { useStore } from "../../store/useStore"
import { Search, Plus, SlidersHorizontal } from "lucide-react"

export function TopBar() {
  const { searchQuery, setSearchQuery, setShowAddForm } = useStore()

  return (
    <header className="h-12 flex items-center gap-3 px-4 border-b border-white/[0.05] bg-canvas-base shrink-0">
      {/* ── Search ── */}
      <div className="relative flex-1 max-w-md">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-ink-quaternary" />
        <input
          type="text"
          placeholder="Search keys..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full h-8 pl-8 pr-3 rounded-md bg-white/[0.02] border border-white/[0.08]
                     text-sm text-ink-primary placeholder:text-ink-quaternary
                     focus:outline-none focus:ring-1 focus:ring-accent-bright
                     transition-colors duration-150"
        />
      </div>

      <div className="flex-1" />

      {/* ── Actions ── */}
      <button className="btn-ghost text-xs">
        <SlidersHorizontal className="size-3" />
        Filter
      </button>

      <button
        onClick={() => setShowAddForm(true)}
        className="btn-primary text-xs"
      >
        <Plus className="size-3.5" />
        Add Key
      </button>
    </header>
  )
}
