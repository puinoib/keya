import { createFileRoute, redirect } from '@tanstack/react-router';
import { useStore } from '@/app/store/useStore';
import { hasSession } from '@/app/lib/session';
import { WelcomePage } from '@/app/components/welcome/WelcomePage';

export const Route = createFileRoute('/start')({
  beforeLoad: () => {
    const hasSess = hasSession();
    const workspaceState = useStore.getState().workspaceState;

    // If there's a session (will be restored) or already unlocked, redirect to /keys
    if (hasSess || workspaceState === 'unlocked') {
      throw redirect({ to: '/keys' });
    }
  },
  component: WelcomePage,
});
