import { useState } from "react"
import { useStore } from "../../store/useStore"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Plus, Trash2, Pencil, Check, X } from "lucide-react"

const COLORS = ["#3B82F6", "#10B981", "#8B5CF6", "#F59E0B", "#EF4444", "#EC4899", "#06B6D4", "#84CC16"]
const ICONS = ["🤖", "☁️", "📦", "🔧", "💾", "🌐", "📊", "🎯"]

export function ManageCategoriesDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { db, addCategory, updateCategory, deleteCategory } = useStore()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [newName, setNewName] = useState("")
  const [newIcon, setNewIcon] = useState("📦")
  const [newColor, setNewColor] = useState("#8B5CF6")
  const [isAdding, setIsAdding] = useState(false)

  if (!db) return null
  const categories = db.getCategories()

  const handleAdd = () => {
    if (!newName.trim()) return
    addCategory({ name: newName.trim(), icon: newIcon, color: newColor, order: categories.length + 1 })
    setNewName("")
    setIsAdding(false)
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Manage Categories</DialogTitle>
        </DialogHeader>

        <div className="space-y-2 mt-2">
          {categories.map((cat) => (
            <div key={cat.id} className="flex items-center gap-2.5 px-3 py-2 rounded-md bg-white/[0.02] border border-white/[0.06]">
              {editingId === cat.id ? (
                <>
                  <Input
                    defaultValue={cat.name}
                    autoFocus
                    className="h-7 text-xs flex-1"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        updateCategory(cat.id, { name: (e.target as HTMLInputElement).value })
                        setEditingId(null)
                      }
                      if (e.key === "Escape") setEditingId(null)
                    }}
                    onBlur={(e) => {
                      updateCategory(cat.id, { name: e.target.value })
                      setEditingId(null)
                    }}
                  />
                </>
              ) : (
                <>
                  <span className="text-base">{cat.icon}</span>
                  <span className="flex-1 text-sm text-ink-secondary">{cat.name}</span>
                  <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                  <button onClick={() => setEditingId(cat.id)}
                          className="text-ink-quaternary hover:text-ink-primary transition-colors">
                    <Pencil className="size-3" />
                  </button>
                  <button onClick={() => deleteCategory(cat.id)}
                          className="text-ink-quaternary hover:text-danger transition-colors">
                    <Trash2 className="size-3" />
                  </button>
                </>
              )}
            </div>
          ))}

          {/* Add new */}
          {isAdding ? (
            <div className="space-y-2 p-3 rounded-md bg-white/[0.02] border border-accent/30">
              <Input value={newName} onChange={(e) => setNewName(e.target.value)}
                     placeholder="Category name" className="h-8 text-sm" autoFocus
                     onKeyDown={(e) => e.key === "Enter" && handleAdd()} />
              <div className="flex items-center gap-2">
                <Label className="text-2xs text-ink-quaternary">Icon</Label>
                <div className="flex gap-1">
                  {ICONS.map((icon) => (
                    <button key={icon} onClick={() => setNewIcon(icon)}
                            className={`size-6 flex items-center justify-center rounded text-sm ${newIcon === icon ? "bg-accent/20 ring-1 ring-accent-bright" : "hover:bg-white/[0.05]"}`}>
                      {icon}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Label className="text-2xs text-ink-quaternary">Color</Label>
                <div className="flex gap-1">
                  {COLORS.map((c) => (
                    <button key={c} onClick={() => setNewColor(c)}
                            className={`size-4 rounded-full ${newColor === c ? "ring-1 ring-accent-bright ring-offset-2 ring-offset-canvas-raised" : ""}`}
                            style={{ backgroundColor: c }} />
                  ))}
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <Button size="sm" onClick={handleAdd}><Check className="size-3.5" /> Add</Button>
                <Button size="sm" variant="ghost" onClick={() => setIsAdding(false)}><X className="size-3.5" /> Cancel</Button>
              </div>
            </div>
          ) : (
            <button onClick={() => setIsAdding(true)}
                    className="w-full flex items-center justify-center gap-1.5 py-2 rounded-md text-xs text-ink-tertiary hover:text-ink-primary hover:bg-white/[0.03] transition-colors">
              <Plus className="size-3.5" /> Add Category
            </button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
