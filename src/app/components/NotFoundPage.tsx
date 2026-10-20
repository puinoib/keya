import { useEffect } from 'react';
import { Link } from '@tanstack/react-router';
import { cn } from '@/lib/utils';
import { buttonVariants } from '@/components/ui/button';
import { KeyaLogo } from '@/components/ui/keya-logo';

/**
 * Global 404 surface for any path the router does not recognize.
 * Kept deliberately quiet: one accent glow, one label, two ways out.
 */
export function NotFoundPage() {
  // Routes do not own document titles; set one here and restore the shell title on exit.
  useEffect(() => {
    const previous = document.title;
    document.title = 'Page not found · Keya';
    return () => {
      document.title = previous;
    };
  }, []);

  return (
    <div className="relative grid min-h-dvh place-items-center overflow-hidden bg-canvas-base px-6 text-center">
      <div className="pointer-events-none absolute inset-0 [background-image:radial-gradient(circle_at_50%_0%,rgba(94,106,210,0.10),transparent_58%)]" />

      <div className="relative flex flex-col items-center">
        <KeyaLogo className="size-12" />

        <p className="mt-5 font-mono text-xl uppercase tracking-[0.28em] text-ink-quaternary">
          404
        </p>
        <h1 className="mt-3 text-2xl font-semibold tracking-heading text-ink-primary">
          This page doesn&apos;t exist
        </h1>
        <p className="mt-2 max-w-sm text-sm leading-relaxed text-ink-tertiary">
          The link may be broken, or the page has moved elsewhere.
        </p>

        <div className="mt-8 flex items-center gap-2">
          <Link
            to="/home"
            className={cn(buttonVariants({ size: 'sm' }), 'px-4')}
          >
            Back to home
          </Link>
          <Link
            to="/docs"
            className={cn(
              buttonVariants({ variant: 'outline', size: 'sm' }),
              'px-4'
            )}
          >
            Documentation
          </Link>
        </div>
      </div>
    </div>
  );
}
