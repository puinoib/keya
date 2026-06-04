import { useState } from 'react';
import { useStore } from '../../store/useStore';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Trash, PencilSimple, Check, X } from '@phosphor-icons/react';

const ICONS = ['🚀', '👤', '🏢', '☁️', '📦', '🔧', '💾', '🌐'];

export function ManageGroupsDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { db, addGroup, updateGroup, deleteGroup } = useStore();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [newIcon, setNewIcon] = useState('📦');
  const [isAdding, setIsAdding] = useState(false);

  if (!db) return null;
  const groups = db.getGroups();

  const handleAdd = () => {
    if (!newName.trim()) return;
    addGroup({ name: newName.trim(), icon: newIcon, order: groups.length + 1 });
    setNewName('');
    setIsAdding(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <DialogContent className="flex max-h-[90vh] w-[calc(100vw-2rem)] max-w-sm flex-col overflow-hidden p-0">
        <DialogHeader className="border-b border-line px-6 py-5">
          <DialogTitle>Manage Groups</DialogTitle>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
            <div className="space-y-2">
              {groups.map((g) => (
                <div
                  key={g.id}
                  className="flex items-center gap-2.5 rounded-md border border-line-2 bg-surface-2 px-3 py-2"
                >
                  {editingId === g.id ? (
                    <Input
                      defaultValue={g.name}
                      autoFocus
                      className="h-7 flex-1 text-xs"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          updateGroup(g.id, {
                            name: (e.target as HTMLInputElement).value,
                          });
                          setEditingId(null);
                        }
                        if (e.key === 'Escape') setEditingId(null);
                      }}
                      onBlur={(e) => {
                        updateGroup(g.id, { name: e.target.value });
                        setEditingId(null);
                      }}
                    />
                  ) : (
                    <>
                      <span className="text-base">{g.icon}</span>
                      <span className="flex-1 text-sm text-ink-secondary">
                        {g.name}
                      </span>
                      <button
                        onClick={() => setEditingId(g.id)}
                        className="text-ink-quaternary transition-colors hover:text-ink-primary"
                      >
                        <PencilSimple className="size-3" />
                      </button>
                      <button
                        onClick={() => deleteGroup(g.id)}
                        className="text-ink-quaternary transition-colors hover:text-danger"
                      >
                        <Trash className="size-3" />
                      </button>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="shrink-0 border-t border-line px-6 py-4">
            {isAdding ? (
              <div className="space-y-2 rounded-md border border-accent/30 bg-surface-2 p-3">
                <Input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Group name"
                  className="h-8 text-sm"
                  autoFocus
                  onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                />
                <div className="flex items-center gap-2">
                  <Label className="text-xs text-ink-quaternary">Icon</Label>
                  <div className="flex gap-1">
                    {ICONS.map((icon) => (
                      <button
                        key={icon}
                        onClick={() => setNewIcon(icon)}
                        className={`size-6 flex items-center justify-center rounded text-sm ${newIcon === icon ? 'bg-accent/20 ring-1 ring-accent-bright' : 'hover:bg-surface-5'}`}
                      >
                        {icon}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex gap-2 pt-1">
                  <Button size="sm" onClick={handleAdd}>
                    <Check className="size-3.5" /> Add
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setIsAdding(false)}
                  >
                    <X className="size-3.5" /> Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setIsAdding(true)}
                className="w-full flex items-center justify-center gap-1.5 rounded-md py-2 text-xs text-ink-tertiary transition-colors hover:bg-surface-3 hover:text-ink-primary"
              >
                <Plus className="size-3.5" /> Add Group
              </button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
