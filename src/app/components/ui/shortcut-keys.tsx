import { Kbd } from '@/components/ui/kbd';
import { formatShortcut, shortcutKeyLabels } from '@/app/lib/shortcuts';
import { cn } from '@/lib/utils';

/**
 * A stored shortcut, drawn as keycaps instead of a string. Each key is its own
 * cap, and a comma-separated alternative gets a separator between the groups,
 * so "⌘ ⇧ L / ⌘ L" reads the way it would on a keyboard.
 */
export function ShortcutKeys({
  keys,
  className,
}: {
  keys: string;
  className?: string;
}) {
  const groups = shortcutKeyLabels(keys);
  if (groups.length === 0) {
    return (
      <span className={cn('text-[11px] text-ink-quaternary', className)}>
        Disabled
      </span>
    );
  }

  return (
    <span
      role="img"
      aria-label={formatShortcut(keys)}
      className={cn('inline-flex flex-wrap items-center gap-1', className)}
    >
      {groups.map((parts, groupIndex) => (
        <span
          // Bindings only differ by position, so the index is the identity.
          key={groupIndex}
          className="inline-flex items-center gap-1"
          aria-hidden="true"
        >
          {groupIndex > 0 && (
            <span className="text-[10px] text-ink-quaternary/70">/</span>
          )}
          {parts.map((part, partIndex) => (
            <Kbd key={partIndex}>{part}</Kbd>
          ))}
        </span>
      ))}
    </span>
  );
}
