import { useState } from "react"
import { useStore } from "../../store/useStore"
import { ScrollArea } from "@/components/ui/scroll-area"
import { ManageGroupsDialog } from "../groups/ManageGroupsDialog"
import { Key, Folder, Settings, Filter, X } from "lucide-react"

export function Sidebar() {
  const {
    db, filterGroupId, filterProvider, filterStatus, filterTestStatus,
    setFilterGroupId, setFilterProvider, setFilterStatus, setFilterTestStatus, clearFilters,
  } = useStore()
  const [showGroups, setShowGroups] = useState(false)

  const navItems = [
    { icon: Key, label: "All Keys", active: true, count: db?.getApiKeys().length ?? 0 },
  ]

  // Derive unique providers from keys
  const providers = db
    ? [...new Set(db.getApiKeys().map((k) => k.provider))].sort()
    : []

  const hasActiveFilter = filterGroupId || filterProvider || filterStatus || filterTestStatus

  return (
    <>
      <aside className="w-56 shrink-0 flex flex-col bg-canvas-panel">
        {/* Brand */}
        <div className="h-12 flex items-center gap-2.5 px-4 border-b border-line-subtle">
          <div className="flex items-center justify-center size-6 rounded-md bg-accent text-white">
            <Key className="size-3.5" />
          </div>
          <span className="text-sm font-semibold tracking-tight text-ink-primary">Keya</span>
        </div>

        <ScrollArea className="flex-1">
          {/* Nav */}
          <nav className="p-2 space-y-0.5">
            {navItems.map((item) => {
              const Icon = item.icon
              return (
                <button key={item.label}
                        className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-sm transition-colors duration-100
                          ${item.active ? "bg-surface-6 text-ink-primary font-medium" : "text-ink-tertiary hover:text-ink-secondary hover:bg-surface-3"}`}>
                  <Icon className="size-3.5 shrink-0" />
                  <span className="truncate">{item.label}</span>
                  <span className="ml-auto text-2xs text-ink-quaternary">{item.count}</span>
                </button>
              )
            })}
          </nav>

          {/* Groups */}
          {db && (
            <div className="px-3 py-2">
              <div className="flex items-center justify-between px-1 mb-1.5">
                <div className="flex items-center gap-1.5">
                  <Folder className="size-3 text-ink-quaternary" />
                  <span className="text-2xs font-medium text-ink-quaternary uppercase tracking-wider">Groups</span>
                </div>
                <button onClick={() => setShowGroups(true)}
                        className="text-2xs text-ink-quaternary hover:text-ink-secondary transition-colors">
                  <Settings className="size-3" />
                </button>
              </div>
              {db.getGroups().map((group) => (
                <button key={group.id}
                        onClick={() => setFilterGroupId(filterGroupId === group.id ? null : group.id)}
                        className={`w-full flex items-center gap-2 px-2.5 py-1 rounded-md text-xs transition-colors
                          ${filterGroupId === group.id ? "bg-surface-6 text-ink-primary" : "text-ink-tertiary hover:text-ink-secondary hover:bg-surface-3"}`}>
                  <span className="text-sm leading-none">{group.icon}</span>
                  <span className="truncate">{group.name}</span>
                </button>
              ))}
            </div>
          )}

          {/* Smart Filters */}
          {db && db.getApiKeys().length > 0 && (
            <div className="px-3 py-2">
              <div className="flex items-center justify-between px-1 mb-1.5">
                <div className="flex items-center gap-1.5">
                  <Filter className="size-3 text-ink-quaternary" />
                  <span className="text-2xs font-medium text-ink-quaternary uppercase tracking-wider">Filters</span>
                </div>
                {hasActiveFilter && (
                  <button onClick={clearFilters}
                          className="text-2xs text-ink-quaternary hover:text-ink-secondary transition-colors">
                    <X className="size-3" />
                  </button>
                )}
              </div>
              <div className="space-y-1">
                {/* Provider */}
                <select value={filterProvider ?? ""}
                        onChange={(e) => setFilterProvider(e.target.value || null)}
                        className="w-full h-7 px-2 rounded-md bg-surface-2 border border-line text-2xs text-ink-tertiary hover:text-ink-secondary focus:outline-none focus:ring-1 focus:ring-accent-bright appearance-none">
                  <option value="">All Providers</option>
                  {providers.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>

                {/* Status */}
                <select value={filterStatus ?? ""}
                        onChange={(e) => setFilterStatus(e.target.value || null)}
                        className="w-full h-7 px-2 rounded-md bg-surface-2 border border-line text-2xs text-ink-tertiary hover:text-ink-secondary focus:outline-none focus:ring-1 focus:ring-accent-bright appearance-none">
                  <option value="">All Status</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="expired">Expired</option>
                </select>

                {/* Test Result */}
                <select value={filterTestStatus ?? ""}
                        onChange={(e) => setFilterTestStatus(e.target.value || null)}
                        className="w-full h-7 px-2 rounded-md bg-surface-2 border border-line text-2xs text-ink-tertiary hover:text-ink-secondary focus:outline-none focus:ring-1 focus:ring-accent-bright appearance-none">
                  <option value="">All Results</option>
                  <option value="success">Passed</option>
                  <option value="failed">Failed</option>
                  <option value="untested">Untested</option>
                </select>
              </div>
            </div>
          )}
        </ScrollArea>

        {/* Footer */}
        <div className="p-3 border-t border-line-subtle">
          <p className="text-2xs text-ink-quaternary text-center">
            made with love, powered by Suisui's Purrs
          </p>
        </div>
      </aside>

      <ManageGroupsDialog open={showGroups} onClose={() => setShowGroups(false)} />
    </>
  )
}
