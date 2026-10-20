import { createFileRoute, redirect } from '@tanstack/react-router';
import { LandingPage } from '@/app/components/landing/LandingPage';
import { FileStorage } from '@/app/lib/storage';
import { useStore } from '@/app/store/useStore';

/**
 * The marketing page doubles as the first-run route: returning users are sent
 * straight to the app. `/home` renders the same page without this guard.
 */
export const Route = createFileRoute('/')({
  beforeLoad: async () => {
    if (useStore.getState().workspaceState === 'unlocked') {
      throw redirect({ to: '/keys', replace: true });
    }

    const [hasWorkspace, metas] = await Promise.all([
      FileStorage.hasWorkspace(),
      FileStorage.getCachedVaultMetas(),
    ]);

    if (hasWorkspace || metas.length > 0) {
      throw redirect({ to: '/start', replace: true });
    }
  },
  component: LandingPage,
});
