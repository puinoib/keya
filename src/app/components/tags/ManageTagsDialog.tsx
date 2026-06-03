import { useState } from "react"
import { useStore } from "../../store/useStore"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Plus, Trash2, Check, X } from "lucide-react"

const COLORS = ["#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#EC4899", "#8B5CF6", "#06B6D4", "#84CC16"]

export function ManageTagsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { db, addTag, deleteTag } = useStore()
  const [newName, setNewName] = useState("")
  const [newColor, setNewColor] = useState("#3B82F6")
  const [isAdding, setIsAdding] = useState(false)

  if (!db) return null
  const tags = db.getTags()

  const handleAdd = () => {
    if (!newName.trim()) return
    addTag({ name: newName.trim(), color: newColor })
    setNewName("")
    setIsAdding(false)
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Manage Tags</DialogTitle>
        </DialogHeader>

        <div className="space-y-2 mt-2">
          {tags.map((tag) => (
            <div key={tag.id} className="flex items-center gap-2.5 px-3 py-2 rounded-md bg-surface-2 border border-line-2">
              <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: tag.color }} />
              <span className="flex-1 text-sm text-ink-secondary">{tag.name}</span>
              <button onClick={() => deleteTag(tag.id)}
                      className="text-ink-quaternary hover:text-danger transition-colors">
                <Trash2 className="size-3" />
              </button>
            </div>
          ))}

          {tags.length === 0 && (
            <p className="text-xs text-ink-quaternary text-center py-4">No tags yet</p>
          )}

          {isAdding ? (
            <div className="space-y-2 p-3 rounded-md bg-surface-2 border border-accent/30">
              <Input value={newName} onChange={(e) => setNewName(e.target.value)}
                     placeholder="Tag name" className="h-8 text-sm" autoFocus
                     onKeyDown={(e) => e.key === "Enter" && handleAdd()} />
              <div className="flex items-center gap-2">
                {COLORS.map((c) => (
                  <button key={c} onClick={() => setNewColor(c)}
                          className={`size-4 rounded-full ${newColor === c ? "ring-1 ring-accent-bright ring-offset-2 ring-offset-canvas-raised" : ""}`}
                          style={{ backgroundColor: c }} />
                ))}
              </div>
              <div className="flex gap-2 pt-1">
                <Button size="sm" onClick={handleAdd}><Check className="size-3.5" /> Add</Button>
                <Button size="sm" variant="ghost" onClick={() => setIsAdding(false)}><X className="size-3.5" /> Cancel</Button>
              </div>
            </div>
          ) : (
            <button onClick={() => setIsAdding(true)}
                    className="w-full flex items-center justify-center gap-1.5 py-2 rounded-md text-xs text-ink-tertiary hover:text-ink-primary hover:bg-surface-3 transition-colors">
              <Plus className="size-3.5" /> Add Tag
            </button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
