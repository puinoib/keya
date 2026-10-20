import { cn } from '@/lib/utils';

interface KeyaLogoProps {
  className?: string;
}

/**
 * Brand mark that swaps to a brighter gradient in the app's dark theme.
 * Dark is the default; the light theme opts in with the `.light` root class.
 */
export function KeyaLogo({ className }: KeyaLogoProps) {
  return (
    <span
      role="img"
      aria-label="Keya"
      className={cn('keya-logo inline-flex shrink-0', className)}
    >
      <img src="/icon.svg" alt="" className="keya-logo-light" />
      <img src="/icon-dark.svg" alt="" className="keya-logo-dark" />
    </span>
  );
}
