import { useState, useMemo } from "react"
import { NavLink } from "react-router-dom"
import { useStore } from "../../store/useStore"
import { ScrollArea } from "@/components/ui/scroll-area"
import { ManageGroupsDialog } from "../groups/ManageGroupsDialog"
import { VaultSwitcher } from "../vault/VaultSwitcher"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Key, Folder, FolderOpen, Settings, Filter, X, ChevronDown } from "lucide-react"

function SidebarSection({
  icon: Icon,
  label,
  action,
  defaultOpen = true,
  children,
}: {
  icon: React.ElementType
  label: string
  action?: React.ReactNode
  defaultOpen?: boolean
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className="px-2.5 py-1.5">
      <div
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-1.5 mb-1 group cursor-pointer"
      >
        <div className="flex items-center gap-1.5">
          <ChevronDown
            className={`size-2.5 text-ink-quaternary transition-transform duration-150 ${open ? "" : "-rotate-90"}`}
          />
          <Icon className="size-3 text-ink-quaternary" />
          <span className="text-2xs font-medium text-ink-quaternary uppercase tracking-wider">{label}</span>
        </div>
        <span className="opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
          {action}
        </span>
      </div>
      {open && children}
    </div>
  )
}

function FilterSelect({
  value,
  onChange,
  options,
}: {
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger
        className="h-7 text-2xs text-ink-tertiary hover:text-ink-secondary hover:bg-surface-3 hover:border-line border-line-subtle gap-1 px-2 [&>svg]:size-3"
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

export function Sidebar() {
  const {
    db, filterGroupId, filterProvider, filterStatus, filterTestStatus,
    setFilterGroupId, setFilterProvider, setFilterStatus, setFilterTestStatus,
    clearFilters, clearSmartFilters, setSearchQuery,
  } = useStore()
  const [showGroups, setShowGroups] = useState(false)

  const providers = useMemo(() =>
    db ? [...new Set(db.getApiKeys().map((k) => k.provider))].sort() : [],
    [db]
  )

  const keyCount = db?.getApiKeys().length ?? 0
  const groups = db?.getGroups() ?? []
  const hasActiveFilter = filterGroupId || filterProvider || filterStatus || filterTestStatus

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    `w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-[13px] transition-all duration-150
     ${isActive
       ? "bg-surface-5 text-ink-primary font-medium"
       : "text-ink-tertiary hover:text-ink-secondary hover:bg-surface-3"}`

  return (
    <>
      <aside className="w-56 shrink-0 flex flex-col bg-canvas-panel">
        {/* Vault Switcher */}
        <VaultSwitcher />

        <ScrollArea className="flex-1">
          {/* Nav */}
          <nav className="px-2 pt-1 pb-0.5">
            <NavLink to="/keys" className={navLinkClass} onClick={() => { clearFilters(); setSearchQuery('') }}>
              <Key className="size-3.5 shrink-0" />
              <span className="truncate">All Keys</span>
              {keyCount > 0 && (
                <span className="ml-auto min-w-[1.25rem] text-center text-2xs text-ink-quaternary tabular-nums">
                  {keyCount}
                </span>
              )}
            </NavLink>
          </nav>

          {/* Groups */}
          {db && (
            <SidebarSection
              icon={Folder}
              label="Groups"
              action={
                <button
                  onClick={() => setShowGroups(true)}
                  className="text-ink-quaternary hover:text-ink-secondary transition-colors p-0.5 rounded hover:bg-surface-3"
                >
                  <Settings className="size-3" />
                </button>
              }
            >
              <div className="space-y-px">
                {/* Ungrouped */}
                {(() => {
                  const count = db.getApiKeys().filter((k) => !k.group_id).length
                  const active = filterGroupId === "__ungrouped__"
                  return (
                    <button
                      onClick={() => setFilterGroupId(active ? null : "__ungrouped__")}
                      className={`w-full flex items-center gap-2 px-2.5 py-1 rounded-md text-xs transition-all duration-150
                        ${active
                          ? "bg-accent-default/10 text-accent-bright"
                          : "text-ink-tertiary hover:text-ink-secondary hover:bg-surface-3"}`}
                    >
                      <FolderOpen className="size-3.5 shrink-0" />
                      <span className="truncate flex-1 text-left">Ungrouped</span>
                      {count > 0 && (
                        <span className={`text-2xs tabular-nums ${active ? "text-accent-bright/60" : "text-ink-quaternary"}`}>
                          {count}
                        </span>
                      )}
                    </button>
                  )
                })()}
                {groups.map((group) => {
                  const count = db.getApiKeys().filter((k) => k.group_id === group.id).length
                  const active = filterGroupId === group.id
                  return (
                    <button
                      key={group.id}
                      onClick={() => setFilterGroupId(active ? null : group.id)}
                      className={`w-full flex items-center gap-2 px-2.5 py-1 rounded-md text-xs transition-all duration-150
                        ${active
                          ? "bg-accent-default/10 text-accent-bright"
                          : "text-ink-tertiary hover:text-ink-secondary hover:bg-surface-3"}`}
                    >
                      <span className="text-sm leading-none">{group.icon}</span>
                      <span className="truncate flex-1 text-left">{group.name}</span>
                      {count > 0 && (
                        <span className={`text-2xs tabular-nums ${active ? "text-accent-bright/60" : "text-ink-quaternary"}`}>
                          {count}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            </SidebarSection>
          )}

          {/* Smart Filters */}
          {db && keyCount > 0 && (
            <SidebarSection
              icon={Filter}
              label="Filters"
              action={
                (filterProvider || filterStatus || filterTestStatus) ? (
                  <button
                    onClick={(e) => { e.stopPropagation(); clearSmartFilters() }}
                    className="text-ink-quaternary hover:text-ink-secondary transition-colors p-0.5 rounded hover:bg-surface-3"
                  >
                    <X className="size-3" />
                  </button>
                ) : undefined
              }
            >
              <div className="space-y-1 px-0.5">
                <FilterSelect
                  value={filterProvider ?? "__all__"}
                  onChange={(v) => setFilterProvider(v === "__all__" ? null : v)}
                  options={[{ value: "__all__", label: "All Providers" }, ...providers.map((p) => ({ value: p, label: p }))]}
                />
                <FilterSelect
                  value={filterStatus ?? "__all__"}
                  onChange={(v) => setFilterStatus(v === "__all__" ? null : v)}
                  options={[
                    { value: "__all__", label: "All Status" },
                    { value: "active", label: "Active" },
                    { value: "inactive", label: "Inactive" },
                    { value: "expired", label: "Expired" },
                  ]}
                />
                <FilterSelect
                  value={filterTestStatus ?? "__all__"}
                  onChange={(v) => setFilterTestStatus(v === "__all__" ? null : v)}
                  options={[
                    { value: "__all__", label: "All Results" },
                    { value: "success", label: "Passed" },
                    { value: "failed", label: "Failed" },
                    { value: "untested", label: "Untested" },
                  ]}
                />
              </div>
            </SidebarSection>
          )}
        </ScrollArea>

        {/* Footer */}
        <div className="px-3 py-2">
          <a
            href="https://github.com/puinoib/keya"
            target="_blank"
            rel="noopener noreferrer"
            className="text-2xs text-ink-quaternary hover:text-ink-tertiary transition-colors flex items-center justify-center gap-1"
          >
            Keya v1.0
          </a>
        </div>
      </aside>

      <ManageGroupsDialog open={showGroups} onClose={() => setShowGroups(false)} />
    </>
  )
}
