import { useState } from 'react';
import { useStore } from '../../store/useStore';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import {
  Plus,
  Trash,
  PencilSimple,
  Check,
  X,
} from '@phosphor-icons/react';

const ICONS = ['🚀', '👤', '🏢', '☁️', '📦', '🔧', '💾', '🌐'];

export function GroupsPage() {
  const { db, addGroup, updateGroup, deleteGroup } = useStore();
  const groups = db?.getGroups() ?? [];
  const keys = db?.getApiKeys() ?? [];

  const [editingId, setEditingId] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newIcon, setNewIcon] = useState('📦');

  const handleAdd = () => {
    if (!newName.trim()) return;
    addGroup({ name: newName.trim(), icon: newIcon, order: groups.length + 1 });
    setNewName('');
    setNewIcon('📦');
    setIsAdding(false);
  };

  const cancelAdd = () => {
    setNewName('');
    setNewIcon('📦');
    setIsAdding(false);
  };

  const getKeyCount = (groupId: string) =>
    keys.filter((k) => k.group_id === groupId).length;

  return (
    <>
      <h1 className="text-base font-semibold tracking-tight text-ink-primary mb-6">
        Groups
      </h1>

      <div className="rounded-lg border border-line bg-surface-2 divide-y divide-line">
        {groups.map((g) => (
          <div key={g.id} className="p-3">
            {editingId === g.id ? (
              <Input
                defaultValue={g.name}
                autoFocus
                className="h-7 text-xs"
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
              <div className="flex items-center gap-2.5">
                <span className="text-base leading-none">{g.icon}</span>
                <span className="flex-1 text-xs text-ink-primary">
                  {g.name}
                </span>
                <span className="text-[11px] text-ink-quaternary">
                  {getKeyCount(g.id)} keys
                </span>
                <button
                  onClick={() => setEditingId(g.id)}
                  className="text-ink-quaternary transition-colors hover:text-ink-primary"
                >
                  <PencilSimple className="size-3.5" />
                </button>
                <button
                  onClick={() => deleteGroup(g.id)}
                  className="text-ink-quaternary transition-colors hover:text-danger"
                >
                  <Trash className="size-3.5" />
                </button>
              </div>
            )}
          </div>
        ))}

        {groups.length === 0 && !isAdding && (
          <div className="p-3 text-center">
            <p className="text-xs text-ink-quaternary">No groups yet</p>
          </div>
        )}

        {isAdding ? (
          <div className="p-3 space-y-2">
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Group name"
              className="h-7 text-xs"
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
              <Button size="sm" variant="ghost" onClick={cancelAdd}>
                <X className="size-3.5" /> Cancel
              </Button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setIsAdding(true)}
            className="flex w-full items-center justify-center gap-1.5 p-3 text-xs text-ink-tertiary transition-colors hover:bg-surface-3 hover:text-ink-primary"
          >
            <Plus className="size-3.5" /> Add Group
          </button>
        )}
      </div>
    </>
  );
}
