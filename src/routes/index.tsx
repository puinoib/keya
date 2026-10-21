import { createFileRoute, redirect } from '@tanstack/react-router';
import { LandingPage } from '@/app/components/landing/LandingPage';
import { Workspace } from '@/app/storage/workspace';
import { localState } from '@/app/storage/platform';

/**
 * The marketing page doubles as the first-run route: a returning user is sent
 * straight to the app. `/home` renders the same page without this guard.
 */
export const Route = createFileRoute('/')({
  beforeLoad: async () => {
    // The redirect is thrown, so it must happen outside the try/catch.
    let known = false;
    try {
      const [workspace, containers] = await Promise.all([
        Workspace.restore(),
        localState.listContainers(),
      ]);
      known = Boolean(workspace) || containers.length > 0;
    } catch {
      // Best effort: if device storage is unavailable, show the landing page.
    }

    if (known) throw redirect({ to: '/start', replace: true });
  },
  component: LandingPage,
});
