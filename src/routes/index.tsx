import { createFileRoute, redirect } from '@tanstack/react-router';
import { useStore } from '@/app/store/useStore';
import { loadSession } from '@/app/lib/session';
import { WelcomePage } from '@/app/components/welcome/WelcomePage';

export const Route = createFileRoute('/')({
  beforeLoad: () => {
    const session = loadSession();
    const workspaceState = useStore.getState().workspaceState;

    // If there's a session (will be restored) or already unlocked, redirect to /keys
    if (session || workspaceState === 'unlocked') {
      throw redirect({ to: '/keys' });
    }
  },
  component: WelcomePage,
});
