import { useState, useEffect, useRef } from 'react';
import { useStore } from '../../store/useStore';
import { activeKeys, sortedGroups } from '../../state/view';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { EmojiPickerPanel } from '@/app/components/ui/emoji-picker-popover';
import {
  CaretDown,
  CaretUp,
  Check,
  PencilSimple,
  Plus,
  Trash,
  X,
} from '@phosphor-icons/react';

function EmojiPickerPopover({
  icon,
  onSelect,
}: {
  icon: string;
  onSelect: (emoji: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="size-7 rounded-md border border-line bg-surface-2 flex items-center justify-center text-sm hover:bg-surface-3 transition-colors"
      >
        {icon}
      </button>
      {open && (
        <div
          ref={ref}
          className="absolute left-0 top-full mt-1.5 z-50 rounded-lg bg-canvas-panel border border-line shadow-dialog"
        >
          <EmojiPickerPanel
            onSelect={(emoji) => {
              onSelect(emoji);
              setOpen(false);
            }}
          />
        </div>
      )}
    </div>
  );
}

export function GroupsPage() {
  const { view, addGroup, updateGroup, deleteGroup, reorderGroups } =
    useStore();
  const groups = view ? sortedGroups(view) : [];
  const keys = view ? activeKeys(view) : [];

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingIcon, setEditingIcon] = useState('');
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

  // One pass instead of filtering the whole key list once per group.
  const keyCounts = new Map<string, number>();
  for (const key of keys) {
    if (!key.group_id) continue;
    keyCounts.set(key.group_id, (keyCounts.get(key.group_id) ?? 0) + 1);
  }
  const getKeyCount = (groupId: string) => keyCounts.get(groupId) ?? 0;

  // Dense renumbering is the edit's rule: swap the two ids and let the payload
  // rewrite 0..n-1, instead of inventing a midpoint order.
  const moveGroup = (index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= groups.length) return;
    const next = [...groups];
    [next[index], next[target]] = [next[target], next[index]];
    reorderGroups(next.map((group) => group.id));
  };

  return (
    <>
      <p className="mb-3 text-xs leading-relaxed text-ink-quaternary">
        The order here is the order in the sidebar. Deleting a group keeps its
        keys: they move to Ungrouped.
      </p>

      <div className="rounded-lg border border-line bg-surface-2 divide-y divide-line">
        {groups.map((g, index) => (
          <div key={g.id} className="p-3">
            {editingId === g.id ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <EmojiPickerPopover
                    icon={editingIcon || g.icon}
                    onSelect={setEditingIcon}
                  />
                  <Input
                    defaultValue={g.name}
                    autoFocus
                    className="h-7 flex-1 text-xs"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        updateGroup(g.id, {
                          name: (e.target as HTMLInputElement).value,
                          ...(editingIcon && { icon: editingIcon }),
                        });
                        setEditingId(null);
                      }
                      if (e.key === 'Escape') setEditingId(null);
                    }}
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={(e) => {
                      const input = (e.currentTarget as HTMLElement)
                        .closest('.space-y-2')
                        ?.querySelector('input');
                      updateGroup(g.id, {
                        name: input?.value ?? g.name,
                        ...(editingIcon && { icon: editingIcon }),
                      });
                      setEditingId(null);
                    }}
                  >
                    <Check className="size-3.5" /> Save
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setEditingId(null)}
                  >
                    <X className="size-3.5" /> Cancel
                  </Button>
                </div>
              </div>
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
                  onClick={() => moveGroup(index, -1)}
                  disabled={index === 0}
                  aria-label={`Move ${g.name} up`}
                  className="text-ink-quaternary transition-colors hover:text-ink-primary disabled:opacity-30 disabled:hover:text-ink-quaternary"
                >
                  <CaretUp className="size-3.5" />
                </button>
                <button
                  onClick={() => moveGroup(index, 1)}
                  disabled={index === groups.length - 1}
                  aria-label={`Move ${g.name} down`}
                  className="text-ink-quaternary transition-colors hover:text-ink-primary disabled:opacity-30 disabled:hover:text-ink-quaternary"
                >
                  <CaretDown className="size-3.5" />
                </button>
                <button
                  onClick={() => {
                    setEditingIcon('');
                    setEditingId(g.id);
                  }}
                  aria-label={`Rename ${g.name}`}
                  className="text-ink-quaternary transition-colors hover:text-ink-primary"
                >
                  <PencilSimple className="size-3.5" />
                </button>
                <button
                  onClick={() => {
                    const count = getKeyCount(g.id);
                    const confirmed = window.confirm(
                      count > 0
                        ? `Delete "${g.name}"? ${count} key(s) will become ungrouped.`
                        : `Delete "${g.name}"?`
                    );
                    if (confirmed) deleteGroup(g.id);
                  }}
                  aria-label={`Delete ${g.name}`}
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
            <div className="flex items-center gap-2">
              <EmojiPickerPopover icon={newIcon} onSelect={setNewIcon} />
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Group name"
                className="h-7 flex-1 text-xs"
                autoFocus
                onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
              />
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
