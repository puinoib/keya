import { createFileRoute } from '@tanstack/react-router';
import { NextApp } from '@/app/screens/next/NextApp';

/**
 * The v2 stack's own entry point, kept beside the v1 routes while the rest of
 * the UI is migrated.
 */
export const Route = createFileRoute('/next')({
  component: NextApp,
});
