import type * as React from 'react';
import { cn } from '@/lib/utils';

interface KbdProps extends React.ComponentProps<'kbd'> {
  /** Spoken form when the visible keys are symbols, e.g. "Cmd + Shift + L". */
  label?: string;
}

/**
 * A shortcut keycap. Uses the UI font rather than the mono stack: modifier
 * symbols are missing from most monospace faces, and the fallback glyph renders
 * at a different weight and baseline than the keys beside it.
 */
function Kbd({ className, label, children, ...props }: KbdProps) {
  return (
    <kbd
      aria-label={label}
      className={cn(
        'kbd-glyph inline-flex h-4 shrink-0 items-center justify-center rounded border border-line bg-canvas-base px-1.5 text-[10px] leading-none text-ink-quaternary',
        className
      )}
      {...props}
    >
      {children}
    </kbd>
  );
}

export { Kbd };
