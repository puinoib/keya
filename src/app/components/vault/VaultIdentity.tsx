import type { ReactNode } from 'react';
import { Lock } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';

interface VaultIdentityProps {
  name: string;
  icon?: string;
  fileName?: string;
  /** Trailing marker next to the name, e.g. an "Unlocked" badge. */
  badge?: ReactNode;
  /** Third line for context that is not the file itself, e.g. the folder. */
  footnote?: ReactNode;
  size?: 'sm' | 'md';
  className?: string;
}

/**
 * The one place a vault identifies itself: icon, display name and (when it adds
 * information) the file on disk. Both the switcher dialogs and the welcome
 * screen compose this instead of repeating the name in a title and a card.
 */
export function VaultIdentity({
  name,
  icon,
  fileName,
  badge,
  footnote,
  size = 'md',
  className,
}: VaultIdentityProps) {
  const mark = icon?.trim();
  // An unnamed vault's file name is its name plus the extension; showing both
  // lines would repeat the same random string twice.
  const showFile = !!fileName && fileName !== `${name}.keya`;
  const compact = size === 'sm';

  return (
    <div className={cn('flex min-w-0 items-center gap-3', className)}>
      <div
        className={cn(
          'flex shrink-0 items-center justify-center rounded-lg bg-accent/15 leading-none text-accent-bright',
          compact ? 'size-7 text-sm' : 'size-8 text-base'
        )}
      >
        {mark ? mark : <Lock className={compact ? 'size-3.5' : 'size-4'} />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-1.5">
          <p
            className={cn(
              'truncate font-semibold leading-snug tracking-tight text-ink-primary',
              compact ? 'text-[13px]' : 'text-[15px]'
            )}
            title={name}
          >
            {name}
          </p>
          {badge}
        </div>
        {showFile && (
          <p
            className="truncate font-mono text-[11px] leading-snug text-ink-quaternary"
            title={fileName}
          >
            {fileName}
          </p>
        )}
        {footnote && (
          <p className="truncate text-[11px] leading-snug text-ink-quaternary">
            {footnote}
          </p>
        )}
      </div>
    </div>
  );
}
