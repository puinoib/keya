import { useStore } from "../../store/useStore"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Key, Tag, Folder, Hash } from "lucide-react"

export function Sidebar() {
  const { db } = useStore()

  const navItems = [
    { icon: Key, label: "All Keys", active: true },
    { icon: Folder, label: "Categories", active: false },
    { icon: Tag, label: "Tags", active: false },
    { icon: Hash, label: "Providers", active: false },
  ]

  return (
    <aside className="w-56 shrink-0 flex flex-col bg-canvas-panel">
      {/* ── Brand ── */}
      <div className="h-12 flex items-center gap-2.5 px-4 border-b border-white/[0.05]">
        <div className="flex items-center justify-center size-6 rounded-md bg-accent text-white">
          <Key className="size-3.5" />
        </div>
        <span className="text-sm font-semibold tracking-tight text-ink-primary">Keya</span>
      </div>

      {/* ── Nav ── */}
      <ScrollArea className="flex-1">
        <nav className="p-2 space-y-0.5">
          {navItems.map((item) => {
            const Icon = item.icon
            return (
              <button
                key={item.label}
                className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-sm transition-colors duration-100
                  ${item.active
                    ? "bg-white/[0.06] text-ink-primary font-medium"
                    : "text-ink-tertiary hover:text-ink-secondary hover:bg-white/[0.03]"
                  }`}
              >
                <Icon className="size-3.5 shrink-0" />
                <span className="truncate">{item.label}</span>
                {item.active && (
                  <span className="ml-auto text-2xs text-ink-quaternary">
                    {db?.getApiKeys().length ?? 0}
                  </span>
                )}
              </button>
            )
          })}
        </nav>

        {/* ── Categories ── */}
        {db && (
          <div className="px-3 py-2">
            <p className="text-2xs font-medium text-ink-quaternary uppercase tracking-wider mb-1.5 px-1">
              Categories
            </p>
            {db.getCategories().map((cat) => (
              <button
                key={cat.id}
                className="w-full flex items-center gap-2 px-2.5 py-1 rounded-md text-xs text-ink-tertiary hover:text-ink-secondary hover:bg-white/[0.03] transition-colors"
              >
                <span className="text-sm leading-none">{cat.icon}</span>
                <span className="truncate">{cat.name}</span>
              </button>
            ))}
          </div>
        )}
      </ScrollArea>

      {/* ── Footer ── */}
      <div className="p-3 border-t border-white/[0.05]">
        <p className="text-2xs text-ink-quaternary text-center">
          made with love, powered by Suisui's Purrs
        </p>
      </div>
    </aside>
  )
}
