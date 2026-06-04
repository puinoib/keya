import { useMemo } from 'react';
import { Key } from '@phosphor-icons/react';
import type { Group } from '../../../core/types';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface GroupSelectProps {
  groups: Group[];
  value: string | null;
  onChange: (value: string | null) => void;
}

const UNGROUPED_VALUE = '__ungrouped__';

export function GroupSelect({ groups, value, onChange }: GroupSelectProps) {
  const currentGroup = useMemo(
    () => groups.find((group) => group.id === value) ?? null,
    [groups, value]
  );

  return (
    <Select
      value={value ?? UNGROUPED_VALUE}
      onValueChange={(groupId) =>
        onChange(groupId === UNGROUPED_VALUE ? null : groupId)
      }
    >
      <SelectTrigger>
        <SelectValue>
          {currentGroup ? (
            <span className="flex min-w-0 items-center gap-2 truncate">
              <span className="text-sm leading-none">{currentGroup.icon}</span>
              <span className="truncate">{currentGroup.name}</span>
            </span>
          ) : (
            <span className="flex min-w-0 items-center gap-2 truncate">
              <Key className="size-4 shrink-0 text-ink-quaternary" />
              <span className="truncate text-ink-secondary">Ungrouped</span>
            </span>
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent className="max-h-64 overflow-y-auto">
        <SelectItem value={UNGROUPED_VALUE}>
          <span className="flex min-w-0 items-center gap-2">
            <Key className="size-4 shrink-0 text-ink-quaternary" />
            <span>Ungrouped</span>
          </span>
        </SelectItem>
        {groups.map((group) => (
          <SelectItem key={group.id} value={group.id}>
            <span className="flex min-w-0 items-center gap-2">
              <span className="text-sm leading-none">{group.icon}</span>
              <span className="truncate">{group.name}</span>
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
