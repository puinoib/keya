import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, CaretDown, Key } from '@phosphor-icons/react';
import type { Group } from '../../../core/types';
import { cn } from '@/lib/utils';

interface GroupSelectProps {
  groups: Group[];
  value: string | null;
  onChange: (value: string | null) => void;
}

export function GroupSelect({ groups, value, onChange }: GroupSelectProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (
        rootRef.current &&
        !rootRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [open]);

  const currentGroup = useMemo(
    () => groups.find((group) => group.id === value) ?? null,
    [groups, value]
  );

  const handleSelect = (groupId: string | null) => {
    onChange(groupId);
    setOpen(false);
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={cn(
          'flex h-9 w-full items-center justify-between rounded-md border border-line bg-surface-2 px-3 py-2 text-sm transition-colors duration-150',
          'text-ink-primary hover:bg-surface-3',
          'focus:outline-none focus:ring-1 focus:ring-accent-bright'
        )}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="flex min-w-0 items-center gap-2 truncate">
          {currentGroup ? (
            <>
              <span className="text-sm leading-none">{currentGroup.icon}</span>
              <span className="truncate">{currentGroup.name}</span>
            </>
          ) : (
            <>
              <Key className="size-4 shrink-0 text-ink-quaternary" />
              <span className="text-ink-secondary">Ungrouped</span>
            </>
          )}
        </span>
        <CaretDown className="size-4 shrink-0 text-ink-quaternary" />
      </button>

      {open && (
        <div
          className={cn(
            'absolute left-0 top-full z-50 mt-1 w-full overflow-hidden rounded-md border border-line bg-canvas-raised shadow-dialog'
          )}
          role="listbox"
        >
          <button
            type="button"
            onClick={() => handleSelect(null)}
            className={cn(
              'flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-ink-secondary transition-colors',
              'hover:bg-surface-5 hover:text-ink-primary'
            )}
          >
            <span className="flex size-4 items-center justify-center">
              {value === null ? <Check className="size-3.5" /> : null}
            </span>
            <Key className="size-4 shrink-0 text-ink-quaternary" />
            <span>Ungrouped</span>
          </button>

          {groups.length > 0 ? (
            <div className="max-h-56 overflow-y-auto border-t border-line">
              {groups.map((group) => (
                <button
                  key={group.id}
                  type="button"
                  onClick={() => handleSelect(group.id)}
                  className={cn(
                    'flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-ink-secondary transition-colors',
                    'hover:bg-surface-5 hover:text-ink-primary'
                  )}
                >
                  <span className="flex size-4 items-center justify-center">
                    {value === group.id ? <Check className="size-3.5" /> : null}
                  </span>
                  <span className="text-sm leading-none">{group.icon}</span>
                  <span className="truncate">{group.name}</span>
                </button>
              ))}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
