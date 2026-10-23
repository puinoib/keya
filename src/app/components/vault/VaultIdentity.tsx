import { Lock } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';

interface VaultIdentityProps {
  name: string;
  icon?: string;
  fileName?: string;
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
  className,
}: VaultIdentityProps) {
  const mark = icon?.trim();
  // An unnamed vault's file name is its name plus the extension; showing both
  // lines would repeat the same random string twice.
  const showFile = !!fileName && fileName !== `${name}.keya`;

  return (
    <div className={cn('flex min-w-0 items-center gap-3', className)}>
      <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent/15 text-base leading-none text-accent-bright">
        {mark ? mark : <Lock className="size-4" />}
      </div>
      <div className="min-w-0 flex-1">
        <p
          className="truncate text-[15px] font-semibold leading-snug tracking-tight text-ink-primary"
          title={name}
        >
          {name}
        </p>
        {showFile && (
          <p
            className="truncate font-mono text-[11px] leading-snug text-ink-quaternary"
            title={fileName}
          >
            {fileName}
          </p>
        )}
      </div>
    </div>
  );
}
