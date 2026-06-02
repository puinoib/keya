import { useState } from "react"
import { useStore } from "../../store/useStore"
import { ScrollArea } from "@/components/ui/scroll-area"
import { ManageCategoriesDialog } from "../categories/ManageCategoriesDialog"
import { ManageTagsDialog } from "../tags/ManageTagsDialog"
import { Key, Tag, Folder, Hash, Settings } from "lucide-react"

export function Sidebar() {
  const { db, selectedTagIds, toggleTagFilter } = useStore()
  const [showCategories, setShowCategories] = useState(false)
  const [showTags, setShowTags] = useState(false)

  const navItems = [
    { icon: Key, label: "All Keys", active: true, count: db?.getApiKeys().length ?? 0 },
  ]

  return (
    <>
      <aside className="w-56 shrink-0 flex flex-col bg-canvas-panel">
        {/* Brand */}
        <div className="h-12 flex items-center gap-2.5 px-4 border-b border-white/[0.05]">
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
                          ${item.active ? "bg-white/[0.06] text-ink-primary font-medium" : "text-ink-tertiary hover:text-ink-secondary hover:bg-white/[0.03]"}`}>
                  <Icon className="size-3.5 shrink-0" />
                  <span className="truncate">{item.label}</span>
                  <span className="ml-auto text-2xs text-ink-quaternary">{item.count}</span>
                </button>
              )
            })}
          </nav>

          {/* Categories */}
          {db && (
            <div className="px-3 py-2">
              <div className="flex items-center justify-between px-1 mb-1.5">
                <div className="flex items-center gap-1.5">
                  <Folder className="size-3 text-ink-quaternary" />
                  <span className="text-2xs font-medium text-ink-quaternary uppercase tracking-wider">Categories</span>
                </div>
                <button onClick={() => setShowCategories(true)}
                        className="text-2xs text-ink-quaternary hover:text-ink-secondary transition-colors">
                  <Settings className="size-3" />
                </button>
              </div>
              {db.getCategories().map((cat) => (
                <button key={cat.id}
                        className="w-full flex items-center gap-2 px-2.5 py-1 rounded-md text-xs text-ink-tertiary hover:text-ink-secondary hover:bg-white/[0.03] transition-colors">
                  <span className="text-sm leading-none">{cat.icon}</span>
                  <span className="truncate">{cat.name}</span>
                </button>
              ))}
            </div>
          )}

          {/* Tags */}
          {db && (
            <div className="px-3 py-2">
              <div className="flex items-center justify-between px-1 mb-1.5">
                <div className="flex items-center gap-1.5">
                  <Tag className="size-3 text-ink-quaternary" />
                  <span className="text-2xs font-medium text-ink-quaternary uppercase tracking-wider">Tags</span>
                </div>
                <button onClick={() => setShowTags(true)}
                        className="text-2xs text-ink-quaternary hover:text-ink-secondary transition-colors">
                  <Settings className="size-3" />
                </button>
              </div>
              {db.getTags().map((tag) => (
                <button key={tag.id}
                        onClick={() => toggleTagFilter(tag.id)}
                        className={`w-full flex items-center gap-2 px-2.5 py-1 rounded-md text-xs transition-colors
                          ${selectedTagIds.includes(tag.id) ? "bg-white/[0.06] text-ink-primary" : "text-ink-tertiary hover:text-ink-secondary hover:bg-white/[0.03]"}`}>
                  <div className="size-2 rounded-full shrink-0" style={{ backgroundColor: tag.color }} />
                  <span className="truncate">{tag.name}</span>
                  {selectedTagIds.includes(tag.id) && (
                    <span className="ml-auto text-2xs text-ink-quaternary">✓</span>
                  )}
                </button>
              ))}
              {db.getTags().length === 0 && (
                <p className="text-2xs text-ink-quaternary px-2.5 py-1">No tags yet</p>
              )}
            </div>
          )}
        </ScrollArea>

        {/* Footer */}
        <div className="p-3 border-t border-white/[0.05]">
          <p className="text-2xs text-ink-quaternary text-center">
            made with love, powered by Suisui's Purrs
          </p>
        </div>
      </aside>

      <ManageCategoriesDialog open={showCategories} onClose={() => setShowCategories(false)} />
      <ManageTagsDialog open={showTags} onClose={() => setShowTags(false)} />
    </>
  )
}
