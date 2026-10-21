import { createFileRoute } from '@tanstack/react-router';
import { NextApp } from '@/app/screens/next/NextApp';

/**
 * The application entry: unlock a vault, or create one.
 *
 * This used to render the v1 welcome screen; the v2 runtime now lives here so
 * the whole app has a single entry point while the remaining v1 routes are
 * being removed.
 */
export const Route = createFileRoute('/start')({
  component: NextApp,
});
